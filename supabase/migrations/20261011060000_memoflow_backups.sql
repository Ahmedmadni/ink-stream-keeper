-- MemoFlow backup v1. Additive only: no existing user rows are updated/deleted.
-- Apply after the repository's existing migrations. No service-role access is needed by clients.
BEGIN;
-- Preserve explicit link IDs on INSERT (including restore); only remove obsolete
-- links on real plan moves/deletions, and only for the plan's owner.
CREATE OR REPLACE FUNCTION public.sync_plan_workspace_link()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE mapped_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.workspace_items WHERE user_id = OLD.user_id AND item_id = OLD.id
      AND item_type IN ('plan','goal','learning_plan','project','travel','maintenance');
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id OR OLD.type IS DISTINCT FROM NEW.type) THEN
    DELETE FROM public.workspace_items WHERE user_id = OLD.user_id AND item_id = OLD.id
      AND item_type IN ('plan','goal','learning_plan','project','travel','maintenance');
  END IF;
  IF NEW.workspace_id IS NOT NULL THEN
    mapped_type := CASE NEW.type WHEN 'learning' THEN 'learning_plan' WHEN 'goal' THEN 'goal'
      WHEN 'project' THEN 'project' WHEN 'travel' THEN 'travel' WHEN 'maintenance' THEN 'maintenance' ELSE 'plan' END;
    INSERT INTO public.workspace_items (workspace_id, user_id, item_type, item_id)
      VALUES (NEW.workspace_id, NEW.user_id, mapped_type, NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$fn$;
CREATE OR REPLACE FUNCTION public.memoflow_backup_tables_v1()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT ARRAY['profiles','categories','workspaces','notes','tasks','purchase_lists','purchase_items','workspace_items','plans','plan_stages','plan_steps','plan_links','subtasks','task_checklist','sub_items','attachments','item_attachments','item_comments','item_activity','workspace_links','smart_collections','workspace_activity','vault_settings','vault_categories','vault_entries']::text[];
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_backup_tables_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memoflow_backup_tables_v1() TO authenticated;

-- STABLE keeps all table reads on the calling statement's MVCC snapshot.
CREATE OR REPLACE FUNCTION public.memoflow_export_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid(); tbl text; owner_col text; rows jsonb;
  result jsonb := '{}'::jsonb; total bigint := 0;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'MF_AUTH_REQUIRED'; END IF;
  FOREACH tbl IN ARRAY public.memoflow_backup_tables_v1() LOOP
    owner_col := CASE WHEN tbl = 'profiles' THEN 'id' ELSE 'user_id' END;
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY %I), ''[]''::jsonb) FROM public.%I t WHERE %I = $1',
      CASE WHEN tbl = 'vault_settings' THEN 'user_id' ELSE 'id' END, tbl, owner_col) INTO rows USING actor;
    total := total + jsonb_array_length(rows);
    IF total > 10000 THEN RAISE EXCEPTION 'MF_TOO_LARGE'; END IF;
    result := result || jsonb_build_object(tbl, rows);
  END LOOP;
  IF octet_length(result::text) > 12582912 THEN RAISE EXCEPTION 'MF_TOO_LARGE'; END IF;
  RETURN jsonb_build_object('version', 1, 'accountId', actor, 'createdAt', now(), 'tables', result);
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_export_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memoflow_export_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.memoflow_restore_v1(payload jsonb, expected_account uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE
  actor uuid := auth.uid(); tbl text; owner_col text; pk text; rows jsonb;
  row_value jsonb; columns text[]; total bigint := 0;
  inserted bigint := 0; affected bigint; skipped bigint := 0;
  invalid boolean; ref record; existing_settings jsonb; incoming_settings jsonb;
BEGIN
  IF actor IS NULL OR actor IS DISTINCT FROM expected_account THEN RAISE EXCEPTION 'MF_ACCOUNT_CHANGED'; END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' OR payload->>'version' IS DISTINCT FROM '1'
    OR payload->>'accountId' IS DISTINCT FROM actor::text
    OR jsonb_typeof(payload->'tables') IS DISTINCT FROM 'object'
    OR octet_length(payload::text) > 12582912 THEN RAISE EXCEPTION 'MF_INVALID_BACKUP'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(payload->'tables')) <> cardinality(public.memoflow_backup_tables_v1())
    OR NOT (payload->'tables' ?& public.memoflow_backup_tables_v1()) THEN RAISE EXCEPTION 'MF_INVALID_TABLES'; END IF;
  -- Serializes import retries for this account. Normal edits are never overwritten.
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 7311));
  FOREACH tbl IN ARRAY public.memoflow_backup_tables_v1() LOOP
    rows := payload->'tables'->tbl;
    IF jsonb_typeof(rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MF_INVALID_ROWS'; END IF;
    total := total + jsonb_array_length(rows);
    IF total > 10000 THEN RAISE EXCEPTION 'MF_TOO_LARGE'; END IF;
    owner_col := CASE WHEN tbl = 'profiles' THEN 'id' ELSE 'user_id' END;
    pk := CASE WHEN tbl = 'vault_settings' THEN 'user_id' ELSE 'id' END;
    SELECT array_agg(a.attname::text ORDER BY a.attnum) INTO columns
      FROM pg_catalog.pg_attribute a WHERE a.attrelid = format('public.%I', tbl)::regclass AND a.attnum > 0 AND NOT a.attisdropped;
    FOR row_value IN SELECT value FROM jsonb_array_elements(rows) LOOP
      IF jsonb_typeof(row_value) IS DISTINCT FROM 'object' OR row_value->>owner_col IS DISTINCT FROM actor::text
        OR row_value->>pk IS NULL OR NOT (row_value ?& columns)
        OR (SELECT count(*) FROM jsonb_object_keys(row_value)) <> cardinality(columns)
      THEN RAISE EXCEPTION 'MF_INVALID_ROW'; END IF;
      PERFORM (row_value->>pk)::uuid;
      IF tbl IN ('attachments','item_attachments') AND
        (row_value->>'storage_path' NOT LIKE actor::text || '/%' OR row_value->>'storage_path' ~ '(^|/)(\.\.?)(/|$)|\\|%|//')
      THEN RAISE EXCEPTION 'MF_INVALID_PATH'; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT value->>pk) FROM jsonb_array_elements(rows)) <> jsonb_array_length(rows)
      THEN RAISE EXCEPTION 'MF_DUPLICATE_ID'; END IF;
  END LOOP;
  incoming_settings := payload->'tables'->'vault_settings'->0;
  SELECT to_jsonb(s) INTO existing_settings FROM public.vault_settings s WHERE user_id = actor FOR UPDATE;
  IF jsonb_array_length(payload->'tables'->'vault_settings') > 1 OR
    (jsonb_array_length(payload->'tables'->'vault_entries') > 0 AND incoming_settings IS NULL)
    THEN RAISE EXCEPTION 'MF_VAULT_SETTINGS_MISSING'; END IF;
  IF existing_settings IS NOT NULL AND incoming_settings IS NOT NULL AND
    (existing_settings->>'kdf_salt' IS DISTINCT FROM incoming_settings->>'kdf_salt' OR
     existing_settings->>'verifier_iv' IS DISTINCT FROM incoming_settings->>'verifier_iv' OR
     existing_settings->>'verifier_ct' IS DISTINCT FROM incoming_settings->>'verifier_ct')
    THEN RAISE EXCEPTION 'MF_VAULT_KEY_CONFLICT'; END IF;

  FOREACH tbl IN ARRAY public.memoflow_backup_tables_v1() LOOP
    owner_col := CASE WHEN tbl = 'profiles' THEN 'id' ELSE 'user_id' END;
    pk := CASE WHEN tbl = 'vault_settings' THEN 'user_id' ELSE 'id' END;
    rows := payload->'tables'->tbl;
    -- No ON CONFLICT DO NOTHING: a collision with an invisible row must abort.
    EXECUTE format('INSERT INTO public.%1$I SELECT r.* FROM jsonb_populate_recordset(NULL::public.%1$I, $1) r
      WHERE NOT EXISTS (SELECT 1 FROM public.%1$I e WHERE e.%2$I = r.%2$I AND e.%3$I = $2)', tbl, pk, owner_col)
      USING rows, actor;
    GET DIAGNOSTICS affected = ROW_COUNT;
    inserted := inserted + affected; skipped := skipped + jsonb_array_length(rows) - affected;
  END LOOP;
  -- FKs alone do not enforce tenant ownership. Check every user-owned FK target.
  FOR ref IN
    SELECT c.conrelid::regclass AS source_table, c.confrelid::regclass AS target_table,
      a.attname AS source_column, b.attname AS target_column, t.relname AS source_name
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_catalog.pg_attribute b ON b.attrelid = c.confrelid AND b.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND cardinality(c.conkey) = 1 AND n.nspname = 'public'
      AND t.relname = ANY(public.memoflow_backup_tables_v1())
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute x WHERE x.attrelid = c.confrelid AND x.attname = 'user_id' AND NOT x.attisdropped)
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM jsonb_populate_recordset(NULL::%1$s, $1) r
      WHERE r.%2$I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %3$s target WHERE target.%4$I = r.%2$I AND target.user_id = $2))',
      ref.source_table, ref.source_column, ref.target_table, ref.target_column)
      INTO invalid USING payload->'tables'->ref.source_name, actor;
    IF invalid THEN RAISE EXCEPTION 'MF_INVALID_RELATION'; END IF;
  END LOOP;
  RETURN jsonb_build_object('inserted', inserted, 'skipped', skipped);
END;
$fn$;
REVOKE ALL ON FUNCTION public.memoflow_restore_v1(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.memoflow_restore_v1(jsonb, uuid) TO authenticated;
COMMIT;
