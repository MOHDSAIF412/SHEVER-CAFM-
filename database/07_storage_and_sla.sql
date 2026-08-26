-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - CAFM
-- 07_STORAGE_AND_SLA.SQL
--
-- Adds what the three new features need:
--   1. A Storage bucket for work-order photos. Photos used to be base64
--      encoded into a text column, which bloats every row and breaks once a
--      couple of phone pictures go in. They are now real files.
--   2. Deadlines on work orders. resolution_due_at was on the table but nothing
--      ever filled it in, so the SLA countdown had nothing to count.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Run 05 and 06 first. Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PHOTO STORAGE BUCKET
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'work-order-photos',
    'work-order-photos',
    TRUE,                                   -- public read, so <img src> works
    10485760,                               -- 10 MB per file
    ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO UPDATE
    SET public             = TRUE,
        file_size_limit    = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The app holds only the anon key, so anon needs to read and write this bucket.
DROP POLICY IF EXISTS "cafm photos readable"   ON storage.objects;
DROP POLICY IF EXISTS "cafm photos insertable" ON storage.objects;
DROP POLICY IF EXISTS "cafm photos deletable"  ON storage.objects;

CREATE POLICY "cafm photos readable" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'work-order-photos');

CREATE POLICY "cafm photos insertable" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'work-order-photos');

CREATE POLICY "cafm photos deletable" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'work-order-photos');

-- ------------------------------------------------------------------------------
-- 2. WORK ORDER PHOTO COLUMNS (harmless if 06 already added them)
-- ------------------------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS before_photo_url TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS after_photo_url  TEXT;

-- ------------------------------------------------------------------------------
-- 3. SLA DEADLINES
--
--    A work order's response and resolution deadlines are derived from the SLA
--    row matching its priority, at the moment it is raised.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_sla_targets()
RETURNS TRIGGER AS $$
DECLARE
    v_response INTEGER;
    v_hours    NUMERIC;
BEGIN
    SELECT response_time_minutes, resolution_time_hours
      INTO v_response, v_hours
      FROM sla_configs
     WHERE id = NEW.priority;

    -- Unknown priority: fall back to a working day rather than leaving it null,
    -- so the countdown always has something to measure against.
    IF v_hours IS NULL THEN
        v_response := 60;
        v_hours    := 24;
    END IF;

    IF NEW.response_due_at IS NULL THEN
        NEW.response_due_at := COALESCE(NEW.created_at, NOW()) + (v_response || ' minutes')::interval;
    END IF;

    IF NEW.resolution_due_at IS NULL THEN
        NEW.resolution_due_at := COALESCE(NEW.created_at, NOW()) + (v_hours || ' hours')::interval;
    END IF;

    IF NEW.target_completion_at IS NULL THEN
        NEW.target_completion_at := NEW.resolution_due_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_sla_targets ON work_orders;
CREATE TRIGGER trg_apply_sla_targets
    BEFORE INSERT ON work_orders
    FOR EACH ROW EXECUTE FUNCTION apply_sla_targets();

-- Backfill anything already raised without a deadline.
UPDATE work_orders w
   SET response_due_at = COALESCE(
           w.response_due_at,
           w.created_at + ((SELECT response_time_minutes FROM sla_configs s WHERE s.id = w.priority) || ' minutes')::interval
       ),
       resolution_due_at = COALESCE(
           w.resolution_due_at,
           w.created_at + ((SELECT resolution_time_hours FROM sla_configs s WHERE s.id = w.priority) || ' hours')::interval
       )
 WHERE (w.response_due_at IS NULL OR w.resolution_due_at IS NULL)
   AND EXISTS (SELECT 1 FROM sla_configs s WHERE s.id = w.priority);

UPDATE work_orders
   SET target_completion_at = resolution_due_at
 WHERE target_completion_at IS NULL AND resolution_due_at IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. BREACH FLAG
--    Marks open work orders whose resolution deadline has passed. Call it from
--    the app, or schedule it with pg_cron if that extension is enabled.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION flag_sla_breaches()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE work_orders
       SET is_overdue = TRUE,
           updated_at = NOW()
     WHERE resolution_due_at < NOW()
       AND is_overdue IS DISTINCT FROM TRUE
       AND status NOT IN ('Completed', 'Closed', 'Cancelled');

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION flag_sla_breaches() TO anon, authenticated;

SELECT flag_sla_breaches() AS work_orders_flagged_overdue;

-- ==============================================================================
-- VERIFY
-- ==============================================================================
SELECT 'photo bucket' AS check_name,
       CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'work-order-photos')
            THEN 'ready' ELSE '*** MISSING ***' END AS value
UNION ALL
SELECT 'photo storage policies',
       count(*)::text FROM pg_policies
       WHERE schemaname = 'storage' AND policyname LIKE 'cafm photos%'
UNION ALL
SELECT 'sla levels defined', count(*)::text FROM sla_configs
UNION ALL
SELECT 'work orders missing a deadline',
       count(*)::text FROM work_orders WHERE resolution_due_at IS NULL;
