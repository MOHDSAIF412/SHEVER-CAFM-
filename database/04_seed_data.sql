-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - FACILITIES MANAGEMENT SYSTEM (CAFM)
-- 04_SEED_DATA.SQL: Complete Realistic FM Demo Dataset
-- ==============================================================================

-- 1. System Settings
INSERT INTO system_settings (id, company_name, company_logo_url, contact_email, contact_phone, currency, wo_prefix, ppm_prefix, timezone)
VALUES (
    1,
    'Shever Technical Services',
    '/shever-logo.png',
    'support@shevertechnical.com',
    '+971 4 388 9900',
    'AED',
    'WO',
    'PPM',
    'Asia/Dubai'
) ON CONFLICT (id) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    company_logo_url = EXCLUDED.company_logo_url;

-- 2. Roles
INSERT INTO roles (id, name, description) VALUES
('admin', 'Admin', 'Full administrative system control and configuration'),
('fm_manager', 'FM Manager', 'Facilities operational manager with reporting, PPM and WO approval authority'),
('supervisor', 'Supervisor', 'Field operations supervisor assigning and verifying work orders'),
('technician', 'Technician', 'Mobile technician executing work orders, inspections and PPMs')
ON CONFLICT (id) DO NOTHING;

-- 3. SLA Configs
INSERT INTO sla_configs (id, priority, response_time_minutes, resolution_time_hours, color_hex, description) VALUES
('Emergency', 'Emergency', 15, 2.0, '#EF4444', 'Immediate response within 15 min; 2h target resolution'),
('High', 'High', 30, 4.0, '#F97316', 'Urgent response within 30 min; 4h target resolution'),
('Medium', 'Medium', 120, 24.0, '#FBBF24', 'Standard response within 2h; 24h target resolution'),
('Low', 'Low', 240, 72.0, '#10B981', 'Non-critical response within 4h; 72h target resolution')
ON CONFLICT (id) DO NOTHING;

-- 4. Categories & Subcategories
INSERT INTO categories (id, name, code, description, icon) VALUES
('a0000000-0000-0000-0000-000000000001', 'HVAC', 'HVAC', 'Heating, Ventilation & Air Conditioning', 'Wind'),
('a0000000-0000-0000-0000-000000000002', 'Electrical', 'ELEC', 'Power distribution, lighting, generators, UPS', 'Zap'),
('a0000000-0000-0000-0000-000000000003', 'Plumbing', 'PLUMB', 'Water supply, drainage, booster pumps, sanitary', 'Droplet'),
('a0000000-0000-0000-0000-000000000004', 'Civil & Carpentry', 'CIVIL', 'Doors, ceilings, locks, painting, masonry', 'Hammer'),
('a0000000-0000-0000-0000-000000000005', 'Fire & Life Safety', 'FLS', 'Fire alarms, smoke detectors, sprinklers, extinguishers', 'Flame'),
('a0000000-0000-0000-0000-000000000006', 'Elevators & Escalators', 'ELEV', 'Lifts, escalators, moving walkways', 'ArrowUpDown'),
('a0000000-0000-0000-0000-000000000007', 'Cleaning & Housekeeping', 'CLEAN', 'Deep cleaning, facade, waste management', 'Sparkles')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subcategories (id, category_id, name, code, description) VALUES
-- HVAC
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Air Handling Unit (AHU)', 'AHU', 'Central air handling equipment'),
('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Fan Coil Unit (FCU)', 'FCU', 'Zonal fan coil units'),
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Chiller Plant', 'CHILL', 'Centrifugal & screw chillers'),
('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Exhaust Fan', 'EXH', 'Kitchen & bathroom exhaust fans'),
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Package Unit / Split AC', 'DX', 'Direct expansion AC units'),
-- Electrical
('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002', 'Main Distribution Board (MDB)', 'MDB', 'Main electrical distribution panel'),
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'Diesel Generator', 'GEN', 'Backup emergency diesel power'),
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'Lighting & Fixtures', 'LIGHT', 'Indoor and outdoor architectural lights'),
('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', 'UPS System', 'UPS', 'Uninterruptible Power Supply systems'),
-- Plumbing
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000003', 'Booster & Transfer Pump', 'PUMP', 'Potable water pumping stations'),
('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000003', 'Drainage & Sump Pump', 'SUMP', 'Sewage and stormwater pumps'),
('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000003', 'Sanitary & Piping', 'SAN', 'Faucets, valves, flush valves, leaks'),
-- Fire & Life Safety
('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000005', 'Fire Alarm Control Panel', 'FACP', 'Addressable fire alarm control'),
('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000005', 'Fire Fighting Pumps', 'FFP', 'Electric, diesel and jockey fire pumps')
ON CONFLICT (id) DO NOTHING;

