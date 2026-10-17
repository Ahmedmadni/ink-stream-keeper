-- Task categories + checklist integrity and automatic parent completion.
-- Additive/idempotent: existing task/category/sub-item rows are preserved.

-- A task may only reference one of its owner's categories. A plain FK does not
-- enforce tenant ownership because category_id and user_id are separate columns.
CREATE OR REPLACE FUNCTION public.memoflow_validate_task_category()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = NEW.category_id AND c.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'MF_INVALID_TASK_CATEGORY';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_validate_task_category() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS memoflow_validate_task_category ON public.tasks;
CREATE TRIGGER memoflow_validate_task_category
  BEFORE INSERT OR UPDATE OF category_id, user_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.memoflow_validate_task_category();

-- Polymorphic sub_items cannot use a normal FK for parent_id. Enforce the task
-- branch and nested-item ownership here, while leaving the other parent types intact.
CREATE OR REPLACE FUNCTION public.memoflow_validate_task_sub_item()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  IF NEW.parent_type = 'task' AND NOT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = NEW.parent_id AND t.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'MF_INVALID_TASK_PARENT';
  END IF;
  IF NEW.parent_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.sub_items p
    WHERE p.id = NEW.parent_item_id
      AND p.user_id = NEW.user_id
      AND p.parent_type = NEW.parent_type
      AND p.parent_id = NEW.parent_id
      AND p.depth < NEW.depth
  ) THEN
    RAISE EXCEPTION 'MF_INVALID_SUB_ITEM_PARENT';
  END IF;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_validate_task_sub_item() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS memoflow_validate_task_sub_item ON public.sub_items;
CREATE CONSTRAINT TRIGGER memoflow_validate_task_sub_item
  AFTER INSERT OR UPDATE ON public.sub_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.memoflow_validate_task_sub_item();

CREATE OR REPLACE FUNCTION public.memoflow_next_task_time(value timestamptz, recurrence text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
DECLARE local_value timestamp; next_local timestamp; wanted_day integer; final_day integer;
BEGIN
  IF value IS NULL OR recurrence = 'none' THEN RETURN value; END IF;
  local_value := value AT TIME ZONE 'Asia/Riyadh';
  IF recurrence = 'daily' THEN next_local := local_value + interval '1 day';
  ELSIF recurrence = 'weekly' THEN next_local := local_value + interval '7 days';
  ELSIF recurrence = 'monthly' THEN
    wanted_day := extract(day FROM local_value)::integer;
    next_local := date_trunc('month', local_value) + interval '1 month';
    final_day := extract(day FROM (next_local + interval '1 month - 1 day'))::integer;
    next_local := next_local + (least(wanted_day, final_day) - 1) * interval '1 day'
      + (local_value - date_trunc('day', local_value));
  ELSE RAISE EXCEPTION 'MF_INVALID_RECURRENCE';
  END IF;
  RETURN next_local AT TIME ZONE 'Asia/Riyadh';
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_next_task_time(timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.memoflow_next_task_time(timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.memoflow_sync_task_checklist(task_id uuid, owner_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE total_count integer; done_count integer; task_row public.tasks%ROWTYPE;
  next_due timestamptz; reminder_gap interval;
BEGIN
  SELECT * INTO task_row FROM public.tasks t
    WHERE t.id = task_id AND t.user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*)::integer, count(*) FILTER (WHERE done)::integer
    INTO total_count, done_count
    FROM public.sub_items s
    WHERE s.parent_type = 'task' AND s.parent_id = task_id AND s.user_id = owner_id;

  IF total_count > 0 AND done_count = total_count
     AND task_row.recurrence <> 'none' AND task_row.due_at IS NOT NULL THEN
    next_due := public.memoflow_next_task_time(task_row.due_at, task_row.recurrence);
    reminder_gap := CASE WHEN task_row.reminder_at IS NULL THEN NULL
      ELSE task_row.due_at - task_row.reminder_at END;
    -- Nested rollup triggers are ignored by the wrapper below. The next occurrence
    -- starts with a fresh checklist and the same set of steps.
    UPDATE public.sub_items SET done = false, status = 'todo', progress = 0, done_at = NULL
      WHERE parent_type = 'task' AND parent_id = task_id AND user_id = owner_id;
    UPDATE public.tasks SET
      due_at = next_due,
      reminder_at = CASE WHEN reminder_gap IS NULL THEN NULL ELSE next_due - reminder_gap END,
      progress = 0, done = false, status = 'todo'
      WHERE id = task_id AND user_id = owner_id;
    RETURN;
  END IF;

  UPDATE public.tasks SET
    progress = CASE WHEN total_count = 0 THEN 0
      ELSE round(done_count::numeric * 100 / total_count)::integer END,
    done = total_count > 0 AND done_count = total_count,
    status = CASE
      WHEN total_count > 0 AND done_count = total_count THEN 'done'
      WHEN status = 'done' THEN 'todo'
      ELSE status
    END
    WHERE id = task_id AND user_id = owner_id
      AND (progress, done, status) IS DISTINCT FROM (
        CASE WHEN total_count = 0 THEN 0
          ELSE round(done_count::numeric * 100 / total_count)::integer END,
        total_count > 0 AND done_count = total_count,
        CASE
          WHEN total_count > 0 AND done_count = total_count THEN 'done'
          WHEN status = 'done' THEN 'todo'
          ELSE status
        END
      );
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_sync_task_checklist(uuid, uuid) FROM PUBLIC, anon, authenticated;
-- The trigger runs with the caller's RLS context; direct calls can only update
-- a task visible to that same authenticated user.
GRANT EXECUTE ON FUNCTION public.memoflow_sync_task_checklist(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.memoflow_rollup_task_checklist()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  -- Resetting a recurring checklist updates several rows from inside the first
  -- trigger invocation. Let the outer invocation perform the single final rollup.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.parent_type = 'task' AND
     (TG_OP = 'DELETE' OR NEW.parent_type IS DISTINCT FROM OLD.parent_type
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    PERFORM public.memoflow_sync_task_checklist(OLD.parent_id, OLD.user_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.parent_type = 'task' THEN
    PERFORM public.memoflow_sync_task_checklist(NEW.parent_id, NEW.user_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_rollup_task_checklist() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS memoflow_rollup_task_checklist ON public.sub_items;
CREATE CONSTRAINT TRIGGER memoflow_rollup_task_checklist
  AFTER INSERT OR UPDATE OR DELETE ON public.sub_items
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.memoflow_rollup_task_checklist();

-- sub_items has a polymorphic parent and previously survived task deletion.
CREATE OR REPLACE FUNCTION public.memoflow_delete_task_sub_items()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
BEGIN
  DELETE FROM public.sub_items
    WHERE parent_type = 'task' AND parent_id = OLD.id AND user_id = OLD.user_id;
  RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_delete_task_sub_items() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS memoflow_delete_task_sub_items ON public.tasks;
CREATE TRIGGER memoflow_delete_task_sub_items
  AFTER DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.memoflow_delete_task_sub_items();

-- Bring existing task checklists into the same invariant immediately. Orphaned
-- polymorphic rows are left untouched so this migration never deletes user data.
DO $fn$
DECLARE checklist record;
BEGIN
  FOR checklist IN
    SELECT DISTINCT s.parent_id AS task_id, s.user_id AS owner_id
    FROM public.sub_items s
    JOIN public.tasks t ON t.id = s.parent_id AND t.user_id = s.user_id
    WHERE s.parent_type = 'task'
  LOOP
    PERFORM public.memoflow_sync_task_checklist(checklist.task_id, checklist.owner_id);
  END LOOP;
END;
$fn$;

