-- Keep parent task completion derived from its checklist on every write path.
-- Additive/idempotent: no checklist rows are deleted or rewritten.
CREATE OR REPLACE FUNCTION public.memoflow_enforce_task_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
DECLARE
  total_count integer;
  done_count integer;
BEGIN
  SELECT count(*)::integer, count(*) FILTER (WHERE s.done)::integer
    INTO total_count, done_count
    FROM public.sub_items s
    WHERE s.parent_type = 'task'
      AND s.parent_id = NEW.id
      AND s.user_id = NEW.user_id;

  -- Older installations may still have checklist rows in the two legacy
  -- tables. Use them only while the task has no rows in the current model,
  -- matching the application migration screen and avoiding double counting.
  IF total_count = 0 THEN
    SELECT count(*)::integer, count(*) FILTER (WHERE legacy_row.done)::integer
      INTO total_count, done_count
      FROM (
        SELECT checklist.done
        FROM public.task_checklist checklist
        WHERE checklist.task_id = NEW.id AND checklist.user_id = NEW.user_id
        UNION ALL
        SELECT subtask.done
        FROM public.subtasks subtask
        WHERE subtask.task_id = NEW.id AND subtask.user_id = NEW.user_id
      ) legacy_row;
  END IF;

  -- A task without checklist rows remains manually completable. Once rows exist,
  -- the checklist is the only source of truth for completion and progress.
  IF total_count > 0 THEN
    NEW.progress := round(done_count::numeric * 100 / total_count)::integer;
    NEW.done := done_count = total_count;
    NEW.status := CASE
      WHEN done_count = total_count THEN 'done'
      WHEN NEW.status = 'done' THEN 'todo'
      ELSE NEW.status
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.memoflow_enforce_task_completion()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS memoflow_enforce_task_completion ON public.tasks;
CREATE TRIGGER memoflow_enforce_task_completion
  BEFORE UPDATE OF done, status, progress ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.memoflow_enforce_task_completion();

-- Read-only probe used by installed clients. Checking the trigger itself avoids
-- reporting readiness when only the helper function exists.
CREATE OR REPLACE FUNCTION public.memoflow_task_completion_guard_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger trigger_row
    JOIN pg_catalog.pg_class table_row ON table_row.oid = trigger_row.tgrelid
    JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
    WHERE schema_row.nspname = 'public'
      AND table_row.relname = 'tasks'
      AND trigger_row.tgname = 'memoflow_enforce_task_completion'
      AND NOT trigger_row.tgisinternal
  );
$fn$;

REVOKE ALL ON FUNCTION public.memoflow_task_completion_guard_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memoflow_task_completion_guard_v1() TO authenticated;

-- Normalize any parent state that an older client may have set manually.
DO $fn$
DECLARE
  checklist record;
BEGIN
  FOR checklist IN
    SELECT task_row.id AS task_id, task_row.user_id AS owner_id
    FROM public.tasks task_row
    WHERE EXISTS (
      SELECT 1 FROM public.sub_items item_row
      WHERE item_row.parent_type = 'task'
        AND item_row.parent_id = task_row.id
        AND item_row.user_id = task_row.user_id
    ) OR EXISTS (
      SELECT 1 FROM public.task_checklist checklist_row
      WHERE checklist_row.task_id = task_row.id
        AND checklist_row.user_id = task_row.user_id
    ) OR EXISTS (
      SELECT 1 FROM public.subtasks subtask_row
      WHERE subtask_row.task_id = task_row.id
        AND subtask_row.user_id = task_row.user_id
    )
  LOOP
    PERFORM public.memoflow_sync_task_checklist(
      checklist.task_id,
      checklist.owner_id
    );
  END LOOP;
END;
$fn$;