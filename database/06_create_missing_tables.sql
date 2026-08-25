-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - CAFM
-- 06_CREATE_MISSING_TABLES.SQL
--
-- Your database has only 5 of the 26 tables the app needs:
--     roles, profiles, buildings, categories, system_settings
--
-- Missing: assets, floors, locations, subcategories, sla_configs, work_orders
-- and all their children, materials, the whole PPM module, signatures,
-- notifications and audit_logs. That is why assets and work orders never
-- synced - there was nowhere to write them.
--
-- This file CREATES ONLY WHAT IS ABSENT. It never drops or empties an existing
-- table, so the profiles and passwords created by 05_cloud_sync_fix.sql are
-- left alone.
--
-- IT DOES NOT CREATE ANY BUILDINGS, FLOORS, LOCATIONS, ASSETS, WORK ORDERS OR
-- PPM PLANS. You add those in the app and they save to the cloud, where every
-- other device sees them. The tables start empty.
--
-- It DOES seed the reference data the app has no screen for - categories,
-- subcategories, SLA levels, a default PPM checklist and a starter stock list.
-- Without those the dropdowns are empty and nothing can be created at all.
--
-- Do NOT run 01_schema.sql instead: it begins with DROP TABLE ... CASCADE and
-- would destroy your accounts.
--
-- Ids are TEXT here, matching the convention this database already uses
-- (profiles.id is `text default (uuid_generate_v4())::text`). Foreign key
-- columns are built to match whatever type the table they point at actually
-- uses, so nothing can fail the way the first attempt did.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Run 05_cloud_sync_fix.sql FIRST if you have not already.
--   Safe to re-run.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 0. Helper: the real type of any column, so foreign keys always match
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _cafm_type(p_table TEXT, p_col TEXT) RETURNS TEXT AS $$
    SELECT format_type(a.atttypid, a.atttypmod)
    FROM pg_attribute a
    JOIN pg_class     c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = p_table
      AND a.attname = p_col
      AND NOT a.attisdropped;
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------------------------
-- 1. Top up the tables that DO exist with any columns the app expects
-- ------------------------------------------------------------------------------
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS code           TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS name           TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS address        TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS city           TEXT DEFAULT 'Dubai';
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS total_floors   INTEGER DEFAULT 1;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS contact_phone  TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE categories ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS code        TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon        TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active   BOOLEAN DEFAULT TRUE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS wo_prefix  TEXT DEFAULT 'WO';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS ppm_prefix TEXT DEFAULT 'PPM';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS notification_settings JSONB
    DEFAULT '{"email_enabled": true, "push_enabled": true, "sms_enabled": false}'::jsonb;

-- The plaintext password column is now dead weight AND a leak: the anon key can
-- read it. Real passwords live bcrypt-hashed in user_credentials.
ALTER TABLE profiles DROP COLUMN IF EXISTS password;

-- ------------------------------------------------------------------------------
-- 2. Create every missing table
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    t_profile  TEXT := coalesce(_cafm_type('profiles',   'id'), 'text');
    t_building TEXT := coalesce(_cafm_type('buildings',  'id'), 'text');
    t_category TEXT := coalesce(_cafm_type('categories', 'id'), 'text');
