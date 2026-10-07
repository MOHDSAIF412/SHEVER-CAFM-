-- ==============================================================================
-- OCS CAFM - 13_PPM_SCHEDULING.SQL
-- Step 7: PPM plans generate PPM work orders automatically.
--
--   * A plan = asset (or room) + checklist + frequency + start date.
--   * Every day (pg_cron, 05:00 UAE) cafm_generate_ppm_jobs() creates a PPM
--     work order for each visit falling due within the plan's lead time, with
--     the checklist attached, deadlines set to the due date, and the plan's
--     technician assigned. It can also be run on demand from the app.
--   * One job per plan per due date (unique index), so running it twice never
--     duplicates. Visits more than 7 days in the past are skipped, so a plan
--     with an old start date does not flood the list.
--
-- The old ppm_schedules table is no longer used (it held no data).
-- Additive except for the frequency check on the empty ppm_plans table.
-- ==============================================================================

ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS floor_id TEXT REFERENCES floors(id) ON DELETE SET NULL;
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS lead_days INTEGER DEFAULT 7 CHECK (lead_days BETWEEN 0 AND 60);
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS sla_priority TEXT DEFAULT 'P4' CHECK (sla_priority IN ('P1','P2','P3','P4'));
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS est_hours NUMERIC(6,2);
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE ppm_plans ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMPTZ;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ppm_plans_frequency_check') THEN
        ALTER TABLE ppm_plans ADD CONSTRAINT ppm_plans_frequency_check CHECK (frequency IN
            ('Weekly','Fortnightly','Monthly','Bi-Monthly','Quarterly','Half-Yearly','Yearly','Custom'));
    END IF;
END $$;

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS ppm_plan_id TEXT REFERENCES ppm_plans(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS ppm_due_date DATE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wo_ppm_visit ON work_orders (ppm_plan_id, ppm_due_date) WHERE ppm_plan_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- Next due date for a frequency
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_ppm_next(p_date DATE, p_freq TEXT, p_days INTEGER)
RETURNS DATE LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT CASE p_freq
        WHEN 'Weekly'      THEN p_date + 7
        WHEN 'Fortnightly' THEN p_date + 14
        WHEN 'Monthly'     THEN (p_date + INTERVAL '1 month')::date
        WHEN 'Bi-Monthly'  THEN (p_date + INTERVAL '2 months')::date
        WHEN 'Quarterly'   THEN (p_date + INTERVAL '3 months')::date
        WHEN 'Half-Yearly' THEN (p_date + INTERVAL '6 months')::date
        WHEN 'Yearly'      THEN (p_date + INTERVAL '1 year')::date
        ELSE p_date + GREATEST(COALESCE(p_days, 30), 1)
    END;
$$;

-- ------------------------------------------------------------------------------
-- Generate due PPM jobs (all plans, or one plan)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_generate_ppm_jobs(p_plan_id TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    p RECORD;
    v_due DATE;
    v_loc RECORD;
    v_cat TEXT;
    v_created INTEGER := 0;
    v_guard INTEGER;
    v_tz CONSTANT TEXT := 'Asia/Dubai';
    v_today DATE := (NOW() AT TIME ZONE 'Asia/Dubai')::date;
BEGIN
    -- From the app only supervisors and above may run it; the scheduler runs
    -- without a user and is always allowed.
    IF auth.uid() IS NOT NULL AND NOT cafm_has_role('admin', 'fm_manager', 'supervisor') THEN
        RAISE EXCEPTION 'Only supervisors and managers can generate PPM jobs.' USING ERRCODE = 'insufficient_privilege';
    END IF;

    FOR p IN
        SELECT pl.*, a.location_id AS a_location, a.category_id AS a_category, a.facility_id AS a_facility
          FROM ppm_plans pl
          LEFT JOIN assets a ON a.id = pl.asset_id
         WHERE COALESCE(pl.is_active, TRUE)
           AND (p_plan_id IS NULL OR pl.id = p_plan_id)
    LOOP
        SELECT l.id, l.floor_id, l.zone_id, f.building_id, b.facility_id INTO v_loc
          FROM locations l JOIN floors f ON f.id = l.floor_id JOIN buildings b ON b.id = f.building_id
         WHERE l.id = COALESCE(p.location_id, p.a_location);
        IF v_loc.id IS NULL THEN CONTINUE; END IF;   -- plan has no place yet
        v_cat := COALESCE(p.category_id, p.a_category, (SELECT id FROM categories ORDER BY name LIMIT 1));

        v_due := p.next_due_date;
        v_guard := 0;
        WHILE v_due <= v_today + COALESCE(p.lead_days, 7)
          AND (p.end_date IS NULL OR v_due <= p.end_date)
          AND v_guard < 400
        LOOP
            v_guard := v_guard + 1;
            IF v_due >= v_today - 7 THEN
                INSERT INTO work_orders (
                    id, wo_number, wo_type, source, status, ppm_plan_id, ppm_due_date, checklist_id,
                    problem_description, sla_priority, asset_id, location_id, floor_id, zone_id, building_id,
                    facility_id, category_id, assigned_technician_id, assigned_supervisor_id, assigned_at,
                    reported_by_name, response_due_at, resolution_due_at, created_at, updated_at)
                VALUES (
                    gen_random_uuid()::text,
                    p.ppm_code || '-' || to_char(v_due, 'YYMMDD'),
                    'PPM', 'PPM',
                    CASE WHEN p.assigned_technician_id IS NOT NULL THEN 'Assigned' ELSE 'New' END,
                    p.id, v_due, p.checklist_id,
                    p.title || ' — ' || p.frequency || ' PPM due ' || to_char(v_due, 'DD Mon YYYY'),
                    COALESCE(p.sla_priority, 'P4'), p.asset_id, v_loc.id, v_loc.floor_id, v_loc.zone_id, v_loc.building_id,
                    COALESCE(p.facility_id, p.a_facility, v_loc.facility_id), v_cat,
                    p.assigned_technician_id, p.assigned_supervisor_id,
                    CASE WHEN p.assigned_technician_id IS NOT NULL THEN NOW() END,
                    'PPM scheduler',
                    -- Window: the visit may start on its due date and must be done by the end of it.
                    (v_due::timestamp + TIME '07:00') AT TIME ZONE v_tz,
                    (v_due::timestamp + TIME '23:59') AT TIME ZONE v_tz,
                    NOW(), NOW())
                ON CONFLICT (ppm_plan_id, ppm_due_date) WHERE ppm_plan_id IS NOT NULL DO NOTHING;
                IF FOUND THEN v_created := v_created + 1; END IF;
            END IF;
            v_due := cafm_ppm_next(v_due, p.frequency, p.custom_interval_days);
        END LOOP;

        UPDATE ppm_plans SET next_due_date = v_due, last_generated_at = NOW(), updated_at = NOW() WHERE id = p.id;
    END LOOP;
    RETURN v_created;
END $$;

REVOKE ALL ON FUNCTION cafm_generate_ppm_jobs(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cafm_generate_ppm_jobs(TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- Run it every day at 05:00 UAE (01:00 UTC)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cafm-generate-ppm-jobs';
SELECT cron.schedule('cafm-generate-ppm-jobs', '0 1 * * *', $$SELECT public.cafm_generate_ppm_jobs()$$);
