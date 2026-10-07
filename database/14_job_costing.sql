-- ==============================================================================
-- OCS CAFM - 14_JOB_COSTING.SQL
-- Step 8: what each job costs OCS and what the client is charged (AED).
--
--   * Labour: every travel/labour timer line is priced from the rate card
--     (contract -> trade -> company default; grade x Normal/Overtime/Holiday).
--     The rate type is picked automatically from the start time: public
--     holiday -> Holiday, weekend or outside working hours -> Overtime.
--     Hours come from the timer itself. Rates are a snapshot on the line, so
--     later rate changes never rewrite old jobs (unless the line is unlocked).
--   * Materials: from the store (stock goes down, ledger row written, and it
--     refuses to issue more than is in stock) or bought directly for the job.
--     Sell price = cost + markup (line -> contract -> company default).
--   * Subcontractors: cost + markup.
--   * wo_costing keeps the job totals; call-out fee defaults from the contract
--     for chargeable jobs; minimum charge is entered by hand.
--
-- Additive only.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Settings
-- ------------------------------------------------------------------------------
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS material_markup_pct NUMERIC(6,2) DEFAULT 15;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS subcontract_markup_pct NUMERIC(6,2) DEFAULT 10;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS bill_travel BOOLEAN DEFAULT TRUE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS work_day_start TIME DEFAULT '07:00';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS work_day_end TIME DEFAULT '17:00';
-- ISO weekday numbers (1 = Monday ... 7 = Sunday). UAE weekend: Saturday, Sunday.
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS weekend_days INTEGER[] DEFAULT '{6,7}';

-- ------------------------------------------------------------------------------
-- 2. Rate card: starter rates, only when the card is empty (edit in the app)
-- ------------------------------------------------------------------------------
ALTER TABLE labour_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO labour_rates (grade, rate_type, cost_rate, sell_rate, effective_from)
SELECT g.grade, t.rate_type, ROUND(g.cost * t.f, 2), ROUND(g.sell * t.f, 2), DATE '2020-01-01'
  FROM (VALUES ('Helper', 15, 45), ('Technician', 25, 75), ('Senior Technician', 35, 95),
               ('Supervisor', 50, 120), ('Engineer', 80, 180)) AS g(grade, cost, sell)
 CROSS JOIN (VALUES ('Normal', 1.0), ('Overtime', 1.25), ('Holiday', 1.5)) AS t(rate_type, f)
 WHERE NOT EXISTS (SELECT 1 FROM labour_rates);

-- ------------------------------------------------------------------------------
-- 3. Labour lines priced from the rate card
-- ------------------------------------------------------------------------------
ALTER TABLE wo_labour ADD COLUMN IF NOT EXISTS rate_locked BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION cafm_rate_type_at(p_at TIMESTAMPTZ)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    s system_settings%ROWTYPE;
    v_local TIMESTAMP := p_at AT TIME ZONE 'Asia/Dubai';
BEGIN
    SELECT * INTO s FROM system_settings ORDER BY id LIMIT 1;
    IF EXISTS (SELECT 1 FROM public_holidays WHERE holiday_date = v_local::date) THEN RETURN 'Holiday'; END IF;
    IF EXTRACT(ISODOW FROM v_local)::int = ANY (COALESCE(s.weekend_days, '{6,7}')) THEN RETURN 'Overtime'; END IF;
    IF v_local::time < COALESCE(s.work_day_start, '07:00') OR v_local::time >= COALESCE(s.work_day_end, '17:00') THEN RETURN 'Overtime'; END IF;
    RETURN 'Normal';
END $$;

CREATE OR REPLACE FUNCTION cafm_wo_labour_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_contract TEXT;
    v_rate labour_rates%ROWTYPE;
    v_bill_travel BOOLEAN;
