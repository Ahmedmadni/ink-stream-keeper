
CREATE OR REPLACE FUNCTION public.sync_plan_workspace_link()
RETURNS TRIGGER AS $$
DECLARE
  mapped_type TEXT;
BEGIN
  -- Always purge any prior link rows for this plan id
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.workspace_items WHERE item_id = OLD.id
      AND item_type IN ('plan','goal','learning_plan','project','travel','maintenance');
    RETURN OLD;
  END IF;

  DELETE FROM public.workspace_items WHERE item_id = NEW.id
    AND item_type IN ('plan','goal','learning_plan','project','travel','maintenance');

  IF NEW.workspace_id IS NOT NULL THEN
    mapped_type := CASE NEW.type
      WHEN 'learning' THEN 'learning_plan'
      WHEN 'goal' THEN 'goal'
      WHEN 'project' THEN 'project'
      WHEN 'travel' THEN 'travel'
      WHEN 'maintenance' THEN 'maintenance'
      ELSE 'plan'
    END;
    INSERT INTO public.workspace_items (workspace_id, user_id, item_type, item_id)
    VALUES (NEW.workspace_id, NEW.user_id, mapped_type, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
