# Deployment & Production Runbook — Shever CAFM

This document outlines the step-by-step instructions to deploy the Web Admin Portal, build the Android APK/AAB release, and configure the Supabase production database.

---

## 1. Supabase Backend Setup

1. Create a project on [Supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Execute the SQL migration scripts in this order:
   - `database/01_schema.sql`
   - `database/02_rls_policies.sql`
   - `database/03_triggers_and_functions.sql`
   - `database/04_seed_data.sql`
4. Create the following **Storage Buckets** in Supabase Storage with public/authenticated read:
   - `work-order-photos`
   - `ppm-photos`
   - `signatures`
   - `asset-docs`
5. Copy your **Project URL** and **anon public API Key** from `Settings > API`.

---

## 2. Web Admin Portal Deployment (React + Vite)

### Local Development
```powershell
cd web-admin
npm install
npm run dev
```

### Production Build
```powershell
cd web-admin
npm run build
```
The optimized production bundle will be generated in `web-admin/dist/`.

### Deployment Options:
- **Vercel / Netlify**: Connect your GitHub repository, set Root Directory to `web-admin`, build command `npm run build`, and publish directory `dist`. Add environment variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- **Nginx / Cloudflare Pages**: Serve the `dist/` directory with standard SPA rewrite rules.

---

## 3. Android Mobile Application Deployment (Flutter)

### Local Execution & Testing
```powershell
cd android-app
flutter pub get
flutter run
```

### Release APK Build (Direct Installation)
```powershell
cd android-app
flutter build apk --release
```
The resulting APK will be located at: `android-app/build/app/outputs/flutter-apk/app-release.apk`.

### Release AAB Build (Google Play Store)
```powershell
cd android-app
flutter build appbundle --release
```
The resulting App Bundle will be located at: `android-app/build/app/outputs/bundle/release/app-release.aab`.

---

## 4. Default Demo Accounts

| Role | Email | Password | Primary Capabilities |
|---|---|---|---|
| **Admin** | `admin@shever.com` | `Password123!` | Full control, User management, Settings, Audits |
| **FM Manager** | `manager@shever.com` | `Password123!` | Operations, Approval, Reports & Analytics |
| **Supervisor** | `supervisor@shever.com` | `Password123!` | WO/PPM assignment, Verification & sign-off |
| **Technician** | `technician@shever.com` | `Password123!` | Mobile tasks, Checklists, Photos & Signatures |
