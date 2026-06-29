
-- =========================================================
-- Planning Engine
-- =========================================================

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'goal',
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  color TEXT,
  icon TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  estimated_duration INTEGER,
  progress INTEGER NOT NULL DEFAULT 0,
  budget NUMERIC(14,2),
  currency TEXT DEFAULT 'SAR',
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  type_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plans" ON public.plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX plans_user_idx ON public.plans(user_id);
CREATE INDEX plans_workspace_idx ON public.plans(workspace_id);
CREATE INDEX plans_type_idx ON public.plans(type);
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------
CREATE TABLE public.plan_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_stages TO authenticated;
GRANT ALL ON public.plan_stages TO service_role;
ALTER TABLE public.plan_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan stages" ON public.plan_stages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX plan_stages_plan_idx ON public.plan_stages(plan_id, position);
CREATE TRIGGER plan_stages_touch BEFORE UPDATE ON public.plan_stages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------
CREATE TABLE public.plan_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.plan_stages(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  duration INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_steps TO authenticated;
GRANT ALL ON public.plan_steps TO service_role;
ALTER TABLE public.plan_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan steps" ON public.plan_steps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX plan_steps_stage_idx ON public.plan_steps(stage_id, position);
CREATE TRIGGER plan_steps_touch BEFORE UPDATE ON public.plan_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------
CREATE TABLE public.plan_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  label TEXT,
  url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_links TO authenticated;
GRANT ALL ON public.plan_links TO service_role;
ALTER TABLE public.plan_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own plan links" ON public.plan_links
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX plan_links_unique ON public.plan_links(plan_id, item_type, item_id);
CREATE INDEX plan_links_plan_idx ON public.plan_links(plan_id);

-- ---------------------------------------------------------
-- Stats view
CREATE OR REPLACE VIEW public.plan_stats AS
SELECT
  p.id AS plan_id,
  p.user_id,
  COALESCE(st.stage_count, 0)        AS stage_count,
  COALESCE(st.stage_done, 0)         AS stage_done,
  COALESCE(sp.step_count, 0)         AS step_count,
  COALESCE(sp.step_done, 0)          AS step_done,
  COALESCE(li.link_count, 0)         AS link_count,
  CASE
    WHEN COALESCE(sp.step_count, 0) > 0
      THEN ROUND( (sp.step_done::numeric / sp.step_count) * 100 )::int
    WHEN COALESCE(st.stage_count, 0) > 0
      THEN ROUND( (st.stage_done::numeric / st.stage_count) * 100 )::int
    ELSE p.progress
  END AS computed_progress
FROM public.plans p
LEFT JOIN (
  SELECT plan_id, COUNT(*) AS stage_count,
         COUNT(*) FILTER (WHERE status = 'done') AS stage_done
  FROM public.plan_stages GROUP BY plan_id
) st ON st.plan_id = p.id
LEFT JOIN (
  SELECT plan_id, COUNT(*) AS step_count,
         COUNT(*) FILTER (WHERE done) AS step_done
  FROM public.plan_steps GROUP BY plan_id
) sp ON sp.plan_id = p.id
LEFT JOIN (
  SELECT plan_id, COUNT(*) AS link_count
  FROM public.plan_links GROUP BY plan_id
) li ON li.plan_id = p.id;

GRANT SELECT ON public.plan_stats TO authenticated;
GRANT SELECT ON public.plan_stats TO service_role;

-- ---------------------------------------------------------
-- Auto-link plan into workspace_items when workspace_id changes
CREATE OR REPLACE FUNCTION public.sync_plan_workspace_link()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.workspace_items
      WHERE item_type = 'plan' AND item_id = OLD.id;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE' AND OLD.workspace_id IS DISTINCT FROM NEW.workspace_id) THEN
    DELETE FROM public.workspace_items
      WHERE item_type = 'plan' AND item_id = NEW.id;
  END IF;

  IF NEW.workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_items (workspace_id, user_id, item_type, item_id)
    VALUES (NEW.workspace_id, NEW.user_id, 'plan', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER plans_sync_workspace
  AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.sync_plan_workspace_link();
