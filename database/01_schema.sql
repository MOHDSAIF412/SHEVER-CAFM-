-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - FACILITIES MANAGEMENT SYSTEM (CAFM)
-- 01_SCHEMA.SQL: Normalized Tables, Primary Keys, Foreign Keys, and Indexes
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS signatures CASCADE;
DROP TABLE IF EXISTS material_transactions CASCADE;
DROP TABLE IF EXISTS work_order_materials CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS ppm_photos CASCADE;
DROP TABLE IF EXISTS ppm_checklist_responses CASCADE;
DROP TABLE IF EXISTS ppm_schedules CASCADE;
DROP TABLE IF EXISTS ppm_plans CASCADE;
DROP TABLE IF EXISTS ppm_checklist_items CASCADE;
DROP TABLE IF EXISTS ppm_checklists CASCADE;
DROP TABLE IF EXISTS work_order_photos CASCADE;
DROP TABLE IF EXISTS work_order_status_history CASCADE;
DROP TABLE IF EXISTS work_order_comments CASCADE;
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS sla_configs CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS floors CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ROLES & PROFILES
-- ------------------------------------------------------------------------------
CREATE TABLE roles (
    id TEXT PRIMARY KEY, -- 'admin', 'fm_manager', 'supervisor', 'technician'
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    avatar_url TEXT,
    department TEXT DEFAULT 'Facilities Management',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. FACILITY HIERARCHY: BUILDINGS, FLOORS, LOCATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL, -- e.g. 'BLD-A', 'HQ-MAIN'
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Dubai',
    total_floors INTEGER DEFAULT 1,
    contact_person TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    name TEXT NOT NULL, -- e.g. 'Ground Floor', 'Level 1', 'Basement 1'
    floor_plan_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_building_floor UNIQUE(building_id, floor_number)
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g. 'LOC-GF-01'
    name TEXT NOT NULL, -- e.g. 'Main Reception', 'AHU Room 01', 'Electrical DB Room'
    room_number TEXT,
    zone TEXT, -- e.g. 'North Wing', 'Central Core'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_floor_location UNIQUE(floor_id, code)
);

-- ------------------------------------------------------------------------------
-- 3. CATEGORIES & SUBCATEGORIES
-- ------------------------------------------------------------------------------
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- 'HVAC', 'Electrical', 'Plumbing', 'Civil', 'Fire & Life Safety', etc.
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'AHU', 'FCU', 'Chiller', 'Lighting', 'Water Pump'
    code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_category_subcategory UNIQUE(category_id, code)
);

-- ------------------------------------------------------------------------------
-- 4. SLA CONFIGURATION
-- ------------------------------------------------------------------------------
CREATE TABLE sla_configs (
    id TEXT PRIMARY KEY, -- 'Emergency', 'High', 'Medium', 'Low'
    priority TEXT NOT NULL UNIQUE,
    response_time_minutes INTEGER NOT NULL,
    resolution_time_hours NUMERIC(6,2) NOT NULL,
    color_hex TEXT DEFAULT '#3B82F6',
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. ASSET MANAGEMENT
-- ------------------------------------------------------------------------------
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_number TEXT UNIQUE NOT NULL, -- e.g. 'AST-HVAC-001'
    name TEXT NOT NULL,
    type TEXT, -- e.g. 'Air Handling Unit', 'Chilled Water Pump'
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE RESTRICT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    installation_date DATE,
    warranty_expiry DATE,
    amc_start DATE,
    amc_expiry DATE,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Under Maintenance', 'Disposed')),
    criticality TEXT NOT NULL DEFAULT 'Medium' CHECK (criticality IN ('Critical', 'High', 'Medium', 'Low')),
    qr_code_url TEXT,
    photo_url TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. REACTIVE WORK ORDERS & WORKFLOW
-- ------------------------------------------------------------------------------
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wo_number TEXT UNIQUE NOT NULL, -- 'WO-2026-000001'
    reported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reported_by_name TEXT,
    reported_by_phone TEXT,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    floor_id UUID NOT NULL REFERENCES floors(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
    priority TEXT NOT NULL DEFAULT 'Medium' REFERENCES sla_configs(id) ON DELETE RESTRICT,
    problem_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN (
        'New', 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Completed', 'Pending Approval', 'Closed', 'Cancelled'
    )),
    assigned_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    target_completion_at TIMESTAMPTZ,
    response_due_at TIMESTAMPTZ,
    resolution_due_at TIMESTAMPTZ,
    is_overdue BOOLEAN DEFAULT FALSE,
    accepted_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    start_gps JSONB, -- { "lat": 25.2048, "lng": 55.2708, "accuracy": 5 }
    completion_gps JSONB,
    response_time_minutes INTEGER,
    resolution_time_minutes INTEGER,
    work_performed TEXT,
    root_cause TEXT,
    action_taken TEXT,
    remarks TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_order_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'progress', 'after')),
    photo_url TEXT NOT NULL,
    caption TEXT,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_order_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. MATERIALS & INVENTORY
