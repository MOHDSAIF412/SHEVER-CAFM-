-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - FACILITIES MANAGEMENT SYSTEM (CAFM)
-- 03_TRIGGERS_AND_FUNCTIONS.SQL: Auto-sequences, SLA engines, Auto-PPM, Audits
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. AUTO-GENERATION OF SEQUENCES (WO-YYYY-XXXXXX & PPM-YYYY-XXXXXX)
-- ------------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS wo_sequence START 100001;
CREATE SEQUENCE IF NOT EXISTS ppm_sequence START 100001;

CREATE OR REPLACE FUNCTION generate_wo_number()
RETURNS TRIGGER AS $$
DECLARE
    curr_year TEXT;
    prefix TEXT;
    seq_val BIGINT;
BEGIN
    IF NEW.wo_number IS NULL OR NEW.wo_number = '' THEN
        curr_year := TO_CHAR(NOW(), 'YYYY');
        SELECT COALESCE(wo_prefix, 'WO') INTO prefix FROM system_settings WHERE id = 1 LIMIT 1;
        IF prefix IS NULL THEN prefix := 'WO'; END IF;
        seq_val := nextval('wo_sequence');
        NEW.wo_number := prefix || '-' || curr_year || '-' || LPAD(seq_val::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_wo_number
BEFORE INSERT ON work_orders
FOR EACH ROW
EXECUTE FUNCTION generate_wo_number();


CREATE OR REPLACE FUNCTION generate_ppm_schedule_number()
RETURNS TRIGGER AS $$
DECLARE
    curr_year TEXT;
    prefix TEXT;
    seq_val BIGINT;
BEGIN
    IF NEW.schedule_number IS NULL OR NEW.schedule_number = '' THEN
        curr_year := TO_CHAR(NOW(), 'YYYY');
        SELECT COALESCE(ppm_prefix, 'PPM') INTO prefix FROM system_settings WHERE id = 1 LIMIT 1;
        IF prefix IS NULL THEN prefix := 'PPM'; END IF;
        seq_val := nextval('ppm_sequence');
        NEW.schedule_number := prefix || '-' || curr_year || '-' || LPAD(seq_val::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_ppm_schedule_number
BEFORE INSERT ON ppm_schedules
FOR EACH ROW
EXECUTE FUNCTION generate_ppm_schedule_number();

-- ------------------------------------------------------------------------------
-- 2. AUTOMATIC SLA COMPUTATION ON WORK ORDER CREATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_work_order_sla()
RETURNS TRIGGER AS $$
DECLARE
    v_resp_min INTEGER;
    v_reso_hr NUMERIC(6,2);
BEGIN
    SELECT response_time_minutes, resolution_time_hours 
    INTO v_resp_min, v_reso_hr
    FROM sla_configs 
    WHERE id = NEW.priority;

    IF FOUND THEN
        IF NEW.response_due_at IS NULL THEN
            NEW.response_due_at := NEW.created_at + (v_resp_min || ' minutes')::INTERVAL;
        END IF;
        IF NEW.resolution_due_at IS NULL THEN
            NEW.resolution_due_at := NEW.created_at + (v_reso_hr || ' hours')::INTERVAL;
        END IF;
        IF NEW.target_completion_at IS NULL THEN
            NEW.target_completion_at := NEW.resolution_due_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_wo_sla
BEFORE INSERT ON work_orders
FOR EACH ROW
EXECUTE FUNCTION compute_work_order_sla();

-- ------------------------------------------------------------------------------
-- 3. WORK ORDER STATUS CHANGE AUDIT & TIMESTAMPS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by, comments)
        VALUES (NEW.id, NULL, NEW.status, auth.uid(), 'Work order created');
    ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Record timestamp transitions
        IF NEW.status = 'Accepted' AND OLD.status != 'Accepted' THEN
            NEW.accepted_at := NOW();
        ELSIF NEW.status = 'In Progress' AND OLD.status != 'In Progress' THEN
            IF NEW.started_at IS NULL THEN NEW.started_at := NOW(); END IF;
            -- Compute response time
            IF NEW.response_time_minutes IS NULL AND NEW.created_at IS NOT NULL THEN
                NEW.response_time_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 60;
            END IF;
        ELSIF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
            IF NEW.completed_at IS NULL THEN NEW.completed_at := NOW(); END IF;
            -- Compute resolution time
            IF NEW.started_at IS NOT NULL THEN
                NEW.resolution_time_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60;
            END IF;
        ELSIF NEW.status = 'Pending Approval' AND OLD.status != 'Pending Approval' THEN
            IF NEW.completed_at IS NULL THEN NEW.completed_at := NOW(); END IF;
        ELSIF NEW.status = 'Closed' AND OLD.status != 'Closed' THEN
            NEW.approved_at := COALESCE(NEW.approved_at, NOW());
            NEW.closed_at := NOW();
        END IF;

        NEW.updated_at := NOW();

        -- Insert status transition history
        INSERT INTO work_order_status_history (work_order_id, from_status, to_status, changed_by, comments)
        VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), 
            CASE 
                WHEN NEW.status = 'Cancelled' THEN 'Cancelled by user/manager'
                WHEN NEW.rejection_reason IS NOT NULL AND NEW.status = 'In Progress' THEN 'Returned by supervisor: ' || NEW.rejection_reason
                ELSE 'Status changed from ' || OLD.status || ' to ' || NEW.status 
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wo_status_transition
BEFORE INSERT OR UPDATE OF status ON work_orders
FOR EACH ROW
EXECUTE FUNCTION handle_work_order_status_change();

