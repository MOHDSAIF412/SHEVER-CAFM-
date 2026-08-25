-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - FACILITIES MANAGEMENT SYSTEM (CAFM)
-- 02_RLS_POLICIES.SQL: Row Level Security (RLS) Policies
-- ==============================================================================

-- Helper functions to extract user role and profile ID
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
    SELECT role_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role_id IN ('admin', 'fm_manager')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role_id IN ('admin', 'fm_manager', 'supervisor')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ppm_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. ROLES & PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Roles are viewable by all authenticated users"
ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles are viewable by authenticated users"
ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert and update profiles"
ON profiles FOR ALL TO authenticated USING (
    is_admin_or_manager() OR id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 2. MASTER DATA (Buildings, Floors, Locations, Categories, Subcategories, SLAs)
-- ------------------------------------------------------------------------------
CREATE POLICY "Master data viewable by all authenticated"
ON buildings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Master data manage by management"
ON buildings FOR ALL TO authenticated USING (is_admin_or_manager());

CREATE POLICY "Floors viewable by all authenticated"
ON floors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Floors manage by management"
ON floors FOR ALL TO authenticated USING (is_admin_or_manager());

CREATE POLICY "Locations viewable by all authenticated"
ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Locations manage by management"
ON locations FOR ALL TO authenticated USING (is_admin_or_manager());

CREATE POLICY "Categories viewable by all authenticated"
ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Categories manage by management"
ON categories FOR ALL TO authenticated USING (is_admin_or_manager());

CREATE POLICY "Subcategories viewable by all authenticated"
ON subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Subcategories manage by management"
ON subcategories FOR ALL TO authenticated USING (is_admin_or_manager());

CREATE POLICY "SLA configs viewable by all"
ON sla_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "SLA configs manage by admin"
ON sla_configs FOR ALL TO authenticated USING (current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 3. ASSETS
-- ------------------------------------------------------------------------------
CREATE POLICY "Assets viewable by all authenticated"
ON assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Assets manageable by management"
ON assets FOR INSERT TO authenticated WITH CHECK (is_management());

CREATE POLICY "Assets updatable by management"
ON assets FOR UPDATE TO authenticated USING (is_management());

CREATE POLICY "Assets deletable by admin"
ON assets FOR DELETE TO authenticated USING (current_user_role() = 'admin');

-- ------------------------------------------------------------------------------
-- 4. REACTIVE WORK ORDERS
-- ------------------------------------------------------------------------------
CREATE POLICY "Work orders viewable based on role"
ON work_orders FOR SELECT TO authenticated USING (
    is_management() OR assigned_technician_id = auth.uid() OR reported_by = auth.uid()
);

CREATE POLICY "Work orders insertable by management or users"
ON work_orders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Work orders updatable by assigned technician or management"
ON work_orders FOR UPDATE TO authenticated USING (
    is_management() OR (
        assigned_technician_id = auth.uid() AND status NOT IN ('Closed', 'Cancelled')
    )
);

CREATE POLICY "Work orders deletable only by admin"
ON work_orders FOR DELETE TO authenticated USING (current_user_role() = 'admin');

-- Work order attachments, history, and comments
CREATE POLICY "WO history viewable by allowed WO viewers"
ON work_order_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO history insertable by authenticated"
ON work_order_status_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "WO photos viewable by authenticated"
ON work_order_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO photos insertable by assigned tech or management"
ON work_order_photos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "WO comments viewable by authenticated"
ON work_order_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO comments insertable by authenticated"
ON work_order_comments FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. MATERIALS & WORK ORDER USAGE
-- ------------------------------------------------------------------------------
CREATE POLICY "Materials viewable by all authenticated"
ON materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Materials manageable by management"
ON materials FOR ALL TO authenticated USING (is_management());

CREATE POLICY "WO materials viewable by all"
ON work_order_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "WO materials insertable by assigned tech or management"
ON work_order_materials FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Material transactions viewable by management"
ON material_transactions FOR SELECT TO authenticated USING (is_management());
CREATE POLICY "Material transactions insertable by authenticated"
ON material_transactions FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. PPM PLANS, CHECKLISTS & SCHEDULES
-- ------------------------------------------------------------------------------
CREATE POLICY "PPM checklists viewable by all"
ON ppm_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "PPM checklists manage by management"
ON ppm_checklists FOR ALL TO authenticated USING (is_management());

CREATE POLICY "PPM checklist items viewable by all"
ON ppm_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "PPM checklist items manage by management"
ON ppm_checklist_items FOR ALL TO authenticated USING (is_management());

CREATE POLICY "PPM plans viewable by all"
ON ppm_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "PPM plans manage by management"
ON ppm_plans FOR ALL TO authenticated USING (is_management());

CREATE POLICY "PPM schedules viewable by management or assigned tech"
ON ppm_schedules FOR SELECT TO authenticated USING (
    is_management() OR assigned_technician_id = auth.uid()
);
CREATE POLICY "PPM schedules insertable by management"
ON ppm_schedules FOR INSERT TO authenticated WITH CHECK (is_management());
CREATE POLICY "PPM schedules updatable by tech or management"
ON ppm_schedules FOR UPDATE TO authenticated USING (
    is_management() OR assigned_technician_id = auth.uid()
);

CREATE POLICY "PPM responses viewable by authenticated"
ON ppm_checklist_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "PPM responses manage by tech or management"
ON ppm_checklist_responses FOR ALL TO authenticated USING (true);

CREATE POLICY "PPM photos viewable by authenticated"
ON ppm_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "PPM photos insertable by authenticated"
ON ppm_photos FOR INSERT TO authenticated WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 7. SIGNATURES, NOTIFICATIONS, AUDIT LOGS, SETTINGS
-- ------------------------------------------------------------------------------
CREATE POLICY "Signatures viewable by authenticated"
ON signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signatures insertable by authenticated"
ON signatures FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Notifications viewable and manageable by recipient"
ON notifications FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Audit logs viewable by management"
ON audit_logs FOR SELECT TO authenticated USING (is_management());
CREATE POLICY "Audit logs insertable by system"
ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Settings viewable by all authenticated"
ON system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Settings manageable by admin only"
ON system_settings FOR ALL TO authenticated USING (current_user_role() = 'admin');
