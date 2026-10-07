-- ==============================================================================
-- OCS CAFM - 10_AUTH_LOCKDOWN.SQL
-- Move sign-in to Supabase Auth and replace the open cafm_app_access_* policies
-- with role-based ones.
--
-- Before: every request ran as the anonymous key, so every CAFM table (and the
-- photo bucket) was readable and writable by anyone holding that public key,
-- and app_set_password let anyone reset any password.
--
-- After:  a request must carry a Supabase Auth session whose user is linked to
-- an active CAFM profile (profiles.auth_user_id). The profile's role decides
-- what it may change. Tables of the FM Condition Survey app are not touched.
--
-- Roles: admin, fm_manager, supervisor, technician (finance can be added later).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Link CAFM profiles to Supabase Auth users (by email)
-- ------------------------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Existing logins with the same email (e.g. created in the dashboard).
UPDATE profiles p SET auth_user_id = u.id
  FROM auth.users u
 WHERE p.auth_user_id IS NULL AND lower(u.email) = lower(p.email);

-- New logins created later in the Supabase dashboard link themselves.
CREATE OR REPLACE FUNCTION cafm_link_profile_to_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.profiles SET auth_user_id = NEW.id
     WHERE auth_user_id IS NULL AND lower(email) = lower(NEW.email);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cafm_link_profile ON auth.users;
CREATE TRIGGER trg_cafm_link_profile AFTER INSERT OR UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION cafm_link_profile_to_auth_user();

