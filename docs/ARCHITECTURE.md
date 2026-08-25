# System Architecture & Technical Specifications

**Facilities Management System (CAFM) — Shever Technical Services**

---

## 1. Architectural Layers

### A. Presentation Layer
- **Web Management Portal (`/web-admin`)**: Built with **React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, jsPDF, and SheetJS (XLSX)**.
  - Multi-role support (`Admin`, `FM Manager`, `Supervisor`).
  - Real-time SLA monitoring and automated countdown timers.
  - Interactive PDF Work Order generation with branding, before/after photos, and supervisor signatures.
  - Asset 360° views with live SVG QR Code badge rendering and printable label sheets.
  
- **Android Mobile Application (`/android-app`)**: Built with **Flutter (Dart), Material 3, and Riverpod State Management**.
  - Optimized for field technicians with touch targets and high-contrast color badges (`Emergency = Red`, `High = Orange`, `Medium = Yellow`, `Low = Green`).
  - Interactive PPM Checklist runner with real-time numeric reading validations (within safe threshold boundaries).
  - Step-by-step Reactive Work Order execution (`Accept` -> `Start` -> `Materials Consumed` -> `Photos` -> `Digital Signature` -> `Submit for Approval`).
  - Offline-first cache architecture to ensure zero data loss during field network disconnects.

### B. Data & Engine Layer
- **PostgreSQL Database (`/database`)**: 25 normalized tables covering:
  - Profiles & Role-Based Access Control (RBAC)
  - Facility Hierarchy (Buildings, Floors, Locations/Rooms)
  - Asset Registry & Lifecycle Tracking
  - Reactive Work Orders & Immutable Status Audit History
  - Spare Parts Inventory & Material Consumption
  - PPM Recurrence Rules, Schedules, and Dynamic Checklists
  - Digital Signatures, Notifications & Immutable Audit Logs.
- **Automation Triggers**:
  - `trg_generate_wo_number`: Automatically prefixes and sequences `WO-YYYY-XXXXXX`.
  - `trg_generate_ppm_schedule_number`: Automatically sequences `PPM-YYYY-XXXXXX`.
  - `trg_compute_wo_sla`: Automatically configures response and resolution deadlines from priority rules.
  - `trg_ppm_completion_rollover`: Automatically calculates and generates the next scheduled preventive run upon supervisor completion/approval.
  - `trg_deduct_material`: Deducts inventory stock and registers transactions upon technician usage.
- **Row Level Security (RLS)**: Enforces access restrictions across all database operations.