-- ------------------------------------------------------------------------------
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code TEXT UNIQUE NOT NULL, -- e.g. 'MAT-ELE-001'
    name TEXT NOT NULL, -- 'LED 18W Downlight'
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'pcs', -- 'pcs', 'meters', 'kg', 'liters', 'box'
    quantity_in_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_stock_level NUMERIC(10,2) NOT NULL DEFAULT 5,
    unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    location TEXT DEFAULT 'Central Store',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE work_order_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    quantity_used NUMERIC(10,2) NOT NULL,
    unit_cost NUMERIC(10,2) NOT NULL,
    total_cost NUMERIC(10,2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE material_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST')),
    quantity NUMERIC(10,2) NOT NULL,
    reference_type TEXT CHECK (reference_type IN ('WORK_ORDER', 'PPM', 'PURCHASE', 'AUDIT_ADJUSTMENT')),
    reference_id UUID,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. PPM (PLANNED PREVENTIVE MAINTENANCE) MODULE
-- ------------------------------------------------------------------------------
CREATE TABLE ppm_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL, -- e.g. 'AHU Monthly Inspection Checklist'
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ppm_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES ppm_checklists(id) ON DELETE CASCADE,
    item_order INTEGER NOT NULL DEFAULT 1,
    task_description TEXT NOT NULL, -- e.g. 'Check belt tension and condition'
    field_type TEXT NOT NULL CHECK (field_type IN ('pass_fail', 'yes_no', 'numeric_reading', 'text', 'dropdown', 'photo_required')),
    unit_of_measure TEXT, -- e.g. '°C', 'Bar', 'Amps', 'PSI'
    min_value NUMERIC(10,2),
    max_value NUMERIC(10,2),
    is_mandatory BOOLEAN DEFAULT TRUE,
    dropdown_options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ppm_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ppm_code TEXT UNIQUE NOT NULL, -- e.g. 'PPM-PLN-001'
    title TEXT NOT NULL,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE RESTRICT,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    checklist_id UUID NOT NULL REFERENCES ppm_checklists(id) ON DELETE RESTRICT,
    frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Custom')),
    custom_interval_days INTEGER,
    start_date DATE NOT NULL,
    next_due_date DATE NOT NULL,
    assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ppm_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_number TEXT UNIQUE NOT NULL, -- e.g. 'PPM-2026-00001'
    ppm_plan_id UUID NOT NULL REFERENCES ppm_plans(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN (
        'Scheduled', 'Assigned', 'In Progress', 'Completed', 'Pending Approval', 'Closed', 'Overdue', 'Cancelled'
    )),
    assigned_technician_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_supervisor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    remarks TEXT,
    is_overdue BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ppm_checklist_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ppm_schedule_id UUID NOT NULL REFERENCES ppm_schedules(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES ppm_checklist_items(id) ON DELETE CASCADE,
    result_status TEXT CHECK (result_status IN ('Pass', 'Fail', 'N/A', 'Yes', 'No')),
    numeric_value NUMERIC(10,2),
    text_response TEXT,
    remarks TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_schedule_item UNIQUE(ppm_schedule_id, checklist_item_id)
);

CREATE TABLE ppm_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ppm_schedule_id UUID NOT NULL REFERENCES ppm_schedules(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. SIGNATURES
-- ------------------------------------------------------------------------------
CREATE TABLE signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('work_order', 'ppm_schedule')),
    entity_id UUID NOT NULL,
    signature_type TEXT NOT NULL CHECK (signature_type IN ('technician', 'supervisor', 'client')),
    signer_name TEXT NOT NULL,
    signature_data_url TEXT NOT NULL,
    signed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. NOTIFICATIONS
-- ------------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    entity_type TEXT, -- 'work_order', 'ppm_schedule', 'asset', 'general'
    entity_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- ------------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL, -- e.g. 'CREATE_WORK_ORDER', 'APPROVE_PPM', 'UPDATE_ASSET'
    module TEXT NOT NULL, -- 'WORK_ORDERS', 'PPM', 'ASSETS', 'SETTINGS', 'USERS'
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. SYSTEM SETTINGS
-- ------------------------------------------------------------------------------
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    company_name TEXT NOT NULL DEFAULT 'Shever Technical Services',
    company_logo_url TEXT,
    contact_email TEXT DEFAULT 'info@shevertechnical.com',
    contact_phone TEXT DEFAULT '+971 4 000 0000',
    currency TEXT DEFAULT 'AED',
    wo_prefix TEXT DEFAULT 'WO',
    ppm_prefix TEXT DEFAULT 'PPM',
    timezone TEXT DEFAULT 'Asia/Dubai',
    notification_settings JSONB DEFAULT '{"email_enabled": true, "push_enabled": true, "sms_enabled": false}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. INDEXES FOR HIGH-PERFORMANCE SEARCH & FILTERING
-- ------------------------------------------------------------------------------
CREATE INDEX idx_profiles_role ON profiles(role_id);
CREATE INDEX idx_buildings_code ON buildings(code);
CREATE INDEX idx_floors_building ON floors(building_id);
CREATE INDEX idx_locations_floor ON locations(floor_id);
CREATE INDEX idx_assets_number ON assets(asset_number);
CREATE INDEX idx_assets_building ON assets(building_id);
CREATE INDEX idx_assets_category ON assets(category_id);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_work_orders_number ON work_orders(wo_number);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_priority ON work_orders(priority);
CREATE INDEX idx_work_orders_tech ON work_orders(assigned_technician_id);
CREATE INDEX idx_work_orders_sup ON work_orders(assigned_supervisor_id);
CREATE INDEX idx_work_orders_asset ON work_orders(asset_id);
CREATE INDEX idx_work_orders_building ON work_orders(building_id);
CREATE INDEX idx_work_orders_created ON work_orders(created_at DESC);
CREATE INDEX idx_wo_history_wo ON work_order_status_history(work_order_id);
CREATE INDEX idx_ppm_plans_asset ON ppm_plans(asset_id);
CREATE INDEX idx_ppm_plans_tech ON ppm_plans(assigned_technician_id);
CREATE INDEX idx_ppm_schedules_plan ON ppm_schedules(ppm_plan_id);
CREATE INDEX idx_ppm_schedules_status ON ppm_schedules(status);
CREATE INDEX idx_ppm_schedules_due ON ppm_schedules(due_date);
CREATE INDEX idx_ppm_schedules_tech ON ppm_schedules(assigned_technician_id);
CREATE INDEX idx_materials_code ON materials(item_code);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_module ON audit_logs(module);