-- ------------------------------------------------------------------------------
-- 2. Role helpers (SECURITY DEFINER so policies can read profiles safely)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT role_id FROM public.profiles
     WHERE auth_user_id = auth.uid() AND COALESCE(is_active, TRUE)
     LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION cafm_has_role(VARIADIC p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(public.cafm_role() = ANY (p_roles), FALSE);
$$;

REVOKE ALL ON FUNCTION cafm_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cafm_has_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cafm_role() TO authenticated;
GRANT EXECUTE ON FUNCTION cafm_has_role(TEXT[]) TO authenticated;

-- Sign-in by employee ID: turns an employee ID into the email Supabase Auth
-- needs. Returns nothing for unknown or inactive IDs.
CREATE OR REPLACE FUNCTION cafm_login_email(p_identifier TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT email FROM public.profiles
     WHERE lower(trim(employee_id)) = lower(trim(p_identifier))
       AND COALESCE(is_active, TRUE)
     LIMIT 1;
$$;
REVOKE ALL ON FUNCTION cafm_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cafm_login_email(TEXT) TO anon, authenticated;

-- Job costing is recalculated by a trigger when a technician logs labour; it
-- must be able to write wo_costing whatever the caller's role.
ALTER FUNCTION cafm_recalc_wo_costing(TEXT) SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. Retire the old password functions (callable by the public key)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_set_password_by_email(TEXT, TEXT);
DROP FUNCTION IF EXISTS app_set_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS app_login(TEXT, TEXT);
-- user_credentials keeps the old hashes for now but nobody can read it.
ALTER TABLE IF EXISTS user_credentials ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE p RECORD; BEGIN
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_credentials' LOOP
        EXECUTE format('DROP POLICY %I ON user_credentials', p.policyname);
    END LOOP;
END $$;
REVOKE ALL ON user_credentials FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Replace the open policies
-- ------------------------------------------------------------------------------
-- Groups:
--   ops        any CAFM user reads/creates/updates; admin deletes
--   master     any CAFM user reads; admin + fm_manager write; admin deletes
--   commercial admin, fm_manager, supervisor read; admin + fm_manager write
--   admin_only any CAFM user reads; admin writes
DO $$
DECLARE
    t TEXT;
    ops TEXT[] := ARRAY['work_orders','work_order_status_history','work_order_photos','work_order_comments',
        'work_order_materials','material_transactions','ppm_schedules','ppm_checklist_responses','ppm_photos',
        'signatures','notifications','wo_sla_pauses','wo_checklist_responses','wo_labour','wo_subcontract_costs',
        'ai_suggestions'];
    master TEXT[] := ARRAY['facilities','buildings','floors','zones','locations','categories','subcategories',
        'assets','materials','ppm_checklists','ppm_checklist_items','ppm_plans','sla_configs','sla_policies',
        'business_calendars','public_holidays','trades'];
    commercial TEXT[] := ARRAY['clients','contracts','labour_rates','wo_costing','quotes','invoices','billing_lines'];
    admin_only TEXT[] := ARRAY['profiles','roles','system_settings'];
    p RECORD;
BEGIN
    -- drop every cafm_* policy on the CAFM tables
    FOR p IN SELECT tablename, policyname FROM pg_policies
              WHERE schemaname='public' AND policyname LIKE 'cafm\_%'
                AND tablename = ANY (ops || master || commercial || admin_only || ARRAY['audit_logs']) LOOP
        EXECUTE format('DROP POLICY %I ON %I', p.policyname, p.tablename);
    END LOOP;

    FOREACH t IN ARRAY ops || master || commercial || admin_only || ARRAY['audit_logs'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON %I FROM anon', t);
    END LOOP;

    FOREACH t IN ARRAY ops LOOP
        EXECUTE format('CREATE POLICY cafm_read ON %I FOR SELECT TO authenticated USING (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_insert ON %I FOR INSERT TO authenticated WITH CHECK (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_update ON %I FOR UPDATE TO authenticated USING (cafm_role() IS NOT NULL) WITH CHECK (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_delete ON %I FOR DELETE TO authenticated USING (cafm_has_role(''admin''))', t);
    END LOOP;

    FOREACH t IN ARRAY master LOOP
        EXECUTE format('CREATE POLICY cafm_read ON %I FOR SELECT TO authenticated USING (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_insert ON %I FOR INSERT TO authenticated WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_update ON %I FOR UPDATE TO authenticated USING (cafm_has_role(''admin'',''fm_manager'')) WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_delete ON %I FOR DELETE TO authenticated USING (cafm_has_role(''admin''))', t);
    END LOOP;

    FOREACH t IN ARRAY commercial LOOP
        EXECUTE format('CREATE POLICY cafm_read ON %I FOR SELECT TO authenticated USING (cafm_has_role(''admin'',''fm_manager'',''supervisor''))', t);
        EXECUTE format('CREATE POLICY cafm_insert ON %I FOR INSERT TO authenticated WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_update ON %I FOR UPDATE TO authenticated USING (cafm_has_role(''admin'',''fm_manager'')) WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_delete ON %I FOR DELETE TO authenticated USING (cafm_has_role(''admin''))', t);
    END LOOP;

    FOREACH t IN ARRAY admin_only LOOP
        EXECUTE format('CREATE POLICY cafm_read ON %I FOR SELECT TO authenticated USING (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_write ON %I FOR ALL TO authenticated USING (cafm_has_role(''admin'')) WITH CHECK (cafm_has_role(''admin''))', t);
    END LOOP;

    -- audit log: anyone signed in appends; managers read; nobody edits.
    CREATE POLICY cafm_read ON audit_logs FOR SELECT TO authenticated USING (cafm_has_role('admin','fm_manager'));
    CREATE POLICY cafm_insert ON audit_logs FOR INSERT TO authenticated WITH CHECK (cafm_role() IS NOT NULL);
END $$;

-- Users may update their own last_login_at / phone without being admin.
CREATE POLICY cafm_update_self ON profiles FOR UPDATE TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid() AND role_id = cafm_role() AND COALESCE(is_active, TRUE));

-- ------------------------------------------------------------------------------
-- 5. Work-order photo bucket
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cafm photos readable" ON storage.objects;
DROP POLICY IF EXISTS "cafm photos insertable" ON storage.objects;
DROP POLICY IF EXISTS "cafm photos deletable" ON storage.objects;

CREATE POLICY "cafm photos readable" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'work-order-photos' AND public.cafm_role() IS NOT NULL);
CREATE POLICY "cafm photos insertable" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'work-order-photos' AND public.cafm_role() IS NOT NULL);
CREATE POLICY "cafm photos deletable" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'work-order-photos' AND public.cafm_has_role('admin'));