BEGIN
    -- Who: trade and grade from the technician's profile.
    IF NEW.technician_id IS NOT NULL AND (NEW.trade_code IS NULL OR NEW.grade IS NULL) THEN
        SELECT COALESCE(NEW.trade_code, p.trade_code), COALESCE(NEW.grade, p.grade)
          INTO NEW.trade_code, NEW.grade FROM profiles p WHERE p.id = NEW.technician_id;
    END IF;
    NEW.grade := COALESCE(NEW.grade, 'Technician');

    -- Timer lines: hours from the clock, rate type from when it started.
    IF NOT COALESCE(NEW.is_manual, FALSE) AND NEW.started_at IS NOT NULL THEN
        IF NEW.ended_at IS NOT NULL THEN
            NEW.hours := ROUND((EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 3600)::numeric, 2);
        END IF;
        IF TG_OP = 'INSERT' THEN NEW.rate_type := cafm_rate_type_at(NEW.started_at); END IF;
    END IF;
    NEW.rate_type := COALESCE(NEW.rate_type, 'Normal');

    IF COALESCE(NEW.rate_locked, FALSE) THEN RETURN NEW; END IF;

    SELECT contract_id INTO v_contract FROM work_orders WHERE id = NEW.work_order_id;
    SELECT * INTO v_rate FROM labour_rates r
     WHERE r.grade = NEW.grade AND r.rate_type = NEW.rate_type
       AND (r.contract_id IS NULL OR r.contract_id = v_contract)
       AND (r.trade_code IS NULL OR r.trade_code = NEW.trade_code)
     -- Latest rate in force on the day; if none yet, the earliest one.
     ORDER BY (r.contract_id IS NOT NULL) DESC, (r.trade_code IS NOT NULL) DESC,
              (COALESCE(r.effective_from, '2000-01-01') <= COALESCE(NEW.started_at, NOW())::date) DESC,
              CASE WHEN COALESCE(r.effective_from, '2000-01-01') <= COALESCE(NEW.started_at, NOW())::date THEN r.effective_from END DESC NULLS LAST,
              r.effective_from ASC
     LIMIT 1;

    NEW.cost_rate := COALESCE(v_rate.cost_rate, 0);
    NEW.sell_rate := COALESCE(v_rate.sell_rate, 0);
    SELECT COALESCE(bill_travel, TRUE) INTO v_bill_travel FROM system_settings ORDER BY id LIMIT 1;
    IF NEW.record_type = 'Travel' AND NOT COALESCE(v_bill_travel, TRUE) THEN NEW.sell_rate := 0; END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_labour_price ON wo_labour;
CREATE TRIGGER trg_wo_labour_price BEFORE INSERT OR UPDATE ON wo_labour
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_labour_price();

-- ------------------------------------------------------------------------------
-- 4. Materials on a job: pricing + store issue
-- ------------------------------------------------------------------------------
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS added_by TEXT;
-- Direct purchases have no store item.
ALTER TABLE work_order_materials ALTER COLUMN material_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION cafm_markup_for(p_wo TEXT, p_kind TEXT)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(
        (SELECT c.default_markup_pct FROM work_orders w JOIN contracts c ON c.id = w.contract_id WHERE w.id = p_wo AND p_kind = 'material'),
        (SELECT CASE WHEN p_kind = 'material' THEN material_markup_pct ELSE subcontract_markup_pct END FROM system_settings ORDER BY id LIMIT 1),
        0);
$$;

CREATE OR REPLACE FUNCTION cafm_wo_material_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m materials%ROWTYPE;
BEGIN
    NEW.source := COALESCE(NEW.source, 'Store');
    IF NEW.source = 'Store' THEN
        IF NEW.material_id IS NULL THEN RAISE EXCEPTION 'Pick the store item.'; END IF;
        SELECT * INTO m FROM materials WHERE id = NEW.material_id;
        IF TG_OP = 'INSERT' OR NEW.material_id IS DISTINCT FROM OLD.material_id THEN
            NEW.unit_cost := COALESCE(NULLIF(NEW.unit_cost, 0), m.unit_cost, 0);
        END IF;
        NEW.description := COALESCE(NEW.description, m.name);
        NEW.unit := COALESCE(NEW.unit, m.unit);
    ELSIF COALESCE(NEW.description, '') = '' THEN
        RAISE EXCEPTION 'Describe what was bought.';
    END IF;
    IF COALESCE(NEW.quantity_used, 0) <= 0 THEN RAISE EXCEPTION 'Quantity must be more than zero.'; END IF;
    NEW.unit_cost := COALESCE(NEW.unit_cost, 0);
    NEW.total_cost := ROUND(NEW.quantity_used * NEW.unit_cost, 2);
    NEW.markup_pct := COALESCE(NEW.markup_pct, cafm_markup_for(NEW.work_order_id, 'material'));
    NEW.sell_amount := ROUND(NEW.total_cost * (1 + NEW.markup_pct / 100), 2);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_material_price ON work_order_materials;