BEGIN
    ---------------------------------------------------------------- facilities
    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS floors (
            id             TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            building_id    %s NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
            floor_number   INTEGER NOT NULL,
            name           TEXT NOT NULL,
            floor_plan_url TEXT,
            created_at     TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_building_floor UNIQUE (building_id, floor_number)
        )$ddl$, t_building);

    CREATE TABLE IF NOT EXISTS locations (
        id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        floor_id    TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
        code        TEXT NOT NULL,
        name        TEXT NOT NULL,
        room_number TEXT,
        zone        TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_floor_location UNIQUE (floor_id, code)
    );

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS subcategories (
            id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            category_id %s NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            code        TEXT NOT NULL,
            description TEXT,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_category_subcategory UNIQUE (category_id, code)
        )$ddl$, t_category);

    ----------------------------------------------------------------------- SLA
    CREATE TABLE IF NOT EXISTS sla_configs (
        id                    TEXT PRIMARY KEY,
        priority              TEXT NOT NULL UNIQUE,
        response_time_minutes INTEGER NOT NULL,
        resolution_time_hours NUMERIC(6,2) NOT NULL,
        color_hex             TEXT DEFAULT '#3B82F6',
        description           TEXT,
        updated_at            TIMESTAMPTZ DEFAULT NOW()
    );

    -------------------------------------------------------------------- assets
    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS assets (
            id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            asset_number      TEXT UNIQUE NOT NULL,
            name              TEXT NOT NULL,
            type              TEXT,
            category_id       %s REFERENCES categories(id) ON DELETE RESTRICT,
            subcategory_id    TEXT REFERENCES subcategories(id) ON DELETE RESTRICT,
            manufacturer      TEXT,
            model             TEXT,
            serial_number     TEXT,
            building_id       %s REFERENCES buildings(id) ON DELETE RESTRICT,
            floor_id          TEXT REFERENCES floors(id) ON DELETE RESTRICT,
            location_id       TEXT REFERENCES locations(id) ON DELETE RESTRICT,
            installation_date DATE,
            warranty_expiry   DATE,
            amc_start         DATE,
            amc_expiry        DATE,
            status            TEXT NOT NULL DEFAULT 'Active',
            criticality       TEXT NOT NULL DEFAULT 'Medium',
            qr_code_url       TEXT,
            photo_url         TEXT,
            specifications    JSONB DEFAULT '{}'::jsonb,
            created_at        TIMESTAMPTZ DEFAULT NOW(),
            updated_at        TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_category, t_building);

    --------------------------------------------------------------- work orders
    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS work_orders (
            id                      TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            wo_number               TEXT UNIQUE NOT NULL,
            reported_by             %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            reported_by_name        TEXT,
            reported_by_phone       TEXT,
            building_id             %2$s REFERENCES buildings(id) ON DELETE RESTRICT,
            floor_id                TEXT REFERENCES floors(id) ON DELETE RESTRICT,
            location_id             TEXT REFERENCES locations(id) ON DELETE RESTRICT,
            asset_id                TEXT REFERENCES assets(id) ON DELETE SET NULL,
            category_id             %3$s REFERENCES categories(id) ON DELETE RESTRICT,
            subcategory_id          TEXT REFERENCES subcategories(id) ON DELETE SET NULL,
            priority                TEXT NOT NULL DEFAULT 'Medium',
            problem_description     TEXT NOT NULL,
            status                  TEXT NOT NULL DEFAULT 'New',
            assigned_supervisor_id  %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            assigned_technician_id  %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            target_completion_at    TIMESTAMPTZ,
            response_due_at         TIMESTAMPTZ,
            resolution_due_at       TIMESTAMPTZ,
            is_overdue              BOOLEAN DEFAULT FALSE,
            accepted_at             TIMESTAMPTZ,
            started_at              TIMESTAMPTZ,
            completed_at            TIMESTAMPTZ,
            approved_at             TIMESTAMPTZ,
            closed_at               TIMESTAMPTZ,
            start_gps               JSONB,
            completion_gps          JSONB,
            response_time_minutes   INTEGER,
            resolution_time_minutes INTEGER,
            work_performed          TEXT,
            root_cause              TEXT,
            action_taken            TEXT,
            remarks                 TEXT,
            rejection_reason        TEXT,
            before_photo_url        TEXT,
            after_photo_url         TEXT,
            created_at              TIMESTAMPTZ DEFAULT NOW(),
            updated_at              TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile, t_building, t_category);

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS work_order_status_history (
            id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
            from_status   TEXT,
            to_status     TEXT NOT NULL,
            changed_by    %s REFERENCES profiles(id) ON DELETE SET NULL,
            comments      TEXT,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS work_order_photos (
            id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
            photo_type    TEXT NOT NULL,
            photo_url     TEXT NOT NULL,
            caption       TEXT,
            uploaded_by   %s REFERENCES profiles(id) ON DELETE SET NULL,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS work_order_comments (
            id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
            user_id       %s REFERENCES profiles(id) ON DELETE SET NULL,
            comment       TEXT NOT NULL,
            created_at    TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    ----------------------------------------------------------------- materials
    CREATE TABLE IF NOT EXISTS materials (
        id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        item_code         TEXT UNIQUE NOT NULL,
        name              TEXT NOT NULL,
        category          TEXT NOT NULL DEFAULT 'General',
        unit              TEXT NOT NULL DEFAULT 'pcs',
        quantity_in_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
        min_stock_level   NUMERIC(10,2) NOT NULL DEFAULT 5,
        unit_cost         NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        location          TEXT DEFAULT 'Central Store',
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS work_order_materials (
        id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        material_id   TEXT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
        quantity_used NUMERIC(10,2) NOT NULL,
        unit_cost     NUMERIC(10,2) NOT NULL,
        total_cost    NUMERIC(10,2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED,
        created_at    TIMESTAMPTZ DEFAULT NOW()
    );

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS material_transactions (
            id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            material_id      TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
            transaction_type TEXT NOT NULL,
            quantity         NUMERIC(10,2) NOT NULL,
            reference_type   TEXT,
            reference_id     TEXT,
            performed_by     %s REFERENCES profiles(id) ON DELETE SET NULL,
            notes            TEXT,
            created_at       TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    ----------------------------------------------------------------------- PPM
    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS ppm_checklists (
            id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            title       TEXT NOT NULL,
            category_id %s REFERENCES categories(id) ON DELETE RESTRICT,
            description TEXT,
            is_active   BOOLEAN DEFAULT TRUE,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_category);

    CREATE TABLE IF NOT EXISTS ppm_checklist_items (
        id               TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        checklist_id     TEXT NOT NULL REFERENCES ppm_checklists(id) ON DELETE CASCADE,
        item_order       INTEGER NOT NULL DEFAULT 1,
        task_description TEXT NOT NULL,
        field_type       TEXT NOT NULL DEFAULT 'pass_fail',
        unit_of_measure  TEXT,
        min_value        NUMERIC(10,2),
        max_value        NUMERIC(10,2),
        is_mandatory     BOOLEAN DEFAULT TRUE,
        dropdown_options JSONB DEFAULT '[]'::jsonb,
        created_at       TIMESTAMPTZ DEFAULT NOW()
    );

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS ppm_plans (
            id                     TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            ppm_code               TEXT UNIQUE NOT NULL,
            title                  TEXT NOT NULL,
            asset_id               TEXT REFERENCES assets(id) ON DELETE CASCADE,
            building_id            %2$s REFERENCES buildings(id) ON DELETE RESTRICT,
            location_id            TEXT REFERENCES locations(id) ON DELETE RESTRICT,
            category_id            %3$s REFERENCES categories(id) ON DELETE RESTRICT,
            checklist_id           TEXT REFERENCES ppm_checklists(id) ON DELETE RESTRICT,
            frequency              TEXT NOT NULL DEFAULT 'Monthly',
            custom_interval_days   INTEGER,
            start_date             DATE NOT NULL DEFAULT CURRENT_DATE,
            next_due_date          DATE NOT NULL DEFAULT CURRENT_DATE,
            assigned_technician_id %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            assigned_supervisor_id %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            is_active              BOOLEAN DEFAULT TRUE,
            created_at             TIMESTAMPTZ DEFAULT NOW(),
            updated_at             TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile, t_building, t_category);

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS ppm_schedules (
            id                     TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            schedule_number        TEXT UNIQUE NOT NULL,
            ppm_plan_id            TEXT NOT NULL REFERENCES ppm_plans(id) ON DELETE CASCADE,
            due_date               DATE NOT NULL,
            status                 TEXT NOT NULL DEFAULT 'Scheduled',
            assigned_technician_id %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            assigned_supervisor_id %1$s REFERENCES profiles(id) ON DELETE SET NULL,
            started_at             TIMESTAMPTZ,
            completed_at           TIMESTAMPTZ,
            approved_at            TIMESTAMPTZ,
            remarks                TEXT,
            is_overdue             BOOLEAN DEFAULT FALSE,
            created_at             TIMESTAMPTZ DEFAULT NOW(),
            updated_at             TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    CREATE TABLE IF NOT EXISTS ppm_checklist_responses (
        id                TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        ppm_schedule_id   TEXT NOT NULL REFERENCES ppm_schedules(id) ON DELETE CASCADE,
        checklist_item_id TEXT NOT NULL REFERENCES ppm_checklist_items(id) ON DELETE CASCADE,
        result_status     TEXT,
        numeric_value     NUMERIC(10,2),
        text_response     TEXT,
        remarks           TEXT,
        photo_url         TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_schedule_item UNIQUE (ppm_schedule_id, checklist_item_id)
    );

    CREATE TABLE IF NOT EXISTS ppm_photos (
        id              TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        ppm_schedule_id TEXT NOT NULL REFERENCES ppm_schedules(id) ON DELETE CASCADE,
        photo_url       TEXT NOT NULL,
        caption         TEXT,
        uploaded_at     TIMESTAMPTZ DEFAULT NOW()
    );

    --------------------------------------------- signatures / notifications / audit
    CREATE TABLE IF NOT EXISTS signatures (
        id                 TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
        entity_type        TEXT NOT NULL,
        entity_id          TEXT NOT NULL,
        signature_type     TEXT NOT NULL,
        signer_name        TEXT NOT NULL,
        signature_data_url TEXT NOT NULL,
        signed_at          TIMESTAMPTZ DEFAULT NOW()
    );

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            user_id     %s REFERENCES profiles(id) ON DELETE CASCADE,
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            entity_type TEXT,
            entity_id   TEXT,
            is_read     BOOLEAN DEFAULT FALSE,
            created_at  TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);

    EXECUTE format($ddl$
        CREATE TABLE IF NOT EXISTS audit_logs (
            id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
            user_id    %s REFERENCES profiles(id) ON DELETE SET NULL,
            user_email TEXT,
            action     TEXT NOT NULL,
            module     TEXT NOT NULL,
            record_id  TEXT,
            old_values JSONB,
            new_values JSONB,
            ip_address TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )$ddl$, t_profile);
END $$;

-- ------------------------------------------------------------------------------
-- 3. Open every table to the app (same rule 05 applied to the 5 that existed)
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
    FOR r IN
        SELECT policyname, tablename FROM pg_policies
        WHERE schemaname = 'public' AND tablename = ANY(v_tables)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    FOREACH t IN ARRAY v_tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
                'cafm_app_access_' || t, t);
            EXECUTE format(
                'GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. SLA levels - work_orders.priority expects these to exist
-- ------------------------------------------------------------------------------
INSERT INTO sla_configs (id, priority, response_time_minutes, resolution_time_hours, color_hex, description) VALUES
    ('Emergency', 'Emergency',  15, 4,   '#DC2626', 'Safety or business-critical failure'),
    ('High',      'High',       30, 8,   '#EA580C', 'Major service affected'),
    ('Medium',    'Medium',     60, 24,  '#CA8A04', 'Standard maintenance request'),
    ('Low',       'Low',       240, 72,  '#2563EB', 'Cosmetic or low-impact issue')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. Reference data ONLY
--
--    Buildings, floors, locations, assets, work orders and PPM plans are NOT
--    seeded - you create those in the app and they save to the cloud.
--
--    What is seeded below is reference data the app has no screen for. Without
--    it every dropdown is empty and nothing can be created at all:
--      * categories / subcategories - chosen when adding an asset or work order
--      * sla_configs               - work_orders.priority points at it
--      * ppm_checklists            - every PPM plan must reference one
--      * materials                 - the Materials page is read-only
--
--    Each block runs only if that table is empty, so nothing is duplicated and
--    re-running changes nothing.
-- ------------------------------------------------------------------------------

-- 5a. Categories, if you have none at all
INSERT INTO categories (name, code, description, icon)
SELECT * FROM (VALUES
    ('HVAC',                  'HVAC',  'Heating, Ventilation & Air Conditioning',    'Wind'),
    ('Electrical',            'ELEC',  'Power distribution, lighting, generators',   'Zap'),
    ('Plumbing',              'PLUMB', 'Water supply, drainage, booster pumps',      'Droplet'),
    ('Civil & Carpentry',     'CIVIL', 'Doors, ceilings, locks, painting, masonry',  'Hammer'),
    ('Fire & Life Safety',    'FLS',   'Fire alarms, pumps, sprinklers',             'Flame'),
    ('Elevators & Escalators','ELEV',  'Passenger and freight elevators',            'MoveVertical')
) AS v(name, code, description, icon)
WHERE NOT EXISTS (SELECT 1 FROM categories);

-- 5b. Subcategories for each category that exists but has none
INSERT INTO subcategories (category_id, name, code)
SELECT c.id, v.name, v.code
FROM categories c
JOIN (VALUES
    ('HVAC',  'Air Handling Unit (AHU)',       'AHU'),
    ('HVAC',  'Fan Coil Unit (FCU)',           'FCU'),
    ('HVAC',  'Chiller Plant',                 'CHILL'),
    ('ELEC',  'Main Distribution Board (MDB)', 'MDB'),
    ('ELEC',  'Diesel Generator',              'GEN'),
    ('ELEC',  'Lighting Circuit',              'LIGHT'),
    ('PLUMB', 'Booster & Transfer Pump',       'PUMP'),
    ('PLUMB', 'Sanitary Fixtures',             'SAN'),
    ('CIVIL', 'Doors & Locks',                 'DOOR'),
    ('FLS',   'Fire Alarm Panel',              'FAP'),
    ('FLS',   'Sprinkler System',              'SPRINK'),
    ('ELEV',  'Passenger Elevator',            'PASS')
) AS v(cat_code, name, code) ON v.cat_code = c.code
WHERE NOT EXISTS (SELECT 1 FROM subcategories s WHERE s.category_id = c.id AND s.code = v.code);

-- 5c. A default PPM checklist per category, so PPM plans can be created
INSERT INTO ppm_checklists (title, category_id, description)
SELECT c.name || ' - Standard Inspection', c.id, 'Default checklist created by 06_create_missing_tables.sql'
FROM categories c
WHERE NOT EXISTS (SELECT 1 FROM ppm_checklists k WHERE k.category_id = c.id);

INSERT INTO ppm_checklist_items (checklist_id, item_order, task_description, field_type)
SELECT k.id, v.ord, v.task, v.ftype
FROM ppm_checklists k
JOIN (VALUES
    (1, 'Visual inspection for damage or leaks', 'pass_fail'),
    (2, 'Check and record operating readings',   'numeric_reading'),
    (3, 'Clean and tighten connections',         'pass_fail'),
    (4, 'Photograph the equipment after work',   'photo_required')
) AS v(ord, task, ftype) ON TRUE
WHERE NOT EXISTS (SELECT 1 FROM ppm_checklist_items i WHERE i.checklist_id = k.id);

-- 5d. A starter stock list, if you have no materials.
--     The Materials page is read-only, so anything you want listed there has to
--     be inserted here or through the Supabase table editor.
INSERT INTO materials (item_code, name, category, unit, quantity_in_stock, min_stock_level, unit_cost)
SELECT * FROM (VALUES
    ('MAT-ELE-001', 'LED 18W Downlight',            'Electrical', 'pcs',    120, 20, 28.50),
    ('MAT-ELE-002', 'MCB 32A Single Pole',          'Electrical', 'pcs',     45, 10, 42.00),
    ('MAT-HVA-001', 'AHU Air Filter G4 24x24',      'HVAC',       'pcs',     60, 15, 65.00),
    ('MAT-HVA-002', 'V-Belt A-Section',             'HVAC',       'pcs',     30,  8, 38.75),
    ('MAT-PLM-001', 'PPR Pipe 25mm',                'Plumbing',   'meters', 200, 50, 12.25),
    ('MAT-PLM-002', 'Ball Valve 1 inch Brass',      'Plumbing',   'pcs',     25,  6, 55.00)
) AS v(item_code, name, category, unit, quantity_in_stock, min_stock_level, unit_cost)
WHERE NOT EXISTS (SELECT 1 FROM materials);

DROP FUNCTION IF EXISTS _cafm_type(TEXT, TEXT);

-- ==============================================================================
-- VERIFY
--   "tables the app can reach" must read 26 and "still missing" must read none.
--   buildings / floors / locations / assets / work_orders reading 0 is correct:
--   you create those in the app.
-- ==============================================================================
SELECT 'tables the app can reach' AS check_name,
       count(*)::text             AS value
FROM pg_policies
WHERE schemaname = 'public' AND policyname LIKE 'cafm_app_access_%'
UNION ALL SELECT 'still missing', coalesce(string_agg(m.tbl, ', '), 'none')
FROM (VALUES ('roles'),('profiles'),('buildings'),('floors'),('locations'),
             ('categories'),('subcategories'),('sla_configs'),('assets'),
             ('work_orders'),('work_order_status_history'),('work_order_photos'),
             ('work_order_comments'),('materials'),('work_order_materials'),
             ('material_transactions'),('ppm_checklists'),('ppm_checklist_items'),
             ('ppm_plans'),('ppm_schedules'),('ppm_checklist_responses'),
             ('ppm_photos'),('signatures'),('notifications'),('audit_logs'),
             ('system_settings')) AS m(tbl)
WHERE NOT EXISTS (SELECT 1 FROM pg_tables p WHERE p.schemaname='public' AND p.tablename=m.tbl)
UNION ALL SELECT 'profiles',      count(*)::text FROM profiles
UNION ALL SELECT 'buildings',     count(*)::text FROM buildings
UNION ALL SELECT 'floors',        count(*)::text FROM floors
UNION ALL SELECT 'locations',     count(*)::text FROM locations
UNION ALL SELECT 'categories',    count(*)::text FROM categories
UNION ALL SELECT 'subcategories', count(*)::text FROM subcategories
UNION ALL SELECT 'sla_configs',   count(*)::text FROM sla_configs
UNION ALL SELECT 'materials',     count(*)::text FROM materials
UNION ALL SELECT 'assets',        count(*)::text FROM assets
UNION ALL SELECT 'work_orders',   count(*)::text FROM work_orders;
