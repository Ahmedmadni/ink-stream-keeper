CREATE TABLE public.sub_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_type text NOT NULL,
  parent_id uuid NOT NULL,
  parent_item_id uuid REFERENCES public.sub_items(id) ON DELETE CASCADE,
  depth smallint NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'med',
  progress smallint NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  start_at timestamptz,
  end_at timestamptz,
  reminder_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  converted_task_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sub_items_parent_idx ON public.sub_items (user_id, parent_type, parent_id, position);
CREATE INDEX sub_items_child_idx ON public.sub_items (parent_item_id);
CREATE INDEX sub_items_title_idx ON public.sub_items USING gin (to_tsvector('simple', title));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_items TO authenticated;
GRANT ALL ON public.sub_items TO service_role;
ALTER TABLE public.sub_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own sub items" ON public.sub_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sub_items_touch BEFORE UPDATE ON public.sub_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.item_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  parent_type text,
  parent_id uuid,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_activity_parent_idx ON public.item_activity (user_id, parent_type, parent_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.item_activity TO authenticated;
GRANT ALL ON public.item_activity TO service_role;
ALTER TABLE public.item_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own item activity" ON public.item_activity
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);