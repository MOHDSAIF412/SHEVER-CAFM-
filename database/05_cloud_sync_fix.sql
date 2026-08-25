-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - CAFM
-- 05_CLOUD_SYNC_FIX.SQL
--
-- Fixes the "changes never reach the database" bug.
--
-- ROOT CAUSE:
--   The web app authenticates locally (it never calls supabase.auth.signIn*),
--   so every request from the browser arrives with the `anon` Postgres role.
--   Every policy in 02_rls_policies.sql is `TO authenticated`, so RLS silently
--   rejected 100% of INSERT / UPDATE / DELETE and returned 0 rows on SELECT.
--
-- ALSO FIXED HERE:
--   * profiles.id had a FK to auth.users(id) -> app-managed users could never
--     be inserted.
--   * profiles had no employee_id column and no place to keep a password.
--   * Passwords are stored bcrypt-hashed in a separate table the browser
--     cannot read. Login / password change go through SECURITY DEFINER RPCs.
--
-- This file adapts to whichever type your `profiles.id` column already uses
-- (UUID or TEXT) rather than assuming one, so it works on any of the schema
-- variants that have been deployed.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Safe to re-run (idempotent). Existing passwords are never overwritten.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 0. Work out what type this database uses for profiles.id
--    (some deployments use UUID, others TEXT - both are supported)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _cafm_id_type() RETURNS TEXT AS $$
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    JOIN pg_class     c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND a.attname = 'id'
      AND NOT a.attisdropped;
$$ LANGUAGE sql STABLE;

DO $$
BEGIN
    IF _cafm_id_type() IS NULL THEN
        RAISE EXCEPTION
            'Table public.profiles does not exist. Run 01_schema.sql, 02_rls_policies.sql, 03_triggers_and_functions.sql and 04_seed_data.sql first.';
    END IF;
    RAISE NOTICE 'profiles.id is of type %', _cafm_id_type();
END $$;

-- ------------------------------------------------------------------------------
-- 1. PROFILES: detach from auth.users, add the columns the app actually sends
-- ------------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_id   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at    TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS department    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone         TEXT;

-- Give id a generator that matches its column type, so the database can create
-- an id if the app ever omits one.
DO $$
DECLARE
    v_type TEXT := _cafm_id_type();
BEGIN
    IF v_type = 'uuid' THEN
        EXECUTE 'ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4()';
    ELSE
        EXECUTE 'ALTER TABLE profiles ALTER COLUMN id SET DEFAULT uuid_generate_v4()::text';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipped setting a default for profiles.id (%). The app supplies its own ids, so this is harmless.', SQLERRM;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_employee_id_key'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_employee_id_key UNIQUE (employee_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add a UNIQUE constraint on employee_id (%). Duplicate employee ids may already exist.', SQLERRM;
END $$;

-- role_id must exist in roles before a profile can reference it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'roles') THEN
        INSERT INTO roles (id, name, description) VALUES
            ('admin',      'Administrator', 'Full system access'),
            ('fm_manager', 'FM Manager',    'Manage work orders, PPM, assets and reports'),
            ('supervisor', 'Supervisor',    'Assign and verify field work'),
            ('technician', 'Technician',    'Execute assigned work orders and PPM tasks')
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREDENTIALS TABLE - bcrypt hashes, never exposed to the browser
--    user_id is created with the SAME type as profiles.id so the foreign key
--    can actually be built (this is what failed on the first attempt).
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_type      TEXT := _cafm_id_type();
    v_existing  TEXT;
    v_rows      BIGINT;
    v_ddl       TEXT;
BEGIN
    v_ddl := format(
        'CREATE TABLE public.user_credentials (
             user_id       %s PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
             password_hash TEXT NOT NULL,
             updated_at    TIMESTAMPTZ DEFAULT NOW()
         )', v_type);

    SELECT format_type(a.atttypid, a.atttypmod) INTO v_existing
    FROM pg_attribute a
    JOIN pg_class     c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'user_credentials'
      AND a.attname = 'user_id' AND NOT a.attisdropped;

    IF v_existing IS NULL THEN
        EXECUTE v_ddl;
        RAISE NOTICE 'Created user_credentials with user_id %', v_type;

    ELSIF v_existing <> v_type THEN
        EXECUTE 'SELECT count(*) FROM public.user_credentials' INTO v_rows;
        IF v_rows > 0 THEN
            RAISE EXCEPTION
                'user_credentials.user_id is % but profiles.id is %, and the table already holds % row(s). Back it up and drop it, then re-run this file.',
                v_existing, v_type, v_rows;
        END IF;
        DROP TABLE public.user_credentials;
        EXECUTE v_ddl;
        RAISE NOTICE 'Rebuilt empty user_credentials with user_id % (was %)', v_type, v_existing;
    END IF;