CREATE TRIGGER trg_wo_material_price BEFORE INSERT OR UPDATE ON work_order_materials
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_material_price();

-- Store lines move stock and leave a ledger row. Runs as definer: technicians
-- record what they used but cannot edit the store directly.
CREATE OR REPLACE FUNCTION cafm_wo_material_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_have NUMERIC;
    v_name TEXT;
    v_wo TEXT := COALESCE(NEW.work_order_id, OLD.work_order_id);
    v_by TEXT := (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1);
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.source IS NOT DISTINCT FROM OLD.source
       AND NEW.material_id IS NOT DISTINCT FROM OLD.material_id AND NEW.quantity_used = OLD.quantity_used THEN
        RETURN NULL;   -- price/markup edit only: stock unchanged
    END IF;
    -- Undo the old line, apply the new one (handles item/qty/source changes).
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.source = 'Store' AND OLD.material_id IS NOT NULL THEN
        UPDATE materials SET quantity_in_stock = quantity_in_stock + OLD.quantity_used, updated_at = NOW() WHERE id = OLD.material_id;
        INSERT INTO material_transactions (id, material_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
        VALUES (gen_random_uuid()::text, OLD.material_id, 'IN', OLD.quantity_used, 'WORK_ORDER', v_wo, v_by,
                CASE WHEN TG_OP = 'DELETE' THEN 'Returned from job' ELSE 'Job line changed (reversal)' END);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.source = 'Store' AND NEW.material_id IS NOT NULL THEN
        SELECT quantity_in_stock, name INTO v_have, v_name FROM materials WHERE id = NEW.material_id FOR UPDATE;
        IF COALESCE(v_have, 0) < NEW.quantity_used THEN
            RAISE EXCEPTION 'Only % % of "%" in the store.', COALESCE(v_have, 0), COALESCE(NEW.unit, ''), v_name
                USING ERRCODE = 'check_violation';
        END IF;
        UPDATE materials SET quantity_in_stock = quantity_in_stock - NEW.quantity_used, updated_at = NOW() WHERE id = NEW.material_id;
        INSERT INTO material_transactions (id, material_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes)
        VALUES (gen_random_uuid()::text, NEW.material_id, 'OUT', NEW.quantity_used, 'WORK_ORDER', v_wo, v_by, 'Issued to job');
    END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wo_material_stock ON work_order_materials;
CREATE TRIGGER trg_wo_material_stock AFTER INSERT OR UPDATE OR DELETE ON work_order_materials
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_material_stock();

-- ------------------------------------------------------------------------------
-- 5. Subcontractor lines
-- ------------------------------------------------------------------------------
ALTER TABLE wo_subcontract_costs ADD COLUMN IF NOT EXISTS supplier_invoice_ref TEXT;

CREATE OR REPLACE FUNCTION cafm_wo_subcontract_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    NEW.markup_pct := COALESCE(NEW.markup_pct, cafm_markup_for(NEW.work_order_id, 'subcontract'));
    NEW.sell_amount := ROUND(COALESCE(NEW.cost_amount, 0) * (1 + NEW.markup_pct / 100), 2);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_subcontract_price ON wo_subcontract_costs;
CREATE TRIGGER trg_wo_subcontract_price BEFORE INSERT OR UPDATE ON wo_subcontract_costs
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_subcontract_price();

-- ------------------------------------------------------------------------------
-- 6. Job totals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_recalc_wo_costing(p_wo TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_lc NUMERIC := 0; v_ls NUMERIC := 0;
    v_mc NUMERIC := 0; v_ms NUMERIC := 0;
    v_sc NUMERIC := 0; v_ss NUMERIC := 0;
    v_row wo_costing%ROWTYPE;
BEGIN
    IF p_wo IS NULL OR NOT EXISTS (SELECT 1 FROM work_orders WHERE id = p_wo) THEN RETURN; END IF;
    SELECT COALESCE(SUM(cost_amount),0), COALESCE(SUM(sell_amount),0) INTO v_lc, v_ls
      FROM wo_labour WHERE work_order_id = p_wo;
    SELECT COALESCE(SUM(total_cost),0), COALESCE(SUM(COALESCE(sell_amount, total_cost)),0) INTO v_mc, v_ms
      FROM work_order_materials WHERE work_order_id = p_wo;
    SELECT COALESCE(SUM(cost_amount),0), COALESCE(SUM(COALESCE(sell_amount, cost_amount)),0) INTO v_sc, v_ss
      FROM wo_subcontract_costs WHERE work_order_id = p_wo;

    -- First time: chargeable jobs pick up the contract's call-out fee.
    INSERT INTO wo_costing (work_order_id, callout_fee)
    SELECT w.id, CASE WHEN w.is_chargeable THEN COALESCE(c.callout_fee, 0) ELSE 0 END
      FROM work_orders w LEFT JOIN contracts c ON c.id = w.contract_id WHERE w.id = p_wo
    ON CONFLICT (work_order_id) DO NOTHING;
    SELECT * INTO v_row FROM wo_costing WHERE work_order_id = p_wo;

    UPDATE wo_costing SET
        labour_cost = v_lc, labour_sell = v_ls,
        material_cost = v_mc, material_sell = v_ms,
        subcontract_cost = v_sc, subcontract_sell = v_ss,
        total_cost = v_lc + v_mc + v_sc,
        total_sell = ROUND(GREATEST(
            (v_ls + v_ms + v_ss) * (1 + COALESCE(v_row.markup_pct,0) / 100)
              + COALESCE(v_row.callout_fee,0) - COALESCE(v_row.discount,0),
            COALESCE(v_row.minimum_charge,0), 0), 2),
        updated_at = NOW()
    WHERE work_order_id = p_wo;
END $$;

-- Editing the job charges (call-out, minimum, markup, discount) re-totals.
CREATE OR REPLACE FUNCTION cafm_trg_costing_charges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM cafm_recalc_wo_costing(NEW.work_order_id);
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wo_costing_charges ON wo_costing;
CREATE TRIGGER trg_wo_costing_charges AFTER INSERT OR UPDATE OF callout_fee, minimum_charge, markup_pct, discount ON wo_costing
    FOR EACH ROW EXECUTE FUNCTION cafm_trg_costing_charges();

-- A technician may edit their own profile, but not the trade/grade that sets
-- what their hours cost and are billed at.
CREATE OR REPLACE FUNCTION cafm_profiles_rate_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND NOT cafm_has_role('admin')
       AND (NEW.grade IS DISTINCT FROM OLD.grade OR NEW.trade_code IS DISTINCT FROM OLD.trade_code) THEN
        RAISE EXCEPTION 'Only an admin can change trade or grade.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_rate_guard ON profiles;
CREATE TRIGGER trg_profiles_rate_guard BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION cafm_profiles_rate_guard();

-- Supervisors and managers may remove a wrong line (admins already could).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['wo_labour', 'work_order_materials', 'wo_subcontract_costs'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS cafm_delete_lead ON %I', t);
        EXECUTE format('CREATE POLICY cafm_delete_lead ON %I FOR DELETE TO authenticated USING (cafm_has_role(''admin'', ''fm_manager'', ''supervisor''))', t);
    END LOOP;
END $$;

REVOKE ALL ON FUNCTION cafm_rate_type_at(TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cafm_markup_for(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cafm_recalc_wo_costing(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cafm_rate_type_at(TIMESTAMPTZ) TO authenticated;
