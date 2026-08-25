-- ==============================================================================
-- SHEVER CAFM - SCHEMA INSPECTION
--
-- Read-only. Changes nothing.
--
-- Written as ONE query on purpose: the Supabase SQL Editor only displays the
-- result of the last statement, so a file of separate SELECTs would hide most
-- of its own output.
--
-- Run it, then copy the whole result grid.
-- ==============================================================================

WITH expected(tbl) AS (
    VALUES ('roles'),('profiles'),('buildings'),('floors'),('locations'),
           ('categories'),('subcategories'),('sla_configs'),('assets'),
           ('work_orders'),('work_order_status_history'),('work_order_photos'),
           ('work_order_comments'),('materials'),('work_order_materials'),
           ('material_transactions'),('ppm_checklists'),('ppm_checklist_items'),
           ('ppm_plans'),('ppm_schedules'),('ppm_checklist_responses'),
           ('ppm_photos'),('signatures'),('notifications'),('audit_logs'),
           ('system_settings')
)

-- A. Which of the tables the app needs are present, and which are missing
SELECT
    '1_TABLE'                                             AS section,
    e.tbl                                                 AS name,
    CASE WHEN t.tablename IS NULL
         THEN '*** MISSING ***'
         ELSE 'present, rls=' || t.rowsecurity::text
              || ', policies=' || (SELECT count(*) FROM pg_policies p
                                    WHERE p.schemaname = 'public'
                                      AND p.tablename  = e.tbl)::text
    END                                                   AS detail
FROM expected e
LEFT JOIN pg_tables t
       ON t.schemaname = 'public' AND t.tablename = e.tbl

UNION ALL

-- B. Any extra public tables that are NOT in the expected list
SELECT '2_EXTRA_TABLE', t.tablename, 'exists but the app does not know it'
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename NOT IN (SELECT tbl FROM expected)

UNION ALL

-- C. Column types for the tables that matter most
SELECT '3_COLUMN',
       c.table_name || '.' || c.column_name,
       c.data_type || CASE WHEN c.column_default IS NOT NULL
                           THEN '  default=' || c.column_default ELSE '' END
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('profiles', 'user_credentials', 'system_settings')

UNION ALL

-- D. Which Postgres roles each policy grants access to.
--    The app connects with the anon key, so anything listing only
--    {authenticated} is invisible to it.
SELECT '4_POLICY',
       p.tablename || ' / ' || p.policyname,
       'roles=' || p.roles::text || '  cmd=' || p.cmd
FROM pg_policies p
WHERE p.schemaname = 'public'

UNION ALL

-- E. Do the login / password functions exist?
SELECT '5_FUNCTION',
       pr.proname,
       pg_get_function_identity_arguments(pr.oid)
FROM pg_proc pr
JOIN pg_namespace n ON n.oid = pr.pronamespace
WHERE n.nspname = 'public'
  AND pr.proname IN ('app_login', 'app_set_password', 'app_set_password_by_email')

ORDER BY section, name;