END $$;

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
-- Deliberately NO policies: the table is unreachable from anon/authenticated.
-- Only the SECURITY DEFINER functions below can touch it.
REVOKE ALL ON user_credentials FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. AUTH RPCs (SECURITY DEFINER - bypass RLS in a controlled way)
--
--    Ids are passed as TEXT and compared with `id::text`, so these work whether
--    profiles.id is UUID or TEXT. Inserts use `SELECT p.id`, which yields the
--    column's native type.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS app_set_password(UUID, TEXT);
DROP FUNCTION IF EXISTS app_set_password(TEXT, TEXT);
DROP FUNCTION IF EXISTS app_set_password_by_email(TEXT, TEXT);

-- Verify credentials and return the caller's profile. Never returns the hash.
CREATE OR REPLACE FUNCTION app_login(p_identifier TEXT, p_password TEXT)
RETURNS SETOF profiles AS $$
DECLARE
    v_profile profiles;
    v_hash    TEXT;
BEGIN
    SELECT * INTO v_profile
    FROM profiles
    WHERE lower(email) = lower(trim(p_identifier))
       OR lower(coalesce(employee_id, '')) = lower(trim(p_identifier))
    LIMIT 1;

    IF v_profile.id IS NULL THEN
        RETURN;                      -- unknown user -> empty result
    END IF;

    IF v_profile.is_active IS FALSE THEN
        RETURN;                      -- deactivated user -> empty result
    END IF;

    SELECT password_hash INTO v_hash
    FROM user_credentials WHERE user_id = v_profile.id;

    IF v_hash IS NULL OR v_hash <> crypt(p_password, v_hash) THEN
        RETURN;                      -- wrong password -> empty result
    END IF;

    UPDATE profiles SET last_login_at = NOW() WHERE id = v_profile.id;

    RETURN QUERY SELECT * FROM profiles WHERE id = v_profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Set / reset a password. Used by the Users screen.