-- ------------------------------------------------------------------------------
-- 4. MATERIAL INVENTORY DEDUCTION ON WORK ORDER CONSUMPTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_material_stock_on_use()
RETURNS TRIGGER AS $$
BEGIN
    -- Deduct stock
    UPDATE materials 
    SET quantity_in_stock = quantity_in_stock - NEW.quantity_used,
        updated_at = NOW()
    WHERE id = NEW.material_id;

    -- Record material transaction
    INSERT INTO material_transactions (
        material_id, transaction_type, quantity, reference_type, reference_id, performed_by, notes
    ) VALUES (
        NEW.material_id, 'OUT', NEW.quantity_used, 'WORK_ORDER', NEW.work_order_id, auth.uid(), 'Used in Work Order'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deduct_material
AFTER INSERT ON work_order_materials
FOR EACH ROW
EXECUTE FUNCTION deduct_material_stock_on_use();

-- ------------------------------------------------------------------------------
-- 5. AUTOMATIC NEXT PPM DUE DATE GENERATION ON COMPLETION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_next_ppm_date(p_freq TEXT, p_custom_days INT, p_base_date DATE)
RETURNS DATE AS $$
BEGIN
    CASE p_freq
        WHEN 'Daily' THEN RETURN p_base_date + INTERVAL '1 day';
        WHEN 'Weekly' THEN RETURN p_base_date + INTERVAL '7 days';
        WHEN 'Monthly' THEN RETURN p_base_date + INTERVAL '1 month';
        WHEN 'Quarterly' THEN RETURN p_base_date + INTERVAL '3 months';
        WHEN 'Half-Yearly' THEN RETURN p_base_date + INTERVAL '6 months';
        WHEN 'Yearly' THEN RETURN p_base_date + INTERVAL '1 year';
        WHEN 'Custom' THEN RETURN p_base_date + (COALESCE(p_custom_days, 30) || ' days')::INTERVAL;
        ELSE RETURN p_base_date + INTERVAL '1 month';
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION handle_ppm_schedule_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_plan ppm_plans%ROWTYPE;
    v_next_due DATE;
BEGIN
    -- When PPM schedule is approved / completed
    IF NEW.status IN ('Completed', 'Closed') AND OLD.status NOT IN ('Completed', 'Closed') THEN
        SELECT * INTO v_plan FROM ppm_plans WHERE id = NEW.ppm_plan_id;
        
        IF FOUND AND v_plan.is_active THEN
            v_next_due := calculate_next_ppm_date(v_plan.frequency, v_plan.custom_interval_days, NEW.due_date);
            
            -- Update plan next_due_date
            UPDATE ppm_plans 
            SET next_due_date = v_next_due,
                updated_at = NOW()
            WHERE id = v_plan.id;

            -- Automatically create next scheduled run
            INSERT INTO ppm_schedules (
                ppm_plan_id, due_date, status, assigned_technician_id, assigned_supervisor_id
            ) VALUES (
                v_plan.id, v_next_due, 'Scheduled', v_plan.assigned_technician_id, v_plan.assigned_supervisor_id
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ppm_completion_rollover
AFTER UPDATE OF status ON ppm_schedules
FOR EACH ROW
EXECUTE FUNCTION handle_ppm_schedule_completion();

-- ------------------------------------------------------------------------------
-- 6. DYNAMIC OVERDUE STATUS CHECKER (Can be run on schedule or via API)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_overdue_statuses()
RETURNS VOID AS $$
BEGIN
    -- Update overdue work orders
    UPDATE work_orders
    SET is_overdue = TRUE
    WHERE status NOT IN ('Completed', 'Pending Approval', 'Closed', 'Cancelled')
      AND resolution_due_at < NOW()
      AND is_overdue = FALSE;

    -- Update overdue PPM schedules
    UPDATE ppm_schedules
    SET is_overdue = TRUE
    WHERE status NOT IN ('Completed', 'Closed', 'Cancelled')
      AND due_date < CURRENT_DATE
      AND is_overdue = FALSE;
END;
$$ LANGUAGE plpgsql;
