# Shever Technical Services — Complete Facilities Management System (CAFM)

An enterprise-grade, production-ready **Facilities Management System (FM / CAFM)** engineered for **Shever Technical Services**.

The system provides:
1. **Web Admin & Management Portal** (React 18, TypeScript, Vite, Tailwind CSS, Recharts, jsPDF, SheetJS) for Administrators, FM Managers, and Supervisors.
2. **Android Technician Mobile App** (Flutter, Dart, Material 3, Riverpod, Offline Caching) for field technicians and supervisors.
3. **Normalized PostgreSQL Database Engine** (25 Relational Tables, Row Level Security, Automated Triggers, Auto-Numbering, Auto-PPM Rollover, SLA Engine, and Seed Data).

---

## Workspace Structure

```text
SHEVER TECHNICAL/
├── database/                        # PostgreSQL Database Schemas, RLS, Triggers & Seeds
│   ├── 01_schema.sql                # 25 Normalized Tables, Keys & Indexes
│   ├── 02_rls_policies.sql          # Fine-grained Row Level Security for all 4 roles
│   ├── 03_triggers_and_functions.sql # Auto WO numbering, SLA timers, Auto PPM next-due
│   ├── 04_seed_data.sql             # Realistic demo dataset (Buildings, Floors, Assets, WOs, PPMs)
│   └── README.md                    # Database setup instructions
├── web-admin/                       # React + TypeScript Web Management Portal
│   ├── src/
│   │   ├── api/                     # Supabase client & unified data services
│   │   ├── context/                 # AuthContext & role session management
│   │   ├── layouts/                 # DashboardLayout, Sidebar, Navbar
│   │   ├── pages/                   # Dashboard, WorkOrders, PPM, Assets, Buildings, Materials, Reports, Users, Settings, Audit
│   │   ├── types/                   # TypeScript interfaces matching database tables
│   │   └── utils/                   # PDF Generator (jsPDF), Excel Exporter (SheetJS)
│   ├── package.json
│   └── vite.config.ts
├── android-app/                     # Flutter Android Mobile Application
│   ├── lib/
│   │   ├── core/                    # Theme, Colors, Mock Data, Constants
│   │   ├── models/                  # WorkOrder, PPMPlan, Asset models
│   │   ├── providers/               # Riverpod state notifiers
│   │   └── presentation/            # Technician Dashboard, Work Orders, PPM Checklists, Assets, QR Scanner, Profile
│   └── pubspec.yaml
├── docs/                            # Architecture & Deployment Runbooks
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT.md
├── scripts/                         # Migration and deployment helper scripts
│   └── setup_supabase.ps1
├── .env.example                     # Environment variables configuration template
└── README.md
```

---

## Quick Start Guide

### 1. Database Setup (Supabase)
Execute the SQL files in `database/` in sequential order:
1. `01_schema.sql`
2. `02_rls_policies.sql`
3. `03_triggers_and_functions.sql`
4. `04_seed_data.sql`

### 2. Web Admin Portal
```powershell
cd web-admin
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

To generate a production build:
```powershell
npm run build
```

### 3. Android Mobile Application (Flutter)
```powershell
cd android-app
flutter pub get
flutter run
```

To build a release APK:
```powershell
flutter build apk --release
```

---

## Demo Accounts

| Role | Email | Password | Access Level |
|---|---|---|---|
| **Admin** | `admin@shever.com` | `Password123!` | Full control, User management, Settings, Audits |
| **FM Manager** | `manager@shever.com` | `Password123!` | Operations, Approval, Reports & Analytics |
| **Supervisor** | `supervisor@shever.com` | `Password123!` | WO/PPM assignment, Verification & sign-off |
| **Technician** | `technician@shever.com` | `Password123!` | Mobile tasks, Checklists, Photos & Signatures |
