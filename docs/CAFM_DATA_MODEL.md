# OCS CAFM — Data Model (Step 2)

Migration: [`database/09_cafm_core_model.sql`](../database/09_cafm_core_model.sql). Additive only — the Supabase
project is shared with the FM Condition Survey app, so no existing table or column is renamed or dropped.

## Location tree and assets

```
Client ─┬─ Contract ─┬─ Facility ── Building ── Floor ── Zone ── Room (locations)
        │            │                                              │
        │            │                                           Asset ── child assets (parent_asset_id)
        │            ├─ SLA policies (P1–P4, override the defaults)
        │            └─ Labour rates (trade × grade × Normal/Overtime/Holiday)
```

Every asset and work order stores `facility_id` as well as building/floor/room, so reports can roll up at any level.

## Work orders

| `wo_type`   | Typical source           | Billing (`is_chargeable`, `billing_status`) |
|-------------|--------------------------|---------------------------------------------|
| PPM         | PPM schedule             | In contract                                 |
| Reactive    | Helpdesk / QR / AI agent | In contract up to `reactive_cover_limit`    |
| On-call     | After-hours call         | Chargeable: call-out + labour + materials + markup |
| Corrective  | Failed checklist item    | `parent_wo_id` points to the PPM; often quoted |
| Quoted      | Client request           | Quote → approval → invoice                  |

SLA: `sla_priority` + `sla_policy_id`; response clock ends at `arrived_at`, resolution at `completed_at`.
`wo_sla_pauses` holds On-Hold periods (parts / access / client approval) that stop the clock.

## Costing → billing

`wo_labour`, `work_order_materials` (Store or Direct Purchase), `wo_subcontract_costs` → trigger recalculates
`wo_costing`:

```
total_cost = labour_cost + material_cost + subcontract_cost
total_sell = max( (labour_sell + material_sell + subcontract_sell) × (1 + markup%) + call-out − discount,
                  minimum_charge )          ← minimum charge is entered manually per job
```

`quotes` / `invoices` with `billing_lines`, all AED. VAT is a setting (`system_settings.vat_enabled`, `vat_rate` = 5),
off by default.

## Checklists

Templates stay in `ppm_checklists` / `ppm_checklist_items` (now with `applies_to`, `photo_required`,
`raise_corrective_on_fail`). Answers for any work order go to `wo_checklist_responses`.

## AI

`ai_suggestions` logs every AI proposal (job logging, nameplate OCR, voice report, duplicate check, SLA risk,
quote draft) with its status — AI suggests, a person accepts, edits or rejects.

## Known gap — security

New tables follow the existing `cafm_app_access_*` policies, which let the anonymous key read and write
everything. This must be replaced with role-based policies (admin / manager / supervisor / technician /
finance) before real client data goes in.
