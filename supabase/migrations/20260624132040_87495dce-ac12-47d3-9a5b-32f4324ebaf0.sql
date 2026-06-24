
-- vault_settings: per-user PIN verifier
CREATE TABLE public.vault_settings (
  user_id uuid PRIMARY KEY,
  kdf_salt text NOT NULL,
  verifier_iv text NOT NULL,
  verifier_ct text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_settings TO authenticated;
GRANT ALL ON public.vault_settings TO service_role;
ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_settings_all_own ON public.vault_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER vault_settings_touch BEFORE UPDATE ON public.vault_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- vault_categories
CREATE TABLE public.vault_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'KeyRound',
  color text NOT NULL DEFAULT 'primary',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_categories TO authenticated;
GRANT ALL ON public.vault_categories TO service_role;
ALTER TABLE public.vault_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_categories_all_own ON public.vault_categories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vault_entries
CREATE TABLE public.vault_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid REFERENCES public.vault_categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  username text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  password_iv text NOT NULL,
  password_ct text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_entries TO authenticated;
GRANT ALL ON public.vault_entries TO service_role;
ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_entries_all_own ON public.vault_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER vault_entries_touch BEFORE UPDATE ON public.vault_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX vault_entries_user_idx ON public.vault_entries(user_id, category_id);
CREATE INDEX vault_categories_user_idx ON public.vault_categories(user_id, sort_order);
