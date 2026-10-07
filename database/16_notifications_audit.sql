-- ==============================================================================
-- OCS CAFM - 16_NOTIFICATIONS_AUDIT.SQL
-- Audit fixes:
--   * Real notifications (the bell showed three hard-coded messages):
--       - technician: job assigned to you, job sent back, job cancelled
--       - supervisors & managers: new P1 job, job marked Work Done,
--         SLA breached
--   * SLA watch every 10 minutes: open jobs past their resolution deadline
--     are flagged overdue and the people responsible are told once.
--   * Real audit trail (nothing ever wrote to audit_logs): key tables now log
--     who changed what, from the database, so it cannot be skipped or forged.
--   * Security: notifications were readable/editable by every user and audit
--     entries could be inserted by anyone. Now own-notifications only, and
--     audit rows come from triggers only.
--   * Company settings still said "Shever Technical Services".
-- Additive except for tightening those policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Who am I (profile id of the signed-in user)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_my_profile_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM profiles WHERE auth_user_id = auth.uid() AND COALESCE(is_active, TRUE) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION cafm_my_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cafm_my_profile_id() TO authenticated;

-- ------------------------------------------------------------------------------
-- Notifications
-- ------------------------------------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'info';   -- info | alert | success | warning
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

DROP POLICY IF EXISTS cafm_read ON notifications;
DROP POLICY IF EXISTS cafm_insert ON notifications;
DROP POLICY IF EXISTS cafm_update ON notifications;
DROP POLICY IF EXISTS cafm_delete ON notifications;
CREATE POLICY cafm_read_own ON notifications FOR SELECT TO authenticated USING (user_id = cafm_my_profile_id());
CREATE POLICY cafm_update_own ON notifications FOR UPDATE TO authenticated
    USING (user_id = cafm_my_profile_id()) WITH CHECK (user_id = cafm_my_profile_id());
CREATE POLICY cafm_delete_own ON notifications FOR DELETE TO authenticated USING (user_id = cafm_my_profile_id());
-- No insert policy: notifications are written by the database below.