-- 5. Buildings
INSERT INTO buildings (id, code, name, address, city, total_floors, contact_person, contact_phone) VALUES
('c0000000-0000-0000-0000-000000000001', 'BLD-ST-01', 'Shever Corporate Tower', 'Sheikh Zayed Road, Financial District', 'Dubai', 35, 'Tariq Mansoor', '+971 50 123 4567'),
('c0000000-0000-0000-0000-000000000002', 'BLD-OB-02', 'Oasis Business Bay Complex', 'Marasi Drive, Business Bay', 'Dubai', 22, 'Fatima Al Zahra', '+971 55 987 6543'),
('c0000000-0000-0000-0000-000000000003', 'BLD-JL-03', 'Jumeirah Lakes Heights', 'Cluster T, JLT', 'Dubai', 18, 'Kareem Nader', '+971 52 456 7890')
ON CONFLICT (id) DO NOTHING;

-- 6. Floors (10 sample floors)
INSERT INTO floors (id, building_id, floor_number, name) VALUES
-- Building 1
('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', -1, 'Basement B1 (Plant & Parking)'),
('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 0, 'Ground Floor Lobby & Retail'),
('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 1, 'Floor 1 - Management Suites'),
('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 15, 'Floor 15 - Commercial Offices'),
('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 35, 'Roof Plant Room & Chiller Deck'),
-- Building 2
('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 0, 'Ground Floor Reception'),
('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002', 4, 'Floor 4 - Tech Hub'),
('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 22, 'Roof Mechanical Room'),
-- Building 3
('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 0, 'Ground Floor Concourse'),
('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000003', 10, 'Floor 10 - Multi-Tenant')
ON CONFLICT (id) DO NOTHING;

-- 7. Locations (20 sample locations)
INSERT INTO locations (id, floor_id, code, name, room_number, zone) VALUES
('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'LOC-B1-PUMP', 'Basement Pump Room 01', 'B1-04', 'Basement West'),
('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'LOC-B1-GEN', 'Emergency Generator Room', 'B1-12', 'Basement East'),
('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'LOC-B1-MDB', 'Main LV Switchgear Room', 'B1-02', 'Basement Central'),
('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', 'LOC-GF-LOBBY', 'Grand Atrium Lobby', 'GF-01', 'Main Entry'),
('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002', 'LOC-GF-SEC', 'Security & BMS Control Center', 'GF-08', 'North Core'),
('e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000003', 'LOC-F1-CONF', 'Executive Boardroom', '101', 'North Wing'),
('e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000003', 'LOC-F1-AHU', 'Floor 1 AHU Room', '109', 'Service Shaft'),
('e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000004', 'LOC-F15-OPEN', 'Open Workspace Hub', '1502', 'South Wing'),
('e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000004', 'LOC-F15-SERVER', 'IT Server Room 15', '1510', 'Core'),
('e0000000-0000-0000-0000-000000000010', 'd0000000-0000-0000-0000-000000000005', 'LOC-ROOF-CHILL', 'Chiller Yard 01', 'RF-01', 'Roof Top'),
('e0000000-0000-0000-0000-000000000011', 'd0000000-0000-0000-0000-000000000005', 'LOC-ROOF-FAN', 'Roof Extract Fan Enclosure', 'RF-04', 'Roof North'),
('e0000000-0000-0000-0000-000000000012', 'd0000000-0000-0000-0000-000000000006', 'LOC-OB-LOBBY', 'Main Reception & Lounge', 'OB-GF-01', 'Ground'),
('e0000000-0000-0000-0000-000000000013', 'd0000000-0000-0000-0000-000000000006', 'LOC-OB-ELEC', 'Ground Floor DB Room', 'OB-GF-03', 'East Wing'),
('e0000000-0000-0000-0000-000000000014', 'd0000000-0000-0000-0000-000000000007', 'LOC-OB-F4-LAB', 'Innovation Tech Lab', 'OB-401', 'West Wing'),
('e0000000-0000-0000-0000-000000000015', 'd0000000-0000-0000-0000-000000000007', 'LOC-OB-F4-PANTRY', 'Central Pantry & Cafe', 'OB-415', 'Central Core'),
('e0000000-0000-0000-0000-000000000016', 'd0000000-0000-0000-0000-000000000008', 'LOC-OB-ROOF', 'Roof AHU & Cooling Tower', 'OB-RF-01', 'Roof Area'),
('e0000000-0000-0000-0000-000000000017', 'd0000000-0000-0000-0000-000000000009', 'LOC-JL-CONC', 'Plaza Concourse & Shops', 'JL-GF-01', 'Retail Zone'),
('e0000000-0000-0000-0000-000000000018', 'd0000000-0000-0000-0000-000000000009', 'LOC-JL-FIRE', 'Fire Command Center', 'JL-GF-04', 'West Core'),
('e0000000-0000-0000-0000-000000000019', 'd0000000-0000-0000-0000-000000000010', 'LOC-JL-F10-CORR', 'Level 10 Corridor & Toilets', 'JL-1000', 'Public Corridor'),
('e0000000-0000-0000-0000-000000000020', 'd0000000-0000-0000-0000-000000000010', 'LOC-JL-F10-ELEC', 'Floor 10 Electrical Riser', 'JL-1008', 'Service Area')
ON CONFLICT (id) DO NOTHING;

-- 8. Materials Inventory (Spare parts)
INSERT INTO materials (id, item_code, name, category, unit, quantity_in_stock, min_stock_level, unit_cost, location) VALUES
('f0000000-0000-0000-0000-000000000001', 'MAT-HVAC-BELT-A', 'V-Belt SPA-1800 for AHU Blower', 'HVAC', 'pcs', 28.00, 10.00, 45.00, 'Rack A-01'),
('f0000000-0000-0000-0000-000000000002', 'MAT-HVAC-FLT-G4', 'Panel Air Filter G4 (595x595x50mm)', 'HVAC', 'pcs', 120.00, 30.00, 28.00, 'Rack A-02'),
('f0000000-0000-0000-0000-000000000003', 'MAT-HVAC-FLT-F7', 'Bag Air Filter F7 (595x595x500mm)', 'HVAC', 'pcs', 45.00, 15.00, 85.00, 'Rack A-03'),
('f0000000-0000-0000-0000-000000000004', 'MAT-HVAC-THERM', 'Digital Smart Thermostat 24V', 'HVAC', 'pcs', 18.00, 5.00, 220.00, 'Rack A-04'),
('f0000000-0000-0000-0000-000000000005', 'MAT-ELE-LED-18W', 'LED Recessed Downlight 18W 4000K', 'Electrical', 'pcs', 95.00, 25.00, 35.00, 'Rack B-01'),
('f0000000-0000-0000-0000-000000000006', 'MAT-ELE-LED-TUB', 'LED Tube T8 1200mm 18W', 'Electrical', 'pcs', 150.00, 40.00, 18.00, 'Rack B-02'),
('f0000000-0000-0000-0000-000000000007', 'MAT-ELE-MCB-16A', 'Single Pole MCB 16A 10kA Type C', 'Electrical', 'pcs', 40.00, 12.00, 22.00, 'Rack B-03'),
('f0000000-0000-0000-0000-000000000008', 'MAT-ELE-CABLE-3C', 'Flexible 3-Core 2.5mm² Cable', 'Electrical', 'meters', 350.00, 100.00, 4.50, 'Drum Bay 1'),
('f0000000-0000-0000-0000-000000000009', 'MAT-PLM-FNC-VLV', 'Angle Valve 1/2" Chrome Plated', 'Plumbing', 'pcs', 60.00, 20.00, 32.00, 'Rack C-01'),
('f0000000-0000-0000-0000-000000000010', 'MAT-PLM-FLS-KIT', 'Concealed Cistern Dual Flush Valve Kit', 'Plumbing', 'pcs', 22.00, 8.00, 140.00, 'Rack C-02'),
('f0000000-0000-0000-0000-000000000011', 'MAT-FLS-SMK-DET', 'Optical Smoke Detector Head', 'Fire & Life Safety', 'pcs', 30.00, 10.00, 110.00, 'Rack D-01')
ON CONFLICT (id) DO NOTHING;

-- 9. Checklists Templates (PPM Templates)
INSERT INTO ppm_checklists (id, title, category_id, description) VALUES
('10000000-0000-0000-0000-000000000001', 'AHU Monthly Preventive Maintenance Checklist', 'a0000000-0000-0000-0000-000000000001', 'Standard monthly inspection and maintenance routine for Air Handling Units'),
('10000000-0000-0000-0000-000000000002', 'Main LV Switchgear & DB Quarterly Inspection', 'a0000000-0000-0000-0000-000000000002', 'Quarterly electrical switchgear health, thermal scan, and connection torque check'),
('10000000-0000-0000-0000-000000000003', 'Booster Water Pump Set Monthly Maintenance', 'a0000000-0000-0000-0000-000000000003', 'Monthly pump operation, pressure verification, mechanical seal check and lubrication'),
('10000000-0000-0000-0000-000000000004', 'Fire Alarm Control Panel & Sounders Monthly Test', 'a0000000-0000-0000-0000-000000000005', 'Monthly system loop test, standby battery test, interface testing')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ppm_checklist_items (id, checklist_id, item_order, task_description, field_type, unit_of_measure, min_value, max_value, is_mandatory) VALUES
-- AHU items
('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'Check and record supply air temperature', 'numeric_reading', '°C', 12.0, 24.0, true),
('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, 'Inspect air filter condition (Clean/Replace if needed)', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 3, 'Check drive belt tension and alignment', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 4, 'Measure and record motor operating current', 'numeric_reading', 'Amps', 5.0, 45.0, true),
('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 5, 'Inspect condensate drain tray and clean drain trap', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 6, 'Check for abnormal vibration or bearing noise', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 7, 'Capture overall photo of completed AHU servicing', 'photo_required', NULL, NULL, NULL, true),

-- Switchgear items
('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 1, 'Check panel indicator lamps and voltmeter readings', 'numeric_reading', 'Volts', 380.0, 415.0, true),
('11000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 2, 'Inspect for hot spots / thermal discoloration on busbars', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000002', 3, 'Check and record main incoming line current', 'numeric_reading', 'Amps', 50.0, 1600.0, true),

-- Booster pump items
('11000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', 1, 'Check discharge pressure gauge reading', 'numeric_reading', 'Bar', 3.5, 7.5, true),
('11000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', 2, 'Inspect mechanical seal for leaks', 'pass_fail', NULL, NULL, NULL, true),
('11000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', 3, 'Test auto-duty changeover of standby pump', 'pass_fail', NULL, NULL, NULL, true)
ON CONFLICT (id) DO NOTHING;

-- 10. Assets (Sample realistic equipment with QR IDs)
INSERT INTO assets (id, asset_number, name, type, category_id, subcategory_id, manufacturer, model, serial_number, building_id, floor_id, location_id, installation_date, warranty_expiry, amc_start, amc_expiry, status, criticality, qr_code_url) VALUES
('20000000-0000-0000-0000-000000000001', 'AST-AHU-001', 'Air Handling Unit 01 - North Atrium', 'Air Handling Unit', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Carrier', '39HQ08', 'CR-2023-99881', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000007', '2023-01-15', '2025-01-15', '2025-01-16', '2027-01-15', 'Active', 'Critical', 'AST-AHU-001'),
('20000000-0000-0000-0000-000000000002', 'AST-CHL-001', 'Water-Cooled Centrifugal Chiller #1', 'Chiller Plant', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Trane', 'CVHE-500TR', 'TR-99441-A', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000010', '2022-06-10', '2024-06-10', '2024-06-11', '2026-06-10', 'Active', 'Critical', 'AST-CHL-001'),
('20000000-0000-0000-0000-000000000003', 'AST-GEN-001', 'Emergency Standby Diesel Generator 1000kVA', 'Diesel Generator', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000007', 'Cummins', 'QST30-G4', 'CUM-2022-811', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '2022-03-01', '2024-03-01', '2024-03-02', '2027-03-01', 'Active', 'Critical', 'AST-GEN-001'),
('20000000-0000-0000-0000-000000000004', 'AST-MDB-001', 'Main Low Voltage Switchboard MDB-1', 'Main Distribution Board', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000006', 'Schneider Electric', 'Prisma Plus P', 'SE-2021-0091', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', '2021-11-20', '2023-11-20', '2023-11-21', '2026-11-20', 'Active', 'Critical', 'AST-MDB-001'),
('20000000-0000-0000-0000-000000000005', 'AST-PMP-001', 'Domestic Potable Water Booster Pump Set', 'Booster Pump', 'a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000010', 'Grundfos', 'Hydro MPC-E 3', 'GF-9908122', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '2022-08-14', '2024-08-14', '2024-08-15', '2026-08-14', 'Active', 'High', 'AST-PMP-001'),
('20000000-0000-0000-0000-000000000006', 'AST-FACP-001', 'Addressable Fire Alarm Panel Main Atrium', 'Fire Alarm Panel', 'a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000013', 'Notifier', 'NFS2-3030', 'NOT-552109', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005', '2022-01-10', '2024-01-10', '2024-01-11', '2027-01-10', 'Active', 'Critical', 'AST-FACP-001')
ON CONFLICT (id) DO NOTHING;

-- 11. PPM Plans
INSERT INTO ppm_plans (id, ppm_code, title, asset_id, building_id, location_id, category_id, checklist_id, frequency, start_date, next_due_date, is_active) VALUES
('30000000-0000-0000-0000-000000000001', 'PPM-PLN-AHU-01', 'Monthly Inspection AHU-001', '20000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Monthly', CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '5 days', true),
('30000000-0000-0000-0000-000000000002', 'PPM-PLN-MDB-01', 'Quarterly Service Main Switchboard MDB-1', '20000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Quarterly', CURRENT_DATE - INTERVAL '60 days', CURRENT_DATE + INTERVAL '14 days', true),
('30000000-0000-0000-0000-000000000003', 'PPM-PLN-PMP-01', 'Monthly Health Check Domestic Booster Pumps', '20000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Monthly', CURRENT_DATE - INTERVAL '40 days', CURRENT_DATE - INTERVAL '2 days', true)
ON CONFLICT (id) DO NOTHING;

-- 12. PPM Schedules (Active and Overdue runs)
INSERT INTO ppm_schedules (id, schedule_number, ppm_plan_id, due_date, status, is_overdue) VALUES
('40000000-0000-0000-0000-000000000001', 'PPM-2026-000101', '30000000-0000-0000-0000-000000000001', CURRENT_DATE + INTERVAL '5 days', 'Scheduled', false),
('40000000-0000-0000-0000-000000000002', 'PPM-2026-000102', '30000000-0000-0000-0000-000000000002', CURRENT_DATE + INTERVAL '14 days', 'Scheduled', false),
('40000000-0000-0000-0000-000000000003', 'PPM-2026-000098', '30000000-0000-0000-0000-000000000003', CURRENT_DATE - INTERVAL '2 days', 'Overdue', true)
ON CONFLICT (id) DO NOTHING;

-- 13. Sample Work Orders across statuses
INSERT INTO work_orders (
    id, wo_number, reported_by_name, reported_by_phone, building_id, floor_id, location_id, asset_id, category_id, subcategory_id, priority, problem_description, status, target_completion_at, response_due_at, resolution_due_at, is_overdue, created_at
) VALUES
(
    '50000000-0000-0000-0000-000000000001',
    'WO-2026-000001',
    'Zaid Al-Harbi (Tenant)',
    '+971 50 111 2233',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'High',
    'Abnormal grinding noise coming from North Atrium AHU-001 fan section during peak load. Airflow is reduced.',
    'In Progress',
    NOW() + INTERVAL '3 hours',
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '3 hours',
    false,
    NOW() - INTERVAL '1 hour'
),
(
    '50000000-0000-0000-0000-000000000002',
    'WO-2026-000002',
    'Reception Desk',
    '+971 4 388 9901',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000004',
    NULL,
    'a0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000008',
    'Medium',
    '3 ceiling downlights flickering intermittently near the main VIP elevator lobby entrance.',
    'New',
    NOW() + INTERVAL '20 hours',
    NOW() + INTERVAL '1 hour',
    NOW() + INTERVAL '20 hours',
    false,
    NOW() - INTERVAL '20 minutes'
),
(
    '50000000-0000-0000-0000-000000000003',
    'WO-2026-000003',
    'Security BMS',
    '+971 4 388 9905',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000010',
    'Emergency',
    'High pressure alarm triggered on Potable Water Booster Pump line. Water leakage detected in Basement Pump Room.',
    'Accepted',
    NOW() + INTERVAL '1 hour',
    NOW() - INTERVAL '5 minutes',
    NOW() + INTERVAL '1 hour',
    false,
    NOW() - INTERVAL '10 minutes'
),
(
    '50000000-0000-0000-0000-000000000004',
    'WO-2026-000004',
    'Facilities Helpdesk',
    '+971 4 388 9900',
    'c0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000007',
    'e0000000-0000-0000-0000-000000000015',
    NULL,
    'a0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000012',
    'Low',
    'Pantry water heater tap is dripping slowly. Basin drain requires clearing and seal inspection.',
    'Completed',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days',
    false,
    NOW() - INTERVAL '4 days'
)
ON CONFLICT (id) DO NOTHING;
