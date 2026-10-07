# Reference: how the OCS ABi CAFM works

Notes from a read-only walkthrough of the production OCS ABi CAFM (cafm.ocsabi.io), 7 Oct 2026.
Structure and workflow only — no client, contract or staff data is recorded here.

## Modules (left menu)

| Module | Sub-pages |
|---|---|
| Dashboard | Work Orders Main · Work Orders RM (reactive) · Work Orders SM (scheduled) · Work Force · Inventory · Assets · Contracts · Asset Survey |
| Work Order | Work Orders · Dispatch Console · Schedule Maintenance · Checklist · Service Matrix |
| Work Permits | Templates · Requests |
| Assets | Asset Groups · All Assets · Facilities · Locations · Spaces · Subspaces · Equipment |
| Survey | Asset Surveys · Asset Condition Score Templates · Snags |
| Performance | Contracts (customer + subcontractor) · SLA |
| Inventory | Items · Suppliers · Warehouses |
| User Management | Users · Activity Log · Administrator / Personnel / Subcontractor / Customer groups · Tenant Users · Roles · Namespaces · Shift Settings · Leave Management · Geofences |
| IoT Integration | — |
| Reports | — |
| Settings | Currency · Parameters · Configurations · Import CSV · Assets Mapping · WO Settings (repeated WOs) |

Top bar: **Namespace** selector (client / business unit scope, "All" or one), global search, currency, language (EN/AR), notifications.

## Location / asset tree

Facility → Location → Space → Subspace → Equipment. A work order targets any node of that tree.
Matches our Facility → Building → Floor → Zone → Room → Asset (names differ, depth is the same).

## Work order list

- Status tabs with counts: **All · Unassigned · Pending · Rejected · Assigned · Enroute · On Site · In Progress · Waiting for Material · On Hold · Completed · Closed**
- Columns: ID · Status · Category · Start · Created · Completed · Due · Asset · Asset reference
- Toggles: **Subcontractor WOs**, **Overdue SM WOs**. Export CSV / PDF, column chooser, category filter, advanced filter
- Row markers: priority dot, overdue ⚠, attachment icon
- Categories seen: Reactive, Tenant Request, Other (plus scheduled maintenance)

## Create work order — 4-step wizard

1. **Main details** — Namespace* · Follow-up (toggle) · Repeated WO (toggle) · Category* · Start date* · Service requestor · Customer contract · Customer · Facility/Equipment · Job type (from Service Matrix) · Description · Subcontractor contract · Subcontractor · **Customer SLA priority** · **Subcontractor SLA priority** · Reported by · Linked WO
2. **Configurations** (settings such as Geo Check, Client Sign-off, Scan Start)
3. **Checklist**
4. **Assign users**

## Work order detail — 13 tabs

Header: WO number, job type (bilingual), category badge, priority badge, status, **Create a Linked WO**, Feedback, Close, PDF/export, edit.

| Tab | Content |
|---|---|
| Details | Description, WO number, created by/at, category, start/completed, customer, contract, reporter name/email/mobile, **Service Matrix** (Service Group → Service Type → Job Type), reporting-to users, estimated labour hours / labour cost / inventory cost, settings (**Geo Check, Client Sign Off, Scan Start**), asset path, **Customer feedback** (rating, name, signature, rated at), Tenant feedback, **Maintenance indicators** (symptoms, root cause), **Status changes** (status · time · user · role) |
| SLA | Customer SLA policy + priority, then **estimated vs actual** for: Helpdesk response · Technician initial response · Travel · Technician response SLA · Temporary restoration · Restoration · On-hold · Waiting for material · Response · Resolution · Duration · Overall duration |
| Expected Time | Per event — Pending by · Assign by · Travel by · Arrive by · Start by · Temp restore by · Complete by — with customer-SLA expected, subcontractor-SLA expected and actual time |
| Checklist | Checklist tasks for this WO |
| Workforce | Assigned users (role, trade + skill %, trainings) and an assignment history (pending → accepted per user) |
| Inventory Item | Inventory usage + requests, estimated vs actual inventory cost, item / stock / used qty / unit cost |
| Timeline | Event timeline |
| Time Log | Total labour hours, total travel hours, per-person records (Travel / Labour, system or **manual**), start / end / duration |
| Before & After | Photos |
| Note · Docs | Notes and attachments |
| Measurements | Readings |
| Work Permits | Permits linked to the job |

Technician flow seen on a completed job: **Pending → Assigned → Enroute → On Site → In Progress → Completed**, then customer rating + signature, then Close.

## SLA policies

- One policy per customer/contract, each with 3–5 named priorities (e.g. Emergency P0, Urgent P1, Routine P2, Scheduled P3, Additional Works P6)
- Each priority: **Response time, Restoration time, Resolution time** (or a single Duration for planned work)
- Per priority flags: does **Waiting for Material** pause restoration / resolution / duration
- Priorities can be added from templates

## Service Matrix

Three-level catalogue: **Service Group** (Hard / Soft services) → **Service Type** (HVAC, Cleaning, Landscaping…) → **Job Type** (specific fault, bilingual). Bulk import, copy between namespaces, export CSV.

## Dispatch Console

Left: unassigned WO cards (RM / SM filter) with priority, job type, space, customer, start. Right: technician rows (personnel / subcontractor) on a Day / Week / Month time grid — drag jobs onto people.

## Scheduled maintenance

List of PPM schedules (name, service job, start, end, trigger frequency) plus a **Planner** view. Checklists are a reusable library (212 templates, e.g. "MEP – Chiller – PPM Checklist", task counts), with CSV import/export.

## Contracts

Customer contracts and subcontractor contracts. Status tabs: Active · Grace Period · Renew Period · Renewed · Expired · Deactivated. Fields include ERP reference and service-order job number.
