-- ==============================================================================
-- OCS CAFM - 12_CHECKLISTS.SQL
-- Step 6: PPM checklists.
--
-- Checklists are for PPM (planned maintenance) only. Reactive, on-call,
-- corrective and quoted jobs do not carry a checklist.
--
--   * Templates stay in ppm_checklists / ppm_checklist_items, now with sections
--     and the priority of the corrective job a failed item raises.
--   * A PPM work order carries its plan's checklist (work_orders.checklist_id);
--     answers live in wo_checklist_responses.
--   * A PPM job cannot move to Work Done while mandatory items are unanswered
--     or photo-required items have no photo.
--
-- Additive. Safe to re-run.
-- ==============================================================================

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS checklist_id TEXT REFERENCES ppm_checklists(id) ON DELETE SET NULL;

ALTER TABLE ppm_checklist_items ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE ppm_checklist_items ADD COLUMN IF NOT EXISTS fail_priority TEXT DEFAULT 'P3'
    CHECK (fail_priority IN ('P1','P2','P3','P4'));

ALTER TABLE wo_checklist_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- An earlier draft linked checklists to reactive job types; PPM only now.
DROP TRIGGER IF EXISTS trg_cafm_wo_default_checklist ON work_orders;
DROP FUNCTION IF EXISTS cafm_wo_default_checklist();
ALTER TABLE job_types DROP CONSTRAINT IF EXISTS fk_job_types_checklist;

-- ------------------------------------------------------------------------------
-- A PPM checklist must be finished before Work Done
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cafm_wo_checklist_gate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_missing INTEGER;
    v_first TEXT;
BEGIN
    IF NEW.status = 'Work Done' AND OLD.status IS DISTINCT FROM 'Work Done'
       AND NEW.wo_type = 'PPM' AND NEW.checklist_id IS NOT NULL THEN
        SELECT count(*), min(i.task_description) INTO v_missing, v_first
          FROM ppm_checklist_items i
          LEFT JOIN wo_checklist_responses r ON r.checklist_item_id = i.id AND r.work_order_id = NEW.id
         WHERE i.checklist_id = NEW.checklist_id
           AND (
                (i.is_mandatory AND (r.id IS NULL OR (r.result IS NULL AND r.reading IS NULL AND COALESCE(r.text_value, '') = '' AND r.photo_url IS NULL)))
             OR ((i.photo_required OR i.field_type = 'photo_required') AND COALESCE(r.result, '') <> 'N/A' AND (r.id IS NULL OR r.photo_url IS NULL))
           );
        IF v_missing > 0 THEN
            RAISE EXCEPTION 'Checklist not finished: % item(s) still need an answer or photo (e.g. "%").', v_missing, v_first
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cafm_wo_checklist_gate ON work_orders;
CREATE TRIGGER trg_cafm_wo_checklist_gate BEFORE UPDATE OF status ON work_orders
    FOR EACH ROW EXECUTE FUNCTION cafm_wo_checklist_gate();
REVOKE ALL ON FUNCTION cafm_wo_checklist_gate() FROM PUBLIC, anon, authenticated;
