-- ==============================================================================
-- OCS CAFM - 15_BILLING.SQL
-- Step 9: quotes and AED invoices.
--
-- The rule for chargeable jobs (On-call, Quoted):
--     Completed -> To Bill -> Invoiced -> Paid  =  job Closed
--   * Completing a chargeable job puts it on the "To Bill" list (step 11).
--   * Issuing an invoice marks its jobs Invoiced.
--   * Marking the invoice Paid marks its jobs Paid and CLOSES them.
--   * A chargeable job cannot be closed by hand until it is Paid (or a
--     manager writes it off). Contract jobs close as before.
--   * Cancelling an issued invoice puts its jobs back on To Bill.
--
-- Numbers: INV-2026-0001 / QT-2026-0001 (prefixes from system settings).
-- VAT: off by default; when on, the rate from settings is frozen on the
-- invoice when it is created.
-- Additive only.
-- ==============================================================================

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER DEFAULT 30;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS bank_details TEXT;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS company_address TEXT;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_po_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS quote_id TEXT REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wo_invoice ON work_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_lines_invoice ON billing_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_billing_lines_quote ON billing_lines(quote_id);

-- ------------------------------------------------------------------------------
-- Numbers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_next_doc_number(p_kind TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_prefix TEXT;
    v_year TEXT := to_char(NOW() AT TIME ZONE 'Asia/Dubai', 'YYYY');
    v_max INTEGER;
BEGIN
    SELECT CASE WHEN p_kind = 'invoice' THEN COALESCE(invoice_prefix, 'INV') ELSE COALESCE(quote_prefix, 'QT') END
      INTO v_prefix FROM system_settings ORDER BY id LIMIT 1;
    v_prefix := COALESCE(v_prefix, CASE WHEN p_kind = 'invoice' THEN 'INV' ELSE 'QT' END) || '-' || v_year || '-';
    -- Serialise numbering per kind so two users never get the same number.
    PERFORM pg_advisory_xact_lock(hashtext('cafm_doc_' || p_kind));
    IF p_kind = 'invoice' THEN
        SELECT MAX(NULLIF(regexp_replace(substr(invoice_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int)
          INTO v_max FROM invoices WHERE invoice_number LIKE v_prefix || '%';
    ELSE
        SELECT MAX(NULLIF(regexp_replace(substr(quote_number, length(v_prefix) + 1), '\D', '', 'g'), '')::int)
          INTO v_max FROM quotes WHERE quote_number LIKE v_prefix || '%';
    END IF;
    RETURN v_prefix || lpad((COALESCE(v_max, 0) + 1)::text, 4, '0');
END $$;

CREATE OR REPLACE FUNCTION cafm_doc_defaults()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s system_settings%ROWTYPE;
BEGIN
    SELECT * INTO s FROM system_settings ORDER BY id LIMIT 1;
    IF TG_TABLE_NAME = 'invoices' THEN
        IF COALESCE(NEW.invoice_number, '') = '' THEN NEW.invoice_number := cafm_next_doc_number('invoice'); END IF;
        IF NEW.vat_rate IS NULL OR TG_OP = 'INSERT' THEN
            NEW.vat_rate := CASE WHEN COALESCE(s.vat_enabled, FALSE) THEN COALESCE(s.vat_rate, 5) ELSE 0 END;
        END IF;
    ELSE
        IF COALESCE(NEW.quote_number, '') = '' THEN NEW.quote_number := cafm_next_doc_number('quote'); END IF;
        IF TG_OP = 'INSERT' THEN
            NEW.vat_rate := CASE WHEN COALESCE(s.vat_enabled, FALSE) THEN COALESCE(s.vat_rate, 5) ELSE 0 END;
            NEW.valid_until := COALESCE(NEW.valid_until, (NOW() AT TIME ZONE 'Asia/Dubai')::date + 30);
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_defaults ON invoices;
CREATE TRIGGER trg_invoice_defaults BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION cafm_doc_defaults();
DROP TRIGGER IF EXISTS trg_quote_defaults ON quotes;
CREATE TRIGGER trg_quote_defaults BEFORE INSERT ON quotes FOR EACH ROW EXECUTE FUNCTION cafm_doc_defaults();

-- ------------------------------------------------------------------------------
-- Lines and totals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_billing_line_before()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT; v_other TEXT;
BEGIN
    NEW.quantity := COALESCE(NEW.quantity, 1);
    NEW.unit_price := COALESCE(NEW.unit_price, 0);
    NEW.amount := ROUND(NEW.quantity * NEW.unit_price, 2);

    -- Only draft documents can change.
    IF NEW.invoice_id IS NOT NULL THEN
        SELECT status INTO v_status FROM invoices WHERE id = NEW.invoice_id;
        IF v_status <> 'Draft' THEN RAISE EXCEPTION 'This invoice is %; only draft invoices can be changed.', lower(v_status); END IF;
        -- A job is billed once.
        IF NEW.work_order_id IS NOT NULL THEN
            SELECT i.invoice_number INTO v_other FROM billing_lines l JOIN invoices i ON i.id = l.invoice_id
             WHERE l.work_order_id = NEW.work_order_id AND l.invoice_id <> NEW.invoice_id AND i.status <> 'Cancelled' LIMIT 1;
            IF v_other IS NOT NULL THEN RAISE EXCEPTION 'This job is already on invoice %.', v_other; END IF;
        END IF;
    END IF;
    IF NEW.quote_id IS NOT NULL THEN
        SELECT status INTO v_status FROM quotes WHERE id = NEW.quote_id;
        IF v_status NOT IN ('Draft') THEN RAISE EXCEPTION 'This quote is %; only draft quotes can be changed.', lower(v_status); END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_billing_line_before ON billing_lines;
CREATE TRIGGER trg_billing_line_before BEFORE INSERT OR UPDATE ON billing_lines FOR EACH ROW EXECUTE FUNCTION cafm_billing_line_before();

CREATE OR REPLACE FUNCTION cafm_billing_line_delete_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status TEXT;
BEGIN
    IF OLD.invoice_id IS NOT NULL THEN
        SELECT status INTO v_status FROM invoices WHERE id = OLD.invoice_id;
        -- v_status is NULL while the invoice itself is being deleted (cascade).
        IF v_status IS NOT NULL AND v_status <> 'Draft' THEN RAISE EXCEPTION 'Only draft invoices can be changed.'; END IF;
    END IF;
    IF OLD.quote_id IS NOT NULL THEN
        SELECT status INTO v_status FROM quotes WHERE id = OLD.quote_id;
        IF v_status IS NOT NULL AND v_status <> 'Draft' THEN RAISE EXCEPTION 'Only draft quotes can be changed.'; END IF;
    END IF;
    RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_billing_line_delete_guard ON billing_lines;
CREATE TRIGGER trg_billing_line_delete_guard BEFORE DELETE ON billing_lines FOR EACH ROW EXECUTE FUNCTION cafm_billing_line_delete_guard();

CREATE OR REPLACE FUNCTION cafm_recalc_billing_doc(p_invoice TEXT, p_quote TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub NUMERIC;
BEGIN
    IF p_invoice IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_sub FROM billing_lines WHERE invoice_id = p_invoice;
        UPDATE invoices SET subtotal = v_sub, vat_amount = ROUND(v_sub * COALESCE(vat_rate, 0) / 100, 2),
               total = v_sub + ROUND(v_sub * COALESCE(vat_rate, 0) / 100, 2), updated_at = NOW()
         WHERE id = p_invoice;
    END IF;
    IF p_quote IS NOT NULL THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_sub FROM billing_lines WHERE quote_id = p_quote;
        UPDATE quotes SET subtotal = v_sub, vat_amount = ROUND(v_sub * COALESCE(vat_rate, 0) / 100, 2),
               total = v_sub + ROUND(v_sub * COALESCE(vat_rate, 0) / 100, 2), updated_at = NOW()
         WHERE id = p_quote;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION cafm_billing_line_after()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP <> 'DELETE' THEN PERFORM cafm_recalc_billing_doc(NEW.invoice_id, NEW.quote_id); END IF;
    IF TG_OP <> 'INSERT' THEN PERFORM cafm_recalc_billing_doc(OLD.invoice_id, OLD.quote_id); END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_billing_line_after ON billing_lines;
CREATE TRIGGER trg_billing_line_after AFTER INSERT OR UPDATE OR DELETE ON billing_lines FOR EACH ROW EXECUTE FUNCTION cafm_billing_line_after();

-- VAT rate edited on a draft: re-total.
CREATE OR REPLACE FUNCTION cafm_doc_vat_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN PERFORM cafm_recalc_billing_doc(NEW.id, NULL);
    ELSE PERFORM cafm_recalc_billing_doc(NULL, NEW.id); END IF;
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_vat_change ON invoices;
CREATE TRIGGER trg_invoice_vat_change AFTER UPDATE OF vat_rate ON invoices FOR EACH ROW EXECUTE FUNCTION cafm_doc_vat_change();
DROP TRIGGER IF EXISTS trg_quote_vat_change ON quotes;
CREATE TRIGGER trg_quote_vat_change AFTER UPDATE OF vat_rate ON quotes FOR EACH ROW EXECUTE FUNCTION cafm_doc_vat_change();

-- ------------------------------------------------------------------------------
-- Invoice lifecycle drives the jobs:  Issued -> Invoiced,  Paid -> Paid + Closed
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_invoice_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lines INTEGER; s system_settings%ROWTYPE;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

    IF NOT ((OLD.status = 'Draft' AND NEW.status IN ('Issued', 'Cancelled'))
         OR (OLD.status = 'Issued' AND NEW.status IN ('Paid', 'Cancelled'))
         OR (OLD.status = 'Paid' AND NEW.status = 'Issued')) THEN   -- undo a wrong "paid"
        RAISE EXCEPTION 'An invoice cannot go from % to %.', OLD.status, NEW.status;
    END IF;
    PERFORM set_config('cafm.billing_sync', 'on', TRUE);   -- lets the job updates below past the billing guard

    IF NEW.status = 'Issued' AND OLD.status = 'Draft' THEN
        SELECT count(*) INTO v_lines FROM billing_lines WHERE invoice_id = NEW.id;
        IF v_lines = 0 THEN RAISE EXCEPTION 'Add at least one line before issuing the invoice.'; END IF;
        IF NEW.client_id IS NULL THEN RAISE EXCEPTION 'Choose the client before issuing the invoice.'; END IF;
        SELECT * INTO s FROM system_settings ORDER BY id LIMIT 1;
        NEW.issued_at := NOW();
        NEW.issue_date := COALESCE(NEW.issue_date, (NOW() AT TIME ZONE 'Asia/Dubai')::date);
        NEW.due_date := COALESCE(NEW.due_date, NEW.issue_date + COALESCE(s.payment_terms_days, 30));
        UPDATE work_orders SET billing_status = 'Invoiced', invoice_id = NEW.id, updated_at = NOW()
         WHERE id IN (SELECT work_order_id FROM billing_lines WHERE invoice_id = NEW.id AND work_order_id IS NOT NULL);
    END IF;

    IF NEW.status = 'Paid' THEN
        NEW.paid_at := COALESCE(NEW.paid_at, NOW());
        -- Paid = closed. Jobs not yet verified keep their status but are paid.
        UPDATE work_orders SET billing_status = 'Paid',
               status = CASE WHEN status IN ('Completed', 'Work Done') THEN 'Closed' ELSE status END,
               updated_at = NOW()
         WHERE invoice_id = NEW.id;
    END IF;

    IF NEW.status = 'Issued' AND OLD.status = 'Paid' THEN
        NEW.paid_at := NULL;
        NEW.payment_ref := NULL;
        UPDATE work_orders SET billing_status = 'Invoiced',
               status = CASE WHEN status = 'Closed' THEN 'Completed' ELSE status END, updated_at = NOW()
         WHERE invoice_id = NEW.id;
    END IF;

    IF NEW.status = 'Cancelled' THEN
        UPDATE work_orders SET billing_status = 'To Bill', invoice_id = NULL, updated_at = NOW()
         WHERE invoice_id = NEW.id;
    END IF;
    PERFORM set_config('cafm.billing_sync', 'off', TRUE);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_status_change ON invoices;
CREATE TRIGGER trg_invoice_status_change BEFORE UPDATE OF status ON invoices FOR EACH ROW EXECUTE FUNCTION cafm_invoice_status_change();

-- Issued/paid invoices are a legal record: lock everything except the
-- payment fields and status moves above.
CREATE OR REPLACE FUNCTION cafm_invoice_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'Draft' THEN RAISE EXCEPTION 'Only draft invoices can be deleted. Cancel it instead.'; END IF;
        RETURN OLD;
    END IF;
    IF OLD.status <> 'Draft' AND (
        NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
        OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
        OR (NEW.subtotal IS DISTINCT FROM OLD.subtotal AND OLD.status <> 'Draft')) THEN
        RAISE EXCEPTION 'Invoice % is %; it can no longer be edited.', OLD.invoice_number, lower(OLD.status);
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_invoice_lock ON invoices;
CREATE TRIGGER trg_invoice_lock BEFORE UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION cafm_invoice_lock();

-- ------------------------------------------------------------------------------
-- A chargeable job closes only when paid (or written off).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_wo_close_guard()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.status = 'Closed' AND OLD.status IS DISTINCT FROM 'Closed'
       AND COALESCE(NEW.is_chargeable, FALSE)
       AND COALESCE(NEW.billing_status, '') NOT IN ('Paid', 'Written Off') THEN
        RAISE EXCEPTION 'This is a chargeable job: it closes automatically when its invoice is paid.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_close_guard ON work_orders;
CREATE TRIGGER trg_wo_close_guard BEFORE UPDATE OF status ON work_orders FOR EACH ROW EXECUTE FUNCTION cafm_wo_close_guard();

-- Billing fields on a job move only through invoices, or by a manager
-- (e.g. write-off). Completing a chargeable job may move it to To Bill.
CREATE OR REPLACE FUNCTION cafm_wo_billing_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL OR current_setting('cafm.billing_sync', TRUE) = 'on' OR cafm_has_role('admin', 'fm_manager') THEN
        RETURN NEW;
    END IF;
    IF NEW.billing_status IS DISTINCT FROM OLD.billing_status
       AND NOT (OLD.billing_status = 'Not Billable' AND NEW.billing_status = 'To Bill' AND NEW.status = 'Completed') THEN
        RAISE EXCEPTION 'Only a manager can change the billing status.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
       OR (NEW.is_chargeable IS DISTINCT FROM OLD.is_chargeable AND NOT cafm_has_role('supervisor')) THEN
        RAISE EXCEPTION 'Only a manager can change billing on a job.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wo_billing_guard ON work_orders;
CREATE TRIGGER trg_wo_billing_guard BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION cafm_wo_billing_guard();

-- Quote approved: stamp it.
CREATE OR REPLACE FUNCTION cafm_quote_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    IF NEW.status = 'Sent' THEN NEW.sent_at := COALESCE(NEW.sent_at, NOW()); END IF;
    IF NEW.status = 'Approved' THEN NEW.approved_at := COALESCE(NEW.approved_at, NOW()); END IF;
    IF NEW.status = 'Draft' THEN NEW.sent_at := NULL; NEW.approved_at := NULL; END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_quote_status_change ON quotes;
CREATE TRIGGER trg_quote_status_change BEFORE UPDATE OF status ON quotes FOR EACH ROW EXECUTE FUNCTION cafm_quote_status_change();

-- Supervisors may raise draft quotes and invoices; managers issue, approve and
-- record payment (existing commercial policies: insert any CAFM user ->
-- tighten to supervisor and above).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['quotes', 'invoices', 'billing_lines', 'clients', 'contracts'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS cafm_insert ON %I', t);
        EXECUTE format('CREATE POLICY cafm_insert ON %I FOR INSERT TO authenticated WITH CHECK (cafm_has_role(''admin'', ''fm_manager'', ''supervisor''))', t);
    END LOOP;
    -- Draft lines can be removed by managers (admins already could).
    DROP POLICY IF EXISTS cafm_delete_manager ON billing_lines;
    CREATE POLICY cafm_delete_manager ON billing_lines FOR DELETE TO authenticated USING (cafm_has_role('admin', 'fm_manager'));
    DROP POLICY IF EXISTS cafm_delete_manager ON invoices;
    CREATE POLICY cafm_delete_manager ON invoices FOR DELETE TO authenticated USING (cafm_has_role('admin', 'fm_manager'));
    DROP POLICY IF EXISTS cafm_delete_manager ON quotes;
    CREATE POLICY cafm_delete_manager ON quotes FOR DELETE TO authenticated USING (cafm_has_role('admin', 'fm_manager'));
END $$;

REVOKE ALL ON FUNCTION cafm_next_doc_number(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_recalc_billing_doc(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_doc_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_billing_line_before() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_billing_line_delete_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_billing_line_after() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_doc_vat_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_invoice_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_invoice_lock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_quote_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_wo_close_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION cafm_wo_billing_guard() FROM PUBLIC, anon, authenticated;

-- Supervisors edit drafts (and may mark a quote sent); managers issue,
-- approve, record payment and cancel. Line edits are limited to drafts by
-- the line triggers above.
DROP POLICY IF EXISTS cafm_update_draft_supervisor ON quotes;
CREATE POLICY cafm_update_draft_supervisor ON quotes FOR UPDATE TO authenticated
  USING (cafm_has_role('supervisor') AND status = 'Draft')
  WITH CHECK (cafm_has_role('supervisor') AND status IN ('Draft', 'Sent'));
DROP POLICY IF EXISTS cafm_update_draft_supervisor ON invoices;
CREATE POLICY cafm_update_draft_supervisor ON invoices FOR UPDATE TO authenticated
  USING (cafm_has_role('supervisor') AND status = 'Draft')
  WITH CHECK (cafm_has_role('supervisor') AND status = 'Draft');
DROP POLICY IF EXISTS cafm_delete_supervisor ON billing_lines;
CREATE POLICY cafm_delete_supervisor ON billing_lines FOR DELETE TO authenticated USING (cafm_has_role('supervisor'));
