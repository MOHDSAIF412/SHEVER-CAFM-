-- ==============================================================================
-- OCS CAFM - 09_CAFM_CORE_MODEL.SQL
-- Step 2 of the CAFM rebuild: the real facilities-management data model.
--
--   Client -> Contract -> Facility -> Building -> Floor -> Zone -> Room (locations)
--   Assets pinned to a room, with parent/child links
--   SLA policies per contract x priority (P1-P4), business calendars, holidays,
--   SLA clock pauses
--   Work order types: PPM / Reactive / On-call / Corrective / Quoted
--   Checklist templates usable by any work order type
--   Job costing: labour (rate cards), materials, subcontractors, call-out,
--   manual minimum charge, markup
--   Billing: quotes and invoices in AED, VAT as a setting
--   AI suggestions log (every AI proposal is recorded and needs a human)
--
-- ADDITIVE ONLY. This database is shared with the FM Condition Survey app, so
-- nothing here renames or drops an existing table or column. Safe to re-run.
-- IDs are TEXT to match the existing CAFM tables (the app generates them).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CLIENTS, CONTRACTS, FACILITIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL,                 -- 'CLIENT-A'
    name TEXT NOT NULL,
    trn TEXT,                                  -- UAE tax registration number
    billing_address TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    code TEXT UNIQUE NOT NULL,                 -- 'CLIENT-A-MAIN'
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    contract_type TEXT DEFAULT 'Comprehensive'
        CHECK (contract_type IN ('Comprehensive', 'Semi-Comprehensive', 'Labour Only', 'Call-out Only')),
    -- Reactive jobs under this value (AED) are covered by the contract fee.
    reactive_cover_limit NUMERIC(12,2) DEFAULT 0,
    default_markup_pct NUMERIC(6,2) DEFAULT 15,
    callout_fee NUMERIC(12,2) DEFAULT 0,       -- after-hours call-out fee
    calendar_id TEXT,                          -- FK added below
    currency TEXT DEFAULT 'AED',
    status TEXT DEFAULT 'Active' CHECK (status IN ('Draft', 'Active', 'Expired', 'Terminated')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- A "Facility" is the top of the location tree (the client's site/campus).
CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    code TEXT UNIQUE NOT NULL,                 -- 'F010'
    name TEXT NOT NULL,                        -- 'FOOD STORES'
    address TEXT,
    city TEXT DEFAULT 'Abu Dhabi',
    gps JSONB,                                 -- { "lat":..., "lng":... }
    qr_token TEXT UNIQUE,                      -- for the later QR complaint portal
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 2. ZONES AND ROOMS (existing `locations` table = Room level)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,                        -- 'North Wing', 'Plant Area'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_floor_zone UNIQUE (floor_id, code)
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS space_type TEXT;   -- 'Plant Room', 'Office', 'Toilet', 'Corridor'
ALTER TABLE locations ADD COLUMN IF NOT EXISTS area_sqm NUMERIC(10,2);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE;

-- ------------------------------------------------------------------------------
-- 3. ASSET REGISTER EXTENSIONS
-- ------------------------------------------------------------------------------
ALTER TABLE assets ADD COLUMN IF NOT EXISTS facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS parent_asset_id TEXT REFERENCES assets(id) ON DELETE SET NULL;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS nesting_reference TEXT;  -- e.g. 'CLA/F010-PS-DB-01'
ALTER TABLE assets ADD COLUMN IF NOT EXISTS position_code TEXT;      -- e.g. 'MAIN'
ALTER TABLE assets ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12,2);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS expected_life_years INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS condition_score INTEGER CHECK (condition_score BETWEEN 1 AND 5);

CREATE INDEX IF NOT EXISTS idx_assets_facility ON assets(facility_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_parent ON assets(parent_asset_id);

-- ------------------------------------------------------------------------------
-- 4. SLA: CALENDARS, HOLIDAYS, POLICIES PER CONTRACT x PRIORITY
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_calendars (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,                 -- '24/7', 'UAE Office Hours'
    is_24x7 BOOLEAN DEFAULT FALSE,
    -- { "mon": ["08:00","17:00"], ..., "sat": null, "sun": null }
    working_hours JSONB DEFAULT '{}'::jsonb,
    timezone TEXT DEFAULT 'Asia/Dubai',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_calendar') THEN
        ALTER TABLE contracts ADD CONSTRAINT fk_contracts_calendar
            FOREIGN KEY (calendar_id) REFERENCES business_calendars(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public_holidays (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    calendar_id TEXT REFERENCES business_calendars(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    name TEXT NOT NULL,
    CONSTRAINT uq_calendar_holiday UNIQUE (calendar_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS sla_policies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE,  -- NULL = default policy
    priority TEXT NOT NULL CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    name TEXT NOT NULL,                        -- 'Emergency', 'Urgent', 'Normal', 'Planned'
    response_minutes INTEGER NOT NULL,
    resolution_minutes INTEGER NOT NULL,
    calendar_id TEXT REFERENCES business_calendars(id) ON DELETE SET NULL,
    escalate_at_pct INTEGER DEFAULT 75,        -- warn at 75% of the target
    penalty_note TEXT,
    color_hex TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sla_policy_contract_priority
    ON sla_policies (COALESCE(contract_id, '*'), priority);

-- ------------------------------------------------------------------------------
-- 5. WORK ORDER EXTENSIONS (types, SLA clocks, billing flags)
-- ------------------------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS wo_type TEXT DEFAULT 'Reactive'
    CHECK (wo_type IN ('PPM', 'Reactive', 'On-call', 'Corrective', 'Quoted'));
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS zone_id TEXT REFERENCES zones(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sla_policy_id TEXT REFERENCES sla_policies(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sla_priority TEXT CHECK (sla_priority IN ('P1', 'P2', 'P3', 'P4'));
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS parent_wo_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL; -- corrective raised from PPM
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS ppm_schedule_id TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Helpdesk'
    CHECK (source IN ('Helpdesk', 'Phone', 'Email', 'WhatsApp', 'QR Portal', 'PPM', 'AI Agent', 'Mobile'));
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS trade TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sla_paused_minutes INTEGER DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS response_breached BOOLEAN DEFAULT FALSE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS resolution_breached BOOLEAN DEFAULT FALSE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS is_chargeable BOOLEAN DEFAULT FALSE;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_signoff_name TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_signoff_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'Not Billable'
    CHECK (billing_status IN ('Not Billable', 'To Bill', 'Quoted', 'Invoiced', 'Paid', 'Written Off'));

CREATE INDEX IF NOT EXISTS idx_wo_type ON work_orders(wo_type);
CREATE INDEX IF NOT EXISTS idx_wo_facility ON work_orders(facility_id);
CREATE INDEX IF NOT EXISTS idx_wo_billing ON work_orders(billing_status);

-- On Hold periods pause the SLA clock (waiting for parts / access / client).
CREATE TABLE IF NOT EXISTS wo_sla_pauses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('Awaiting Parts', 'Awaiting Access', 'Awaiting Client Approval', 'Other')),
    note TEXT,
    paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resumed_at TIMESTAMPTZ,
    created_by TEXT
);

-- ------------------------------------------------------------------------------
-- 6. CHECKLISTS (templates for any WO type; responses per WO)
-- ------------------------------------------------------------------------------
-- Existing ppm_checklists / ppm_checklist_items stay as the template store.
ALTER TABLE ppm_checklists ADD COLUMN IF NOT EXISTS subcategory_id TEXT;
ALTER TABLE ppm_checklists ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'PPM'
    CHECK (applies_to IN ('PPM', 'Reactive', 'Any'));
ALTER TABLE ppm_checklists ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE ppm_checklist_items ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT FALSE;
ALTER TABLE ppm_checklist_items ADD COLUMN IF NOT EXISTS raise_corrective_on_fail BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS wo_checklist_responses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    checklist_item_id TEXT NOT NULL,
    result TEXT CHECK (result IN ('Pass', 'Fail', 'N/A')),
    reading NUMERIC,
    text_value TEXT,
    photo_url TEXT,
    is_out_of_range BOOLEAN DEFAULT FALSE,
    corrective_wo_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
    answered_by TEXT,
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_wo_checklist_item UNIQUE (work_order_id, checklist_item_id)
);

-- ------------------------------------------------------------------------------
-- 7. LABOUR: TRADES, RATE CARDS, TIME LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT UNIQUE NOT NULL,                 -- 'HVAC', 'ELEC', 'PLMB', 'CIVIL', 'FLS'
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trade_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grade TEXT;            -- 'Helper', 'Technician', 'Senior', 'Supervisor', 'Engineer'

CREATE TABLE IF NOT EXISTS labour_rates (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    contract_id TEXT REFERENCES contracts(id) ON DELETE CASCADE, -- NULL = company default
    trade_code TEXT,                           -- NULL = any trade
    grade TEXT NOT NULL,
    rate_type TEXT NOT NULL DEFAULT 'Normal' CHECK (rate_type IN ('Normal', 'Overtime', 'Holiday')),
    cost_rate NUMERIC(10,2) NOT NULL DEFAULT 0,  -- AED/hr, what it costs OCS
    sell_rate NUMERIC(10,2) NOT NULL DEFAULT 0,  -- AED/hr, what the client is charged
    effective_from DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wo_labour (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    technician_id TEXT,
    technician_name TEXT,
    trade_code TEXT,
    grade TEXT,
    rate_type TEXT DEFAULT 'Normal' CHECK (rate_type IN ('Normal', 'Overtime', 'Holiday')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    hours NUMERIC(6,2) NOT NULL DEFAULT 0,
    cost_rate NUMERIC(10,2) DEFAULT 0,
    sell_rate NUMERIC(10,2) DEFAULT 0,
    cost_amount NUMERIC(12,2) GENERATED ALWAYS AS (hours * cost_rate) STORED,
    sell_amount NUMERIC(12,2) GENERATED ALWAYS AS (hours * sell_rate) STORED,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wo_labour_wo ON wo_labour(work_order_id);

-- ------------------------------------------------------------------------------
-- 8. MATERIALS & SUBCONTRACTORS ON A JOB
-- ------------------------------------------------------------------------------
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Store'
    CHECK (source IN ('Store', 'Direct Purchase'));
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS description TEXT;   -- for direct purchases
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS supplier_invoice_ref TEXT;
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS markup_pct NUMERIC(6,2);
ALTER TABLE work_order_materials ADD COLUMN IF NOT EXISTS sell_amount NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS wo_subcontract_costs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    work_order_id TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    subcontractor TEXT NOT NULL,
    description TEXT,
    po_number TEXT,
    cost_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    markup_pct NUMERIC(6,2),
    sell_amount NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. JOB COSTING SUMMARY (one row per work order)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wo_costing (
    work_order_id TEXT PRIMARY KEY REFERENCES work_orders(id) ON DELETE CASCADE,
    labour_cost NUMERIC(12,2) DEFAULT 0,
    labour_sell NUMERIC(12,2) DEFAULT 0,
    material_cost NUMERIC(12,2) DEFAULT 0,
    material_sell NUMERIC(12,2) DEFAULT 0,
    subcontract_cost NUMERIC(12,2) DEFAULT 0,
    subcontract_sell NUMERIC(12,2) DEFAULT 0,
    callout_fee NUMERIC(12,2) DEFAULT 0,
    minimum_charge NUMERIC(12,2) DEFAULT 0,    -- entered MANUALLY per job
    markup_pct NUMERIC(6,2) DEFAULT 0,
    discount NUMERIC(12,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    total_sell NUMERIC(12,2) DEFAULT 0,        -- before VAT
    notes TEXT,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recalculate a job's totals from its labour, material and subcontract lines.
-- Billable amount = max(lines + call-out - discount, manual minimum charge).
CREATE OR REPLACE FUNCTION cafm_recalc_wo_costing(p_wo TEXT)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_lc NUMERIC := 0; v_ls NUMERIC := 0;
    v_mc NUMERIC := 0; v_ms NUMERIC := 0;
    v_sc NUMERIC := 0; v_ss NUMERIC := 0;
    v_row wo_costing%ROWTYPE;
BEGIN
    SELECT COALESCE(SUM(cost_amount),0), COALESCE(SUM(sell_amount),0) INTO v_lc, v_ls
      FROM wo_labour WHERE work_order_id = p_wo;
    SELECT COALESCE(SUM(total_cost),0), COALESCE(SUM(COALESCE(sell_amount, total_cost)),0) INTO v_mc, v_ms
      FROM work_order_materials WHERE work_order_id = p_wo;
    SELECT COALESCE(SUM(cost_amount),0), COALESCE(SUM(COALESCE(sell_amount, cost_amount)),0) INTO v_sc, v_ss
      FROM wo_subcontract_costs WHERE work_order_id = p_wo;

    INSERT INTO wo_costing (work_order_id) VALUES (p_wo) ON CONFLICT (work_order_id) DO NOTHING;
    SELECT * INTO v_row FROM wo_costing WHERE work_order_id = p_wo;

    UPDATE wo_costing SET
        labour_cost = v_lc, labour_sell = v_ls,
        material_cost = v_mc, material_sell = v_ms,
        subcontract_cost = v_sc, subcontract_sell = v_ss,
        total_cost = v_lc + v_mc + v_sc,
        total_sell = GREATEST(
            (v_ls + v_ms + v_ss) * (1 + COALESCE(v_row.markup_pct,0) / 100)
              + COALESCE(v_row.callout_fee,0) - COALESCE(v_row.discount,0),
            COALESCE(v_row.minimum_charge,0)),
        updated_at = NOW()
    WHERE work_order_id = p_wo;
END $$;

CREATE OR REPLACE FUNCTION cafm_trg_recalc_costing()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    PERFORM cafm_recalc_wo_costing(COALESCE(NEW.work_order_id, OLD.work_order_id));
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_wo_labour_costing ON wo_labour;
CREATE TRIGGER trg_wo_labour_costing AFTER INSERT OR UPDATE OR DELETE ON wo_labour
    FOR EACH ROW EXECUTE FUNCTION cafm_trg_recalc_costing();
DROP TRIGGER IF EXISTS trg_wo_materials_costing ON work_order_materials;
CREATE TRIGGER trg_wo_materials_costing AFTER INSERT OR UPDATE OR DELETE ON work_order_materials
    FOR EACH ROW EXECUTE FUNCTION cafm_trg_recalc_costing();
DROP TRIGGER IF EXISTS trg_wo_subcontract_costing ON wo_subcontract_costs;
CREATE TRIGGER trg_wo_subcontract_costing AFTER INSERT OR UPDATE OR DELETE ON wo_subcontract_costs
    FOR EACH ROW EXECUTE FUNCTION cafm_trg_recalc_costing();

-- ------------------------------------------------------------------------------
-- 10. BILLING: QUOTES AND INVOICES (AED, VAT optional)
-- ------------------------------------------------------------------------------
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 5;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_trn TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV';
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS quote_prefix TEXT DEFAULT 'QT';

CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quote_number TEXT UNIQUE NOT NULL,
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Expired')),
    valid_until DATE,
    client_po_number TEXT,
    subtotal NUMERIC(12,2) DEFAULT 0,
    vat_amount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    ai_drafted BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    client_id TEXT REFERENCES clients(id) ON DELETE RESTRICT,
    contract_id TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    period_start DATE,
    period_end DATE,
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Issued', 'Paid', 'Cancelled')),
    issue_date DATE,
    due_date DATE,
    subtotal NUMERIC(12,2) DEFAULT 0,
    vat_rate NUMERIC(5,2) DEFAULT 0,
    vat_amount NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'AED',
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lines on a quote or an invoice. Invoice lines usually point at a work order.
CREATE TABLE IF NOT EXISTS billing_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    quote_id TEXT REFERENCES quotes(id) ON DELETE CASCADE,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
    work_order_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL,
    line_type TEXT NOT NULL CHECK (line_type IN ('Labour', 'Material', 'Subcontract', 'Call-out', 'Minimum Charge', 'Other')),
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1,
    unit_price NUMERIC(12,2) DEFAULT 0,
    amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    sort_order INTEGER DEFAULT 0,
    CONSTRAINT chk_billing_parent CHECK (quote_id IS NOT NULL OR invoice_id IS NOT NULL)
);

-- ------------------------------------------------------------------------------
-- 11. AI SUGGESTIONS LOG (AI suggests, a human confirms)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    feature TEXT NOT NULL,                     -- 'job_logging', 'nameplate_ocr', 'voice_report', 'duplicate_check', 'sla_risk', 'quote_draft'
    entity_type TEXT,                          -- 'work_order', 'asset', 'quote'
    entity_id TEXT,
    input_summary TEXT,
    suggestion JSONB NOT NULL,
    confidence NUMERIC(4,3),
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Edited', 'Rejected')),
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    model TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. ACCESS POLICIES
-- Match the existing CAFM tables (cafm_app_access_*), which the web app relies
-- on today. These are wide open and will be tightened with real roles in the
-- security pass; see docs/CAFM_DATA_MODEL.md.
-- ------------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['clients','contracts','facilities','zones','business_calendars','public_holidays',
        'sla_policies','wo_sla_pauses','wo_checklist_responses','trades','labour_rates','wo_labour',
        'wo_subcontract_costs','wo_costing','quotes','invoices','billing_lines','ai_suggestions']
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='cafm_app_access_'||t) THEN
            EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
                           'cafm_app_access_'||t, t);
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 13. REFERENCE DATA
-- ------------------------------------------------------------------------------
INSERT INTO business_calendars (id, name, is_24x7, working_hours) VALUES
    ('cal-24x7', '24/7', TRUE, '{}'::jsonb),
    ('cal-uae-office', 'UAE Office Hours', FALSE,
     '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":null,"sun":null}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Default SLA (contract_id NULL). Contracts can override any priority.
INSERT INTO sla_policies (id, contract_id, priority, name, response_minutes, resolution_minutes, calendar_id, color_hex) VALUES
    ('sla-default-p1', NULL, 'P1', 'Emergency', 60,   240,  'cal-24x7',       '#B91C2A'),
    ('sla-default-p2', NULL, 'P2', 'Urgent',    240,  1440, 'cal-24x7',       '#F15F22'),
    ('sla-default-p3', NULL, 'P3', 'Normal',    1440, 4320, 'cal-uae-office', '#293771'),
    ('sla-default-p4', NULL, 'P4', 'Planned',   2880, 7200, 'cal-uae-office', '#808285')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trades (code, name) VALUES
    ('HVAC', 'HVAC'), ('ELEC', 'Electrical'), ('PLMB', 'Plumbing'),
    ('CIVIL', 'Civil & Joinery'), ('FLS', 'Fire & Life Safety'), ('GEN', 'General Maintenance')
ON CONFLICT (code) DO NOTHING;
