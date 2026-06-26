
-- =========================================================
-- Purchase Lists
-- =========================================================
CREATE TABLE public.purchase_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived','cancelled')),
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('low','med','high')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_lists TO authenticated;
GRANT ALL ON public.purchase_lists TO service_role;

ALTER TABLE public.purchase_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_lists_own" ON public.purchase_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_purchase_lists_updated
  BEFORE UPDATE ON public.purchase_lists
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_purchase_lists_user ON public.purchase_lists(user_id, status, created_at DESC);

-- =========================================================
-- Purchase Items
-- =========================================================
CREATE TABLE public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_list_id UUID NOT NULL REFERENCES public.purchase_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  expected_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_price NUMERIC(14,2),
  store_name TEXT,
  brand TEXT,
  image_url TEXT,
  barcode TEXT,
  purchased BOOLEAN NOT NULL DEFAULT false,
  purchased_at TIMESTAMPTZ,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_own" ON public.purchase_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_purchase_items_updated
  BEFORE UPDATE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_purchase_items_list ON public.purchase_items(purchase_list_id, sort_order);

-- =========================================================
-- Stats VIEW (auto-computed totals — never trust client input)
-- =========================================================
CREATE OR REPLACE VIEW public.purchase_list_stats
WITH (security_invoker = true) AS
SELECT
  l.id AS purchase_list_id,
  l.user_id,
  COALESCE(SUM(i.quantity * i.expected_price), 0)::NUMERIC(14,2) AS expected_total,
  COALESCE(SUM(CASE WHEN i.purchased THEN i.quantity * COALESCE(i.actual_price, i.expected_price) END), 0)::NUMERIC(14,2) AS actual_total,
  (l.budget - COALESCE(SUM(CASE WHEN i.purchased THEN i.quantity * COALESCE(i.actual_price, i.expected_price) END), 0))::NUMERIC(14,2) AS remaining_amount,
  COUNT(i.id)::INT AS items_count,
  COUNT(i.id) FILTER (WHERE i.purchased)::INT AS purchased_count,
  CASE WHEN COUNT(i.id) = 0 THEN 0
       ELSE ROUND((COUNT(i.id) FILTER (WHERE i.purchased))::NUMERIC * 100 / COUNT(i.id))::INT
  END AS progress
FROM public.purchase_lists l
LEFT JOIN public.purchase_items i ON i.purchase_list_id = l.id
GROUP BY l.id, l.user_id, l.budget;

GRANT SELECT ON public.purchase_list_stats TO authenticated;
GRANT ALL ON public.purchase_list_stats TO service_role;
