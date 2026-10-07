-- ==============================================================================
-- OCS CAFM - 11_WORK_ORDER_ENGINE.SQL
-- Step 5: the work-order engine, redesigned from the OCS ABi reference but
-- simpler.
--
-- Status flow:  New -> Assigned -> In Progress -> Work Done -> Completed -> Closed
--               (On Hold pauses the SLA; Cancelled is a side exit)
--
--   * Service Matrix: Service Group -> Service Type -> Job Type. Picking a job
--     type fills trade, category and default priority on a new work order.
--   * Three SLA clocks per priority: Response (arrive), Restoration (make safe /
--     temporary fix) and Resolution (permanent fix), computed on insert from
--     sla_policies (contract-specific first, else default).
--   * On Hold stops the clock: on resume, every open due date moves forward by
--     the time spent on hold, and the pause is logged in wo_sla_pauses.
--   * Time log entries are Travel or Labour.
--
-- Additive. Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SERVICE MATRIX
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_groups (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    group_id TEXT NOT NULL REFERENCES service_groups(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    trade_code TEXT,                           -- matches trades.code
    category_id TEXT,                          -- legacy categories(id) for older screens
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    service_type_id TEXT NOT NULL REFERENCES service_types(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_ar TEXT,
    default_priority TEXT DEFAULT 'P3' CHECK (default_priority IN ('P1','P2','P3','P4')),
    checklist_id TEXT,                         -- ppm_checklists(id), optional
    est_hours NUMERIC(6,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. WORK ORDER + SLA COLUMNS
-- ------------------------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS job_type_id TEXT REFERENCES job_types(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS restoration_due_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_done_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS on_hold_since TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_rating INTEGER CHECK (client_rating BETWEEN 1 AND 5);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_signature_url TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_comment TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_created ON work_orders(created_at DESC);

ALTER TABLE sla_policies ADD COLUMN IF NOT EXISTS restoration_minutes INTEGER;
ALTER TABLE sla_policies ADD COLUMN IF NOT EXISTS pause_on_hold BOOLEAN DEFAULT TRUE;

UPDATE sla_policies SET restoration_minutes = CASE priority
    WHEN 'P1' THEN 120 WHEN 'P2' THEN 480 WHEN 'P3' THEN 1440 ELSE NULL END
 WHERE contract_id IS NULL AND restoration_minutes IS NULL;

ALTER TABLE wo_labour ADD COLUMN IF NOT EXISTS record_type TEXT DEFAULT 'Labour'
    CHECK (record_type IN ('Travel', 'Labour'));
ALTER TABLE wo_labour ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- 3. SLA TARGETS ON INSERT
-- ------------------------------------------------------------------------------
-- Legacy priorities (Emergency/High/Medium/Low) still arrive from older screens
-- and the mobile app; map them onto P1-P4 so every job gets the same clocks.
CREATE OR REPLACE FUNCTION apply_sla_targets()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_policy sla_policies%ROWTYPE;
    v_start  TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
    IF NEW.sla_priority IS NULL THEN
        NEW.sla_priority := CASE NEW.priority
            WHEN 'Emergency' THEN 'P1' WHEN 'High' THEN 'P2'
            WHEN 'Low' THEN 'P4' ELSE 'P3' END;
    END IF;
    IF NEW.priority IS NULL OR NEW.priority NOT IN ('Emergency','High','Medium','Low') THEN
        NEW.priority := CASE NEW.sla_priority
            WHEN 'P1' THEN 'Emergency' WHEN 'P2' THEN 'High'
            WHEN 'P4' THEN 'Low' ELSE 'Medium' END;
    END IF;

    SELECT * INTO v_policy FROM sla_policies
     WHERE priority = NEW.sla_priority
       AND (contract_id = NEW.contract_id OR contract_id IS NULL)
     ORDER BY contract_id NULLS LAST
     LIMIT 1;

    IF FOUND THEN
        NEW.sla_policy_id := COALESCE(NEW.sla_policy_id, v_policy.id);
        NEW.response_due_at := COALESCE(NEW.response_due_at, v_start + make_interval(mins => v_policy.response_minutes));
        IF v_policy.restoration_minutes IS NOT NULL THEN
            NEW.restoration_due_at := COALESCE(NEW.restoration_due_at, v_start + make_interval(mins => v_policy.restoration_minutes));
        END IF;
        NEW.resolution_due_at := COALESCE(NEW.resolution_due_at, v_start + make_interval(mins => v_policy.resolution_minutes));
    ELSE
        NEW.response_due_at := COALESCE(NEW.response_due_at, v_start + INTERVAL '60 minutes');
        NEW.resolution_due_at := COALESCE(NEW.resolution_due_at, v_start + INTERVAL '24 hours');
    END IF;

    NEW.target_completion_at := COALESCE(NEW.target_completion_at, NEW.resolution_due_at);
    RETURN NEW;
END $$;

-- ------------------------------------------------------------------------------
-- 4. STATUS TIMESTAMPS + ON-HOLD PAUSE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_wo_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_paused INTERVAL;
    v_pause_enabled BOOLEAN := TRUE;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    -- Entering hold: start the pause.
    IF NEW.status = 'On Hold' THEN
        NEW.on_hold_since := COALESCE(NEW.on_hold_since, NOW());
        INSERT INTO wo_sla_pauses (work_order_id, reason, note, paused_at)
        VALUES (NEW.id,
                CASE WHEN NEW.hold_reason IN ('Awaiting Parts','Awaiting Access','Awaiting Client Approval') THEN NEW.hold_reason ELSE 'Other' END,
                NEW.hold_reason, NEW.on_hold_since);
    END IF;

    -- Leaving hold: push the open deadlines forward by the paused time.
    IF OLD.status = 'On Hold' AND OLD.on_hold_since IS NOT NULL THEN
        SELECT COALESCE(pause_on_hold, TRUE) INTO v_pause_enabled FROM sla_policies WHERE id = NEW.sla_policy_id;
        v_paused := NOW() - OLD.on_hold_since;
        IF COALESCE(v_pause_enabled, TRUE) THEN
            IF NEW.arrived_at IS NULL THEN NEW.response_due_at := NEW.response_due_at + v_paused; END IF;
            IF NEW.restored_at IS NULL AND NEW.restoration_due_at IS NOT NULL THEN NEW.restoration_due_at := NEW.restoration_due_at + v_paused; END IF;
            IF NEW.work_done_at IS NULL THEN NEW.resolution_due_at := NEW.resolution_due_at + v_paused; END IF;
            NEW.target_completion_at := NEW.resolution_due_at;
        END IF;
        NEW.sla_paused_minutes := COALESCE(NEW.sla_paused_minutes, 0) + (EXTRACT(EPOCH FROM v_paused) / 60)::INTEGER;
        UPDATE wo_sla_pauses SET resumed_at = NOW()
         WHERE work_order_id = NEW.id AND resumed_at IS NULL;
        NEW.on_hold_since := NULL;
    END IF;

    -- Milestones (first time only).
    IF NEW.status = 'Assigned' THEN NEW.assigned_at := COALESCE(NEW.assigned_at, NOW()); END IF;
    IF NEW.status = 'In Progress' THEN NEW.started_at := COALESCE(NEW.started_at, NOW()); END IF;
    IF NEW.status = 'Work Done' THEN
        NEW.work_done_at := COALESCE(NEW.work_done_at, NOW());
        NEW.arrived_at := COALESCE(NEW.arrived_at, NEW.started_at, NOW());
        NEW.restored_at := COALESCE(NEW.restored_at, NEW.work_done_at); -- a permanent fix also restores service
        NEW.resolution_time_minutes := (EXTRACT(EPOCH FROM (NEW.work_done_at - NEW.created_at)) / 60)::INTEGER - COALESCE(NEW.sla_paused_minutes, 0);
    END IF;
    IF NEW.status = 'Completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, NOW()); END IF;
    IF NEW.status = 'Closed' THEN NEW.closed_at := COALESCE(NEW.closed_at, NOW()); END IF;

    IF NEW.arrived_at IS NOT NULL AND OLD.arrived_at IS NULL THEN
        NEW.response_time_minutes := (EXTRACT(EPOCH FROM (NEW.arrived_at - NEW.created_at)) / 60)::INTEGER;
    END IF;

    -- Breach flags are judged when each milestone is reached.
    NEW.response_breached := NEW.arrived_at IS NOT NULL AND NEW.arrived_at > NEW.response_due_at;
    NEW.resolution_breached := NEW.work_done_at IS NOT NULL AND NEW.work_done_at > NEW.resolution_due_at;
    NEW.is_overdue := NEW.resolution_breached
        OR (NEW.work_done_at IS NULL AND NEW.status NOT IN ('On Hold','Cancelled') AND NOW() > NEW.resolution_due_at);

    -- Chargeable jobs enter the billing queue once verified.
    IF NEW.status = 'Completed' AND NEW.is_chargeable AND NEW.billing_status = 'Not Billable' THEN
        NEW.billing_status := 'To Bill';
    END IF;

    INSERT INTO work_order_status_history (id, work_order_id, from_status, to_status, comments, created_at)
    VALUES (gen_random_uuid()::text, NEW.id, OLD.status, NEW.status,
            CASE WHEN NEW.status = 'On Hold' THEN NEW.hold_reason
                 WHEN NEW.status = 'Cancelled' THEN NEW.cancel_reason END,
            NOW());
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cafm_wo_status_change ON work_orders;
CREATE TRIGGER trg_cafm_wo_status_change BEFORE UPDATE OF status ON work_orders
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_status_change();

-- History rows are written by the trigger whatever the caller's role.
ALTER FUNCTION cafm_wo_status_change() SECURITY DEFINER;
REVOKE ALL ON FUNCTION cafm_wo_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_sla_targets() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. ACCESS (same "master data" rules as the rest of the catalogue)
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['service_groups','service_types','job_types'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON %I FROM anon', t);
        EXECUTE format('DROP POLICY IF EXISTS cafm_read ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS cafm_insert ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS cafm_update ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS cafm_delete ON %I', t);
        EXECUTE format('CREATE POLICY cafm_read ON %I FOR SELECT TO authenticated USING (cafm_role() IS NOT NULL)', t);
        EXECUTE format('CREATE POLICY cafm_insert ON %I FOR INSERT TO authenticated WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_update ON %I FOR UPDATE TO authenticated USING (cafm_has_role(''admin'',''fm_manager'')) WITH CHECK (cafm_has_role(''admin'',''fm_manager''))', t);
        EXECUTE format('CREATE POLICY cafm_delete ON %I FOR DELETE TO authenticated USING (cafm_has_role(''admin''))', t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 6. STARTER SERVICE MATRIX (generic FM catalogue; edit freely)
-- ------------------------------------------------------------------------------
INSERT INTO service_groups (id, code, name, sort_order) VALUES
    ('sg-hard', 'HARD', 'Hard Services', 1),
    ('sg-soft', 'SOFT', 'Soft Services', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_types (id, group_id, code, name, trade_code, sort_order) VALUES
    ('st-hvac',  'sg-hard', 'HVAC',  'HVAC',                 'HVAC',  1),
    ('st-elec',  'sg-hard', 'ELEC',  'Electrical',           'ELEC',  2),
    ('st-plmb',  'sg-hard', 'PLMB',  'Plumbing',             'PLMB',  3),
    ('st-civil', 'sg-hard', 'CIVIL', 'Civil & Joinery',      'CIVIL', 4),
    ('st-fls',   'sg-hard', 'FLS',   'Fire & Life Safety',   'FLS',   5),
    ('st-clean', 'sg-soft', 'CLEAN', 'Cleaning',             'GEN',   1),
    ('st-pest',  'sg-soft', 'PEST',  'Pest Control',         'GEN',   2),
    ('st-land',  'sg-soft', 'LAND',  'Landscaping',          'GEN',   3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO job_types (id, service_type_id, code, name, name_ar, default_priority, est_hours) VALUES
    ('jt-hvac-nocool',  'st-hvac',  'HVAC-NOCOOL',  'AC not cooling',                 'المكيف لا يبرد',          'P2', 2),
    ('jt-hvac-leak',    'st-hvac',  'HVAC-LEAK',    'AC water leaking',               'تسريب مياه من المكيف',    'P2', 1.5),
    ('jt-hvac-noise',   'st-hvac',  'HVAC-NOISE',   'AC noise / vibration',           'صوت أو اهتزاز في المكيف', 'P3', 1.5),
    ('jt-hvac-fan',     'st-hvac',  'HVAC-FAN',     'Fan / blower not working',       'المروحة لا تعمل',          'P2', 2),
    ('jt-elec-power',   'st-elec',  'ELEC-POWER',   'Total power failure',            'انقطاع كامل للكهرباء',     'P1', 2),
    ('jt-elec-trip',    'st-elec',  'ELEC-TRIP',    'Breaker tripping',               'فصل القاطع',               'P2', 1.5),
    ('jt-elec-light',   'st-elec',  'ELEC-LIGHT',   'Lights not working',             'الإنارة لا تعمل',          'P3', 1),
    ('jt-elec-socket',  'st-elec',  'ELEC-SOCKET',  'Socket / switch faulty',         'مقبس أو مفتاح معطل',       'P3', 1),
    ('jt-plmb-leak',    'st-plmb',  'PLMB-LEAK',    'Water leak',                     'تسريب مياه',               'P1', 1.5),
    ('jt-plmb-block',   'st-plmb',  'PLMB-BLOCK',   'Drain / toilet blocked',         'انسداد في الصرف',          'P2', 1),
    ('jt-plmb-nowater', 'st-plmb',  'PLMB-NOWATER', 'No water supply',                'انقطاع المياه',            'P1', 2),
    ('jt-plmb-heater',  'st-plmb',  'PLMB-HEATER',  'Water heater not working',       'سخان المياه لا يعمل',      'P3', 1.5),
    ('jt-civil-door',   'st-civil', 'CIVIL-DOOR',   'Door / lock faulty',             'باب أو قفل معطل',          'P3', 1),
    ('jt-civil-ceil',   'st-civil', 'CIVIL-CEIL',   'Ceiling tile damaged',           'بلاطة سقف تالفة',          'P4', 1),
    ('jt-civil-paint',  'st-civil', 'CIVIL-PAINT',  'Painting / wall repair',         'دهان أو إصلاح جدار',       'P4', 4),
    ('jt-fls-alarm',    'st-fls',   'FLS-ALARM',    'Fire alarm fault',               'عطل في إنذار الحريق',      'P1', 2),
    ('jt-fls-ext',      'st-fls',   'FLS-EXT',      'Extinguisher missing / expired', 'طفاية مفقودة أو منتهية',   'P3', 0.5),
    ('jt-clean-spill',  'st-clean', 'CLEAN-SPILL',  'Spillage cleaning',              'تنظيف انسكاب',             'P2', 0.5),
    ('jt-clean-waste',  'st-clean', 'CLEAN-WASTE',  'Waste collection required',      'جمع النفايات مطلوب',       'P3', 0.5),
    ('jt-pest-insect',  'st-pest',  'PEST-INSECT',  'Insects sighted',                'مشاهدة حشرات',             'P3', 1),
    ('jt-pest-rodent',  'st-pest',  'PEST-RODENT',  'Rodent sighted',                 'مشاهدة قوارض',             'P2', 1),
    ('jt-land-irr',     'st-land',  'LAND-IRR',     'Irrigation leak / fault',        'عطل في الري',              'P3', 1)
ON CONFLICT (id) DO NOTHING;
