
-- ============ WORKSPACES ============
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'primary',
  icon TEXT NOT NULL DEFAULT 'FolderKanban',
  cover_url TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active', -- active|planning|on_hold|done|archived
  favorite BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspaces" ON public.workspaces FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_workspaces_touch BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_workspaces_user ON public.workspaces(user_id, archived, position);

-- ============ WORKSPACE ITEMS (polymorphic) ============
CREATE TABLE public.workspace_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- task|note|purchase_list|goal|learning_plan|project|travel|maintenance
  item_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, item_type, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_items TO authenticated;
GRANT ALL ON public.workspace_items TO service_role;
ALTER TABLE public.workspace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspace_items" ON public.workspace_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_wi_workspace ON public.workspace_items(workspace_id, item_type);
CREATE INDEX idx_wi_item ON public.workspace_items(item_type, item_id);

-- ============ WORKSPACE LINKS ============
CREATE TABLE public.workspace_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  favicon TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_links TO authenticated;
GRANT ALL ON public.workspace_links TO service_role;
ALTER TABLE public.workspace_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspace_links" ON public.workspace_links FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_workspace_links_touch BEFORE UPDATE ON public.workspace_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_wl_workspace ON public.workspace_links(workspace_id);

-- ============ SMART COLLECTIONS ============
CREATE TABLE public.smart_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  color TEXT NOT NULL DEFAULT 'accent',
  item_type TEXT NOT NULL, -- one of supported types
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_collections TO authenticated;
GRANT ALL ON public.smart_collections TO service_role;
ALTER TABLE public.smart_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own smart_collections" ON public.smart_collections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_smart_collections_touch BEFORE UPDATE ON public.smart_collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_sc_user ON public.smart_collections(user_id, workspace_id);

-- ============ WORKSPACE ACTIVITY ============
CREATE TABLE public.workspace_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  item_type TEXT,
  item_id UUID,
  action TEXT NOT NULL, -- added|removed|updated|completed
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_activity TO authenticated;
GRANT ALL ON public.workspace_activity TO service_role;
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workspace_activity" ON public.workspace_activity FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_wa_workspace ON public.workspace_activity(workspace_id, created_at DESC);

-- ============ STATS VIEW ============
CREATE OR REPLACE VIEW public.workspace_stats
WITH (security_invoker = true)
AS
SELECT
  w.id AS workspace_id,
  w.user_id,
  COUNT(wi.*) FILTER (WHERE wi.item_type='task')          AS tasks_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='note')          AS notes_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='purchase_list') AS purchases_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='goal')          AS goals_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='learning_plan') AS learning_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='project')       AS projects_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='travel')        AS travel_count,
  COUNT(wi.*) FILTER (WHERE wi.item_type='maintenance')   AS maintenance_count,
  COUNT(wi.*)                                              AS items_count,
  COUNT(t.*) FILTER (WHERE t.done IS TRUE)                AS done_tasks,
  COUNT(t.*)                                              AS total_tasks,
  CASE WHEN COUNT(t.*) > 0
       THEN ROUND( (COUNT(t.*) FILTER (WHERE t.done IS TRUE))::numeric * 100 / COUNT(t.*) )
       ELSE 0 END                                          AS progress,
  MAX(GREATEST(
    COALESCE(t.updated_at, 'epoch'::timestamptz),
    COALESCE(n.updated_at, 'epoch'::timestamptz),
    COALESCE(pl.updated_at, 'epoch'::timestamptz),
    wi.added_at
  ))                                                       AS last_activity
FROM public.workspaces w
LEFT JOIN public.workspace_items wi ON wi.workspace_id = w.id
LEFT JOIN public.tasks t            ON wi.item_type='task'          AND t.id  = wi.item_id
LEFT JOIN public.notes n            ON wi.item_type='note'          AND n.id  = wi.item_id
LEFT JOIN public.purchase_lists pl  ON wi.item_type='purchase_list' AND pl.id = wi.item_id
GROUP BY w.id, w.user_id;

GRANT SELECT ON public.workspace_stats TO authenticated;
GRANT ALL ON public.workspace_stats TO service_role;