CREATE OR REPLACE FUNCTION cafm_notify(p_user TEXT, p_kind TEXT, p_title TEXT, p_body TEXT, p_wo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_user IS NULL THEN RETURN; END IF;
    -- Do not notify people about what they did themselves.
    IF p_user = cafm_my_profile_id() THEN RETURN; END IF;
    INSERT INTO notifications (id, user_id, kind, title, body, entity_type, entity_id)
    VALUES (gen_random_uuid()::text, p_user, p_kind, p_title, p_body, 'work_order', p_wo);
END $$;

CREATE OR REPLACE FUNCTION cafm_notify_leads(p_kind TEXT, p_title TEXT, p_body TEXT, p_wo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE role_id IN ('supervisor', 'fm_manager') AND COALESCE(is_active, TRUE) LOOP
        PERFORM cafm_notify(r.id, p_kind, p_title, p_body, p_wo);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION cafm_wo_notifications()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_what TEXT := left(split_part(COALESCE(NEW.problem_description, ''), E'\n', 1), 80);
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.sla_priority = 'P1' THEN
            PERFORM cafm_notify_leads('alert', 'P1 emergency ' || NEW.wo_number, v_what, NEW.id);
        END IF;
        IF NEW.assigned_technician_id IS NOT NULL THEN
            PERFORM cafm_notify(NEW.assigned_technician_id, CASE WHEN NEW.sla_priority = 'P1' THEN 'alert' ELSE 'info' END,
                'New job ' || NEW.wo_number || ' (' || COALESCE(NEW.sla_priority, '') || ')', v_what, NEW.id);
        END IF;
        RETURN NULL;
    END IF;

    IF NEW.assigned_technician_id IS NOT NULL AND NEW.assigned_technician_id IS DISTINCT FROM OLD.assigned_technician_id THEN
        PERFORM cafm_notify(NEW.assigned_technician_id, CASE WHEN NEW.sla_priority = 'P1' THEN 'alert' ELSE 'info' END,
            'Job assigned to you: ' || NEW.wo_number || ' (' || COALESCE(NEW.sla_priority, '') || ')', v_what, NEW.id);
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'Work Done' THEN
            PERFORM cafm_notify_leads('success', NEW.wo_number || ' is ready to verify', v_what, NEW.id);
        ELSIF OLD.status = 'Work Done' AND NEW.status = 'In Progress' THEN
            PERFORM cafm_notify(NEW.assigned_technician_id, 'warning', NEW.wo_number || ' sent back to you', COALESCE(NEW.remarks, v_what), NEW.id);
        ELSIF NEW.status = 'Cancelled' THEN
            PERFORM cafm_notify(NEW.assigned_technician_id, 'warning', NEW.wo_number || ' was cancelled', COALESCE(NEW.cancel_reason, v_what), NEW.id);
        END IF;
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wo_notifications ON work_orders;
CREATE TRIGGER trg_wo_notifications AFTER INSERT OR UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_notifications();

-- ------------------------------------------------------------------------------
-- SLA watch (every 10 minutes)
-- ------------------------------------------------------------------------------
-- Each job is alerted once (sla_alerted_at), even if a status change already
-- set is_overdue.
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sla_alerted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION cafm_sla_scan()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; n INTEGER := 0;
BEGIN
    FOR r IN
        UPDATE work_orders SET is_overdue = TRUE, sla_alerted_at = NOW()
         WHERE sla_alerted_at IS NULL
           AND resolution_due_at < NOW()
           AND work_done_at IS NULL
           AND status NOT IN ('Work Done', 'Completed', 'Closed', 'Cancelled', 'On Hold')
        RETURNING id, wo_number, sla_priority, assigned_technician_id, problem_description
    LOOP
        n := n + 1;
        PERFORM cafm_notify_leads('alert', 'SLA breached: ' || r.wo_number || ' (' || COALESCE(r.sla_priority, '') || ')',
            left(split_part(COALESCE(r.problem_description, ''), E'\n', 1), 80), r.id);
        PERFORM cafm_notify(r.assigned_technician_id, 'alert', 'Overdue: ' || r.wo_number,
            'The fix deadline has passed.', r.id);
    END LOOP;
    RETURN n;
END $$;
REVOKE ALL ON FUNCTION cafm_sla_scan() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cafm-sla-scan';
SELECT cron.schedule('cafm-sla-scan', '*/10 * * * *', $$SELECT public.cafm_sla_scan()$$);

-- ------------------------------------------------------------------------------
-- Audit trail
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS cafm_insert ON audit_logs;   -- rows come from the trigger only
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION cafm_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_old JSONB := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END;
    v_new JSONB := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END;
    v_changed JSONB;
    v_before JSONB;
    v_key TEXT;
    v_watch TEXT[] := TG_ARGV;   -- for UPDATE: only these columns count (empty = any)
    v_me TEXT := cafm_my_profile_id();
    v_email TEXT;
    v_ref TEXT;
BEGIN
    -- A readable reference for the row, taken before v_old/v_new are trimmed.
    v_ref := COALESCE(v_new, v_old) ->> 'wo_number';
    v_ref := COALESCE(v_ref, COALESCE(v_new, v_old) ->> 'invoice_number', COALESCE(v_new, v_old) ->> 'quote_number',
                      COALESCE(v_new, v_old) ->> 'asset_number', COALESCE(v_new, v_old) ->> 'ppm_code',
                      COALESCE(v_new, v_old) ->> 'email', COALESCE(v_new, v_old) ->> 'code',
                      COALESCE(v_new, v_old) ->> 'id', COALESCE(v_new, v_old) ->> 'work_order_id');
    IF TG_OP = 'UPDATE' THEN
        v_changed := '{}'::jsonb;
        v_before := '{}'::jsonb;
        FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
            CONTINUE WHEN v_key IN ('updated_at', 'last_login_at', 'last_generated_at');
            CONTINUE WHEN array_length(v_watch, 1) IS NOT NULL AND NOT (v_key = ANY (v_watch));
            IF v_new -> v_key IS DISTINCT FROM v_old -> v_key THEN
                v_changed := v_changed || jsonb_build_object(v_key, v_new -> v_key);
                v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
            END IF;
        END LOOP;
        IF v_changed = '{}'::jsonb THEN RETURN NULL; END IF;
        v_old := v_before;
        v_new := v_changed;
    END IF;
    SELECT email INTO v_email FROM profiles WHERE id = v_me;
    INSERT INTO audit_logs (id, user_id, user_email, action, module, record_id, old_values, new_values, created_at)
    VALUES (gen_random_uuid()::text, v_me, COALESCE(v_email, CASE WHEN auth.uid() IS NULL THEN 'system' END),
            TG_OP, TG_TABLE_NAME, v_ref, v_old, v_new, NOW());
    RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION cafm_audit() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    t TEXT;
    spec TEXT[][] := ARRAY[
        ['work_orders', 'status,assigned_technician_id,sla_priority,billing_status,is_chargeable,client_id,wo_type,cancel_reason'],
        ['assets', ''], ['profiles', 'role_id,is_active,email,employee_id,trade_code,grade,full_name'],
        ['invoices', 'status,client_id,total,vat_rate,payment_ref'], ['quotes', 'status,client_id,total'],
        ['labour_rates', ''], ['sla_policies', ''], ['system_settings', ''], ['clients', ''], ['contracts', ''],
        ['ppm_plans', 'frequency,is_active,checklist_id,assigned_technician_id,start_date,end_date'],
        ['wo_costing', 'callout_fee,minimum_charge,markup_pct,discount'], ['materials', 'unit_cost,name,item_code']
    ];
    cols TEXT;
BEGIN
    FOR i IN 1 .. array_length(spec, 1) LOOP
        t := spec[i][1];
        cols := spec[i][2];
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON %I', t);
        IF cols = '' THEN
            EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION cafm_audit()', t);
        ELSE
            EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION cafm_audit(%s)',
                t, (SELECT string_agg(quote_literal(c), ',') FROM unnest(string_to_array(cols, ',')) c));
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- Company settings: OCS branding
-- ------------------------------------------------------------------------------
UPDATE system_settings SET
    company_name = 'OCS Facilities Services',
    company_logo_url = '/ocs-logo.png',
    contact_email = CASE WHEN contact_email ILIKE '%shever%' THEN NULL ELSE contact_email END,
    contact_phone = CASE WHEN contact_phone = '+971 4 388 9900' THEN NULL ELSE contact_phone END,
    updated_at = NOW()
 WHERE company_name ILIKE '%shever%';

REVOKE ALL ON FUNCTION cafm_notify(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_notify_leads(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_wo_notifications() FROM PUBLIC, anon, authenticated;

-- The old breach flagger (replaced by cafm_sla_scan) is no longer callable from the API.
REVOKE ALL ON FUNCTION flag_sla_breaches() FROM PUBLIC, anon, authenticated;