CREATE OR REPLACE FUNCTION app_set_password(p_user_id TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_rows INT;
BEGIN
    IF p_password IS NULL OR length(p_password) < 6 THEN
        RAISE EXCEPTION 'Password must be at least 6 characters';
    END IF;

    INSERT INTO user_credentials (user_id, password_hash, updated_at)
    SELECT p.id, crypt(p_password, gen_salt('bf')), NOW()
      FROM profiles p
     WHERE p.id::text = p_user_id
    ON CONFLICT (user_id) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            updated_at    = NOW();

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'User % does not exist', p_user_id;
    END IF;

    UPDATE profiles SET updated_at = NOW() WHERE id::text = p_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Same, addressed by email (used when the client only knows the email).
CREATE OR REPLACE FUNCTION app_set_password_by_email(p_email TEXT, p_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_id TEXT;
BEGIN
    SELECT id::text INTO v_id FROM profiles WHERE lower(email) = lower(trim(p_email));
    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No profile with email %', p_email;
    END IF;
    RETURN app_set_password(v_id, p_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION app_login(TEXT, TEXT)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_set_password(TEXT, TEXT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_set_password_by_email(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. RLS: replace every `TO authenticated` policy with one that also covers anon
--
--    The app enforces roles client-side and holds only the anon key, so the
--    anon role needs the same access the original policies intended to give
--    logged-in users. Passwords stay out of reach (section 2) regardless.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r        RECORD;
    v_tables TEXT[] := ARRAY[
        'roles','profiles','buildings','floors','locations','categories',
        'subcategories','sla_configs','assets','work_orders',
        'work_order_status_history','work_order_photos','work_order_comments',
        'materials','work_order_materials','material_transactions',
        'ppm_checklists','ppm_checklist_items','ppm_plans','ppm_schedules',
        'ppm_checklist_responses','ppm_photos','signatures','notifications',
        'audit_logs','system_settings'
    ];
    t TEXT;
BEGIN
    -- Drop every pre-existing policy on these tables
    FOR r IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY(v_tables)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    -- One permissive full-access policy per table, for anon AND authenticated
    FOREACH t IN ARRAY v_tables LOOP
        IF EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
                'cafm_app_access_' || t, t
            );
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t
            );
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. SEED THE FIVE STANDARD ACCOUNTS (ids match the app's built-in seed data)
--
--    Matched on email, so an account you already have keeps its existing id and
--    password - only its employee_id and active flag are filled in.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_type TEXT := _cafm_id_type();
    seed   RECORD;
BEGIN
    FOR seed IN
        SELECT * FROM (VALUES
            ('90000000-0000-0000-0000-000000000001', 'EMP-101', 'admin@shever.com',
             'Saif Al-Nuaimi (Admin)',          '+971 50 100 2000', 'admin',      'Executive Management'),
            ('90000000-0000-0000-0000-000000000002', 'EMP-102', 'manager@shever.com',
             'David Reynolds (FM Manager)',     '+971 50 200 3000', 'fm_manager', 'Facilities Operations'),
            ('90000000-0000-0000-0000-000000000003', 'EMP-103', 'supervisor@shever.com',
             'Hamad Al-Maktoum (Supervisor)',   '+971 50 300 4000', 'supervisor', 'MEP Operations'),
            ('90000000-0000-0000-0000-000000000004', 'EMP-104', 'technician@shever.com',
             'Rashid Khan (HVAC Technician)',   '+971 50 400 5000', 'technician', 'HVAC Maintenance'),
            ('90000000-0000-0000-0000-000000000005', 'EMP-105', 'tech.elec@shever.com',
             'Vikram Sharma (Electrical Tech)', '+971 50 500 6000', 'technician', 'Electrical Maintenance')
        ) AS t(id, employee_id, email, full_name, phone, role_id, department)
    LOOP
        IF EXISTS (SELECT 1 FROM profiles WHERE lower(email) = seed.email) THEN
            -- Account already present: leave its id and name alone, just make
            -- sure it has an employee_id to sign in with and is enabled.
            UPDATE profiles p
               SET employee_id = CASE
                       WHEN p.employee_id IS NOT NULL THEN p.employee_id
                       WHEN EXISTS (SELECT 1 FROM profiles o
                                     WHERE o.employee_id = seed.employee_id)
                            THEN NULL          -- id already taken by someone else
                       ELSE seed.employee_id
                   END,
                   is_active  = TRUE,
                   updated_at = NOW()
             WHERE lower(p.email) = seed.email;
        ELSE
            EXECUTE format(
                'INSERT INTO profiles
                     (id, employee_id, email, full_name, phone, role_id, department, is_active)
                 VALUES (%L::%s, %L, %L, %L, %L, %L, %L, TRUE)
                 ON CONFLICT (id) DO NOTHING',
                seed.id, v_type, seed.employee_id, seed.email,
                seed.full_name, seed.phone, seed.role_id, seed.department);
        END IF;
    END LOOP;
END $$;

-- Give each account the default password ONLY if it has none yet.
-- Re-running this file never overwrites a password you already changed.
DO $$
DECLARE
    v_id TEXT;
BEGIN
    FOR v_id IN
        SELECT p.id::text FROM profiles p
        LEFT JOIN user_credentials c ON c.user_id = p.id
        WHERE c.user_id IS NULL
    LOOP
        PERFORM app_set_password(v_id, 'Password123!');
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. SYSTEM SETTINGS: make sure the single settings row exists
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings')
       AND NOT EXISTS (SELECT 1 FROM system_settings) THEN
        INSERT INTO system_settings DEFAULT VALUES;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create the default system_settings row (%). The app falls back to its built-in defaults.', SQLERRM;
END $$;

DROP FUNCTION IF EXISTS _cafm_id_type();

-- ==============================================================================
-- VERIFY - all three numbers should be greater than zero
-- ==============================================================================
SELECT 'profiles in cloud'      AS check_name, count(*)::text AS value FROM profiles
UNION ALL
SELECT 'accounts with password', count(*)::text FROM user_credentials
UNION ALL
SELECT 'tables opened to app',   count(*)::text FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'cafm_app_access_%';
