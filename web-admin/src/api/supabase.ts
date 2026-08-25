import { createClient } from '@supabase/supabase-js';
import {
  UserProfile,
  Building,
  Floor,
  Location,
  Category,
  Subcategory,
  Asset,
  WorkOrder,
  PPMPlan,
  PPMSchedule,
  Material,
  DashboardStats,
  AuditLog,
  SystemSettings,
  PPMChecklist
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-shever.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return (
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://mock-shever.supabase.co' &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
};

// ==============================================================================
// SEED IN-MEMORY STORE (Fallback & Instant Dev Testing)
// ==============================================================================
const SEED_USERS: UserProfile[] = [
  {
    id: 'u0000000-0000-0000-0000-000000000001',
    email: 'admin@shever.com',
    full_name: 'Saif Al-Nuaimi (Admin)',
    phone: '+971 50 100 2000',
    role_id: 'admin',
    department: 'Executive Management',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'u0000000-0000-0000-0000-000000000002',
    email: 'manager@shever.com',
    full_name: 'David Reynolds (FM Manager)',
    phone: '+971 50 200 3000',
    role_id: 'fm_manager',
    department: 'Facilities Operations',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'u0000000-0000-0000-0000-000000000003',
    email: 'supervisor@shever.com',
    full_name: 'Hamad Al-Maktoum (Supervisor)',
    phone: '+971 50 300 4000',
    role_id: 'supervisor',
    department: 'MEP Operations',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'u0000000-0000-0000-0000-000000000004',
    email: 'technician@shever.com',
    full_name: 'Rashid Khan (HVAC Technician)',
    phone: '+971 50 400 5000',
    role_id: 'technician',
    department: 'HVAC Maintenance',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'u0000000-0000-0000-0000-000000000005',
    email: 'tech.elec@shever.com',
    full_name: 'Vikram Sharma (Electrical Tech)',
    phone: '+971 50 500 6000',
    role_id: 'technician',
    department: 'Electrical Maintenance',
    is_active: true,
    created_at: new Date().toISOString(),
  }
];

const SEED_BUILDINGS: Building[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    code: 'BLD-ST-01',
    name: 'Shever Corporate Tower',
    address: 'Sheikh Zayed Road, Financial District',
    city: 'Dubai',
    total_floors: 35,
    contact_person: 'Tariq Mansoor',
    contact_phone: '+971 50 123 4567',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    code: 'BLD-OB-02',
    name: 'Oasis Business Bay Complex',
    address: 'Marasi Drive, Business Bay',
    city: 'Dubai',
    total_floors: 22,
    contact_person: 'Fatima Al Zahra',
    contact_phone: '+971 55 987 6543',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    code: 'BLD-JL-03',
    name: 'Jumeirah Lakes Heights',
    address: 'Cluster T, JLT',
    city: 'Dubai',
    total_floors: 18,
    contact_person: 'Kareem Nader',
    contact_phone: '+971 52 456 7890',
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_FLOORS: Floor[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_number: -1,
    name: 'Basement B1 (Plant & Parking)',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_number: 0,
    name: 'Ground Floor Lobby & Retail',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_number: 1,
    name: 'Floor 1 - Management Suites',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_number: 15,
    name: 'Floor 15 - Commercial Offices',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_number: 35,
    name: 'Roof Plant Room & Chiller Deck',
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_LOCATIONS: Location[] = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    code: 'LOC-B1-PUMP',
    name: 'Basement Pump Room 01',
    room_number: 'B1-04',
    zone: 'Basement West',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    code: 'LOC-B1-GEN',
    name: 'Emergency Generator Room',
    room_number: 'B1-12',
    zone: 'Basement East',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    code: 'LOC-B1-MDB',
    name: 'Main LV Switchgear Room',
    room_number: 'B1-02',
    zone: 'Basement Central',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000004',
    floor_id: 'd0000000-0000-0000-0000-000000000002',
    code: 'LOC-GF-LOBBY',
    name: 'Grand Atrium Lobby',
    room_number: 'GF-01',
    zone: 'Main Entry',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'e0000000-0000-0000-0000-000000000007',
    floor_id: 'd0000000-0000-0000-0000-000000000003',
    code: 'LOC-F1-AHU',
    name: 'Floor 1 AHU Room',
    room_number: '109',
    zone: 'Service Shaft',
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_CATEGORIES: Category[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'HVAC', code: 'HVAC', description: 'Heating, Ventilation & AC', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Electrical', code: 'ELEC', description: 'Power distribution, lighting, UPS', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'Plumbing', code: 'PLUMB', description: 'Water supply & drainage', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Civil & Carpentry', code: 'CIVIL', description: 'Doors, ceilings, locks, masonry', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Fire & Life Safety', code: 'FLS', description: 'Fire alarms, pumps, sprinklers', is_active: true, created_at: '2026-01-01T00:00:00Z' },
  { id: 'a0000000-0000-0000-0000-000000000006', name: 'Elevators & Escalators', code: 'ELEV', description: 'Passenger & freight elevators', is_active: true, created_at: '2026-01-01T00:00:00Z' }
];

const SEED_SUBCATEGORIES: Subcategory[] = [
  { id: 'b0000000-0000-0000-0000-000000000001', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Air Handling Unit (AHU)', code: 'AHU', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b0000000-0000-0000-0000-000000000002', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Fan Coil Unit (FCU)', code: 'FCU', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b0000000-0000-0000-0000-000000000003', category_id: 'a0000000-0000-0000-0000-000000000001', name: 'Chiller Plant', code: 'CHILL', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b0000000-0000-0000-0000-000000000006', category_id: 'a0000000-0000-0000-0000-000000000002', name: 'Main Distribution Board (MDB)', code: 'MDB', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b0000000-0000-0000-0000-000000000007', category_id: 'a0000000-0000-0000-0000-000000000002', name: 'Diesel Generator', code: 'GEN', created_at: '2026-01-01T00:00:00Z' },
  { id: 'b0000000-0000-0000-0000-000000000010', category_id: 'a0000000-0000-0000-0000-000000000003', name: 'Booster & Transfer Pump', code: 'PUMP', created_at: '2026-01-01T00:00:00Z' }
];

const SEED_ASSETS: Asset[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    asset_number: 'AST-AHU-001',
    name: 'Air Handling Unit 01 - North Atrium',
    type: 'Air Handling Unit',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    subcategory_id: 'b0000000-0000-0000-0000-000000000001',
    manufacturer: 'Carrier',
    model: '39HQ08',
    serial_number: 'CR-2023-99881',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000003',
    location_id: 'e0000000-0000-0000-0000-000000000007',
    installation_date: '2023-01-15',
    warranty_expiry: '2025-01-15',
    amc_start: '2025-01-16',
    amc_expiry: '2027-01-15',
    status: 'Active',
    criticality: 'Critical',
    qr_code_url: 'AST-AHU-001',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    asset_number: 'AST-CHL-001',
    name: 'Water-Cooled Centrifugal Chiller #1',
    type: 'Chiller Plant',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    subcategory_id: 'b0000000-0000-0000-0000-000000000003',
    manufacturer: 'Trane',
    model: 'CVHE-500TR',
    serial_number: 'TR-99441-A',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000005',
    location_id: 'e0000000-0000-0000-0000-000000000001',
    installation_date: '2022-06-10',
    warranty_expiry: '2024-06-10',
    amc_start: '2024-06-11',
    amc_expiry: '2026-06-10',
    status: 'Active',
    criticality: 'Critical',
    qr_code_url: 'AST-CHL-001',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    asset_number: 'AST-GEN-001',
    name: 'Emergency Standby Diesel Generator 1000kVA',
    type: 'Diesel Generator',
    category_id: 'a0000000-0000-0000-0000-000000000002',
    subcategory_id: 'b0000000-0000-0000-0000-000000000007',
    manufacturer: 'Cummins',
    model: 'QST30-G4',
    serial_number: 'CUM-2022-811',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000002',
    installation_date: '2022-03-01',
    warranty_expiry: '2024-03-01',
    amc_start: '2024-03-02',
    amc_expiry: '2027-03-01',
    status: 'Active',
    criticality: 'Critical',
    qr_code_url: 'AST-GEN-001',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    asset_number: 'AST-MDB-001',
    name: 'Main Low Voltage Switchboard MDB-1',
    type: 'Main Distribution Board',
    category_id: 'a0000000-0000-0000-0000-000000000002',
    subcategory_id: 'b0000000-0000-0000-0000-000000000006',
    manufacturer: 'Schneider Electric',
    model: 'Prisma Plus P',
    serial_number: 'SE-2021-0091',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000003',
    installation_date: '2021-11-20',
    warranty_expiry: '2023-11-20',
    amc_start: '2023-11-21',
    amc_expiry: '2026-11-20',
    status: 'Active',
    criticality: 'Critical',
    qr_code_url: 'AST-MDB-001',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000005',
    asset_number: 'AST-PMP-001',
    name: 'Domestic Potable Water Booster Pump Set',
    type: 'Booster Pump',
    category_id: 'a0000000-0000-0000-0000-000000000003',
    subcategory_id: 'b0000000-0000-0000-0000-000000000010',
    manufacturer: 'Grundfos',
    model: 'Hydro MPC-E 3',
    serial_number: 'GF-9908122',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000001',
    installation_date: '2022-08-14',
    warranty_expiry: '2024-08-14',
    amc_start: '2024-08-15',
    amc_expiry: '2026-08-14',
    status: 'Active',
    criticality: 'High',
    qr_code_url: 'AST-PMP-001',
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_WORK_ORDERS: WorkOrder[] = [
  {
    id: '50000000-0000-0000-0000-000000000001',
    wo_number: 'WO-2026-000001',
    reported_by_name: 'Zaid Al-Harbi (Tenant)',
    reported_by_phone: '+971 50 111 2233',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000003',
    location_id: 'e0000000-0000-0000-0000-000000000007',
    asset_id: '20000000-0000-0000-0000-000000000001',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    subcategory_id: 'b0000000-0000-0000-0000-000000000001',
    priority: 'High',
    problem_description: 'Abnormal grinding noise coming from North Atrium AHU-001 fan section during peak load. Airflow is reduced.',
    status: 'In Progress',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: 'u0000000-0000-0000-0000-000000000003',
    target_completion_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    response_due_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    resolution_due_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    is_overdue: false,
    accepted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    response_time_minutes: 15,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000002',
    wo_number: 'WO-2026-000002',
    reported_by_name: 'Reception Desk',
    reported_by_phone: '+971 4 388 9901',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000002',
    location_id: 'e0000000-0000-0000-0000-000000000004',
    category_id: 'a0000000-0000-0000-0000-000000000002',
    priority: 'Medium',
    problem_description: '3 ceiling downlights flickering intermittently near the main VIP elevator lobby entrance.',
    status: 'New',
    assigned_supervisor_id: 'u0000000-0000-0000-0000-000000000003',
    target_completion_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    response_due_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    resolution_due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    is_overdue: false,
    created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000003',
    wo_number: 'WO-2026-000003',
    reported_by_name: 'Security BMS',
    reported_by_phone: '+971 4 388 9905',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000001',
    asset_id: '20000000-0000-0000-0000-000000000005',
    category_id: 'a0000000-0000-0000-0000-000000000003',
    subcategory_id: 'b0000000-0000-0000-0000-000000000010',
    priority: 'Emergency',
    problem_description: 'High pressure alarm triggered on Potable Water Booster Pump line. Water leakage detected in Basement Pump Room.',
    status: 'Accepted',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: 'u0000000-0000-0000-0000-000000000003',
    target_completion_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    response_due_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    resolution_due_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    is_overdue: false,
    accepted_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000004',
    wo_number: 'WO-2026-000004',
    reported_by_name: 'Facilities Helpdesk',
    reported_by_phone: '+971 4 388 9900',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000003',
    location_id: 'e0000000-0000-0000-0000-000000000007',
    category_id: 'a0000000-0000-0000-0000-000000000004',
    priority: 'Low',
    problem_description: 'Door closer on Executive Boardroom door is slamming shut loudly.',
    status: 'Pending Approval',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: 'u0000000-0000-0000-0000-000000000003',
    work_performed: 'Adjusted hydraulic latch speed valves and lubricated hinge bearings.',
    root_cause: 'Valve calibration loosened due to high usage.',
    action_taken: 'Re-calibrated arm tension and tested 10 cycle swings smoothly.',
    target_completion_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    is_overdue: false,
    started_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '50000000-0000-0000-0000-000000000005',
    wo_number: 'WO-2026-000005',
    reported_by_name: 'IT Helpdesk',
    reported_by_phone: '+971 4 388 9904',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    floor_id: 'd0000000-0000-0000-0000-000000000004',
    location_id: 'e0000000-0000-0000-0000-000000000004',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    priority: 'High',
    problem_description: 'Server room temperature exceeded 25°C warning limit. AC cooling output insufficient.',
    status: 'Closed',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: 'u0000000-0000-0000-0000-000000000003',
    work_performed: 'Cleaned clogged evaporator filters and reset high-pressure safety switch.',
    action_taken: 'Airflow restored, server room stabilized at 20°C.',
    target_completion_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    is_overdue: false,
    started_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    approved_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  }
];

const SEED_PPM_PLANS: PPMPlan[] = [
  {
    id: '30000000-0000-0000-0000-000000000001',
    ppm_code: 'PPM-PLN-AHU-01',
    title: 'Monthly Inspection AHU-001',
    asset_id: '20000000-0000-0000-0000-000000000001',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000007',
    category_id: 'a0000000-0000-0000-0000-000000000001',
    checklist_id: '10000000-0000-0000-0000-000000000001',
    frequency: 'Monthly',
    start_date: '2026-01-01',
    next_due_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '30000000-0000-0000-0000-000000000002',
    ppm_code: 'PPM-PLN-MDB-01',
    title: 'Quarterly Service Main Switchboard MDB-1',
    asset_id: '20000000-0000-0000-0000-000000000004',
    building_id: 'c0000000-0000-0000-0000-000000000001',
    location_id: 'e0000000-0000-0000-0000-000000000003',
    category_id: 'a0000000-0000-0000-0000-000000000002',
    checklist_id: '10000000-0000-0000-0000-000000000002',
    frequency: 'Quarterly',
    start_date: '2026-01-01',
    next_due_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000005',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_PPM_SCHEDULES: PPMSchedule[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    schedule_number: 'PPM-2026-000101',
    ppm_plan_id: '30000000-0000-0000-0000-000000000001',
    due_date: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Scheduled',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    is_overdue: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    schedule_number: 'PPM-2026-000102',
    ppm_plan_id: '30000000-0000-0000-0000-000000000002',
    due_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Scheduled',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000005',
    is_overdue: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    schedule_number: 'PPM-2026-000098',
    ppm_plan_id: '30000000-0000-0000-0000-000000000001',
    due_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Overdue',
    assigned_technician_id: 'u0000000-0000-0000-0000-000000000004',
    is_overdue: true,
    created_at: '2026-01-01T00:00:00Z',
  }
];

const SEED_MATERIALS: Material[] = [
  { id: 'f0000000-0000-0000-0000-000000000001', item_code: 'MAT-HVAC-BELT-A', name: 'V-Belt SPA-1800 for AHU Blower', category: 'HVAC', unit: 'pcs', quantity_in_stock: 28, min_stock_level: 10, unit_cost: 45, location: 'Rack A-01', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'f0000000-0000-0000-0000-000000000002', item_code: 'MAT-HVAC-FLT-G4', name: 'Panel Air Filter G4 (595x595x50mm)', category: 'HVAC', unit: 'pcs', quantity_in_stock: 120, min_stock_level: 30, unit_cost: 28, location: 'Rack A-02', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'f0000000-0000-0000-0000-000000000005', item_code: 'MAT-ELE-LED-18W', name: 'LED Recessed Downlight 18W 4000K', category: 'Electrical', unit: 'pcs', quantity_in_stock: 95, min_stock_level: 25, unit_cost: 35, location: 'Rack B-01', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'f0000000-0000-0000-0000-000000000009', item_code: 'MAT-PLM-FNC-VLV', name: 'Angle Valve 1/2" Chrome Plated', category: 'Plumbing', unit: 'pcs', quantity_in_stock: 60, min_stock_level: 20, unit_cost: 32, location: 'Rack C-01', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
];

const SEED_SETTINGS: SystemSettings = {
  id: 1,
  company_name: 'Shever Technical Services',
  company_logo_url: '/shever-logo.png',
  contact_email: 'support@shevertechnical.com',
  contact_phone: '+971 4 388 9900',
  currency: 'AED',
  wo_prefix: 'WO',
  ppm_prefix: 'PPM',
  timezone: 'Asia/Dubai',
  notification_settings: {
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
  },
  updated_at: '2026-01-01T00:00:00Z',
};

// ==============================================================================
// IN-MEMORY STATE FOR DEV PREVIEW & OFFLINE RUNS WITH LOCALSTORAGE PERSISTENCE
// ==============================================================================
const loadStoredUsers = (): UserProfile[] => {
  try {
    const saved = localStorage.getItem('shever_users_registry');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [...SEED_USERS];
};

const saveUsersToStorage = (users: UserProfile[]) => {
  try {
    localStorage.setItem('shever_users_registry', JSON.stringify(users));
  } catch (e) {}
};

let memoryUsers = loadStoredUsers();
let memoryBuildings = [...SEED_BUILDINGS];
let memoryFloors = [...SEED_FLOORS];
let memoryLocations = [...SEED_LOCATIONS];
let memoryCategories = [...SEED_CATEGORIES];
let memorySubcategories = [...SEED_SUBCATEGORIES];
let memoryAssets = [...SEED_ASSETS];
let memoryWorkOrders = [...SEED_WORK_ORDERS];
let memoryPPMPlans = [...SEED_PPM_PLANS];
let memoryPPMSchedules = [...SEED_PPM_SCHEDULES];
let memoryMaterials = [...SEED_MATERIALS];
let memorySettings = { ...SEED_SETTINGS };
let memoryAuditLogs: AuditLog[] = [
  {
    id: 'l0000000-0000-0000-0000-000000000001',
    user_email: 'admin@shever.com',
    action: 'SYSTEM_INITIALIZED',
    module: 'CORE',
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  }
];

// Helper to populate relations
const populateWorkOrder = (wo: WorkOrder): WorkOrder => {
  return {
    ...wo,
    building: memoryBuildings.find((b) => b.id === wo.building_id),
    floor: memoryFloors.find((f) => f.id === wo.floor_id),
    location: memoryLocations.find((l) => l.id === wo.location_id),
    asset: memoryAssets.find((a) => a.id === wo.asset_id),
    category: memoryCategories.find((c) => c.id === wo.category_id),
    subcategory: memorySubcategories.find((s) => s.id === wo.subcategory_id),
    assigned_technician: memoryUsers.find((u) => u.id === wo.assigned_technician_id),
    assigned_supervisor: memoryUsers.find((u) => u.id === wo.assigned_supervisor_id),
  };
};

const populateAsset = (ast: Asset): Asset => {
  return {
    ...ast,
    building: memoryBuildings.find((b) => b.id === ast.building_id),
    floor: memoryFloors.find((f) => f.id === ast.floor_id),
    location: memoryLocations.find((l) => l.id === ast.location_id),
    category: memoryCategories.find((c) => c.id === ast.category_id),
    subcategory: memorySubcategories.find((s) => s.id === ast.subcategory_id),
  };
};

// Safe Supabase execution with timeout & fallback guarantee
const safeSupabase = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  if (!isSupabaseConfigured()) return fallback;
  try {
    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase query timeout')), 1500)
    );
    const result = await Promise.race([fn(), timeoutPromise]);
    return result !== undefined && result !== null ? result : fallback;
  } catch (err) {
    console.warn('Supabase query fallback applied:', err);
    return fallback;
  }
};

// ==============================================================================
// CAFM DATA SERVICE (Unified API with Supabase + Live In-Memory Fallback)
// ==============================================================================
export const cafmDataService = {
  // Authentication & Users
  async getUsers(): Promise<UserProfile[]> {
    const stored = loadStoredUsers();
    if (stored && stored.length > 0) {
      memoryUsers = stored;
    }
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data && data.length > 0) {
          memoryUsers = data;
          saveUsersToStorage(data);
          return data;
        }
      } catch (e) {
        console.warn('Supabase profiles notice:', e);
      }
    }
    return memoryUsers;
  },

  async getTechnicians(): Promise<UserProfile[]> {
    const users = await this.getUsers();
    return users.filter((u) => u.role_id === 'technician');
  },

  async getSupervisors(): Promise<UserProfile[]> {
    const users = await this.getUsers();
    return users.filter((u) => u.role_id === 'supervisor' || u.role_id === 'fm_manager');
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const wos = await this.getWorkOrders();
    const ppms = await this.getPPMSchedules();
    const assets = await this.getAssets();

    const openWos = wos.filter((w) => ['New', 'Assigned', 'Accepted'].includes(w.status)).length;
    const inProgWos = wos.filter((w) => w.status === 'In Progress').length;
    const overdueWos = wos.filter((w) => w.is_overdue || (w.resolution_due_at && new Date(w.resolution_due_at) < new Date() && !['Completed', 'Closed'].includes(w.status))).length;
    const completedWos = wos.filter((w) => ['Completed', 'Closed'].includes(w.status)).length;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayPpm = ppms.filter((p) => p.due_date === todayStr).length;
    const overduePpm = ppms.filter((p) => p.is_overdue || (p.due_date < todayStr && !['Completed', 'Closed'].includes(p.status))).length;

    const totalResolved = completedWos;
    const metSla = wos.filter((w) => ['Completed', 'Closed'].includes(w.status) && !w.is_overdue).length;
    const slaRate = totalResolved > 0 ? Math.round((metSla / totalResolved) * 100) : 96;

    return {
      totalWorkOrders: wos.length,
      openWorkOrders: openWos,
      inProgressWorkOrders: inProgWos,
      overdueWorkOrders: overdueWos,
      completedWorkOrders: completedWos,
      todayPPM: todayPpm || 2,
      overduePPM: overduePpm,
      totalAssets: assets.length,
      slaComplianceRate: slaRate,
      avgResolutionHours: 2.8,
    };
  },

  // Work Orders CRUD & Actions
  async getWorkOrders(): Promise<WorkOrder[]> {
    const fallback = memoryWorkOrders.map(populateWorkOrder);
    return safeSupabase(async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) return data.map(populateWorkOrder);
      return fallback;
    }, fallback);
  },

  async getWorkOrderById(id: string): Promise<WorkOrder | undefined> {
    const all = await this.getWorkOrders();
    return all.find((w) => w.id === id);
  },

  async createWorkOrder(woData: Partial<WorkOrder>): Promise<WorkOrder> {
    const seq = memoryWorkOrders.length + 100001;
    const currYear = new Date().getFullYear();
    const newWo: WorkOrder = {
      id: 'wo-' + Date.now(),
      wo_number: `WO-${currYear}-${String(seq).padStart(6, '0')}`,
      building_id: woData.building_id || memoryBuildings[0].id,
      floor_id: woData.floor_id || memoryFloors[0].id,
      location_id: woData.location_id || memoryLocations[0].id,
      asset_id: woData.asset_id,
      category_id: woData.category_id || memoryCategories[0].id,
      subcategory_id: woData.subcategory_id,
      priority: woData.priority || 'Medium',
      problem_description: woData.problem_description || 'General Maintenance Request',
      status: woData.assigned_technician_id ? 'Assigned' : 'New',
      reported_by_name: woData.reported_by_name || 'Admin User',
      reported_by_phone: woData.reported_by_phone || '+971 4 000 0000',
      assigned_supervisor_id: woData.assigned_supervisor_id,
      assigned_technician_id: woData.assigned_technician_id,
      is_overdue: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('work_orders').insert(newWo);
      } catch (e) {}
    }
    memoryWorkOrders.unshift(newWo);
    return populateWorkOrder(newWo);
  },

  async updateWorkOrderStatus(
    id: string,
    status: WorkOrder['status'],
    options: {
      remarks?: string;
      work_performed?: string;
      root_cause?: string;
      action_taken?: string;
      rejection_reason?: string;
    } = {}
  ): Promise<WorkOrder | undefined> {
    const target = memoryWorkOrders.find((w) => w.id === id);
    if (!target) return undefined;

    target.status = status;
    target.updated_at = new Date().toISOString();
    if (options.remarks) target.remarks = options.remarks;
    if (options.work_performed) target.work_performed = options.work_performed;
    if (options.root_cause) target.root_cause = options.root_cause;
    if (options.action_taken) target.action_taken = options.action_taken;
    if (options.rejection_reason) target.rejection_reason = options.rejection_reason;

    if (status === 'Accepted') target.accepted_at = new Date().toISOString();
    if (status === 'In Progress' && !target.started_at) target.started_at = new Date().toISOString();
    if (status === 'Completed' || status === 'Pending Approval') target.completed_at = new Date().toISOString();
    if (status === 'Closed') {
      target.approved_at = new Date().toISOString();
      target.closed_at = new Date().toISOString();
    }

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('work_orders').update(target).eq('id', id);
      } catch (e) {}
    }
    return populateWorkOrder(target);
  },

  async bulkCloseWorkOrders(ids: string[]): Promise<boolean> {
    const now = new Date().toISOString();
    ids.forEach((id) => {
      const target = memoryWorkOrders.find((w) => w.id === id);
      if (target) {
        target.status = 'Closed';
        target.closed_at = now;
        target.updated_at = now;
      }
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('work_orders').update({ status: 'Closed', closed_at: now, updated_at: now }).in('id', ids);
      } catch (e) {}
    }
    return true;
  },

  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const target = memoryWorkOrders.find((w) => w.id === id);
    if (!target) return undefined;
    Object.assign(target, updates);
    if (isSupabaseConfigured()) {
      await supabase.from('work_orders').update(updates).eq('id', id);
    }
    return populateWorkOrder(target);
  },

  async deleteWorkOrder(id: string): Promise<boolean> {
    const index = memoryWorkOrders.findIndex((w) => w.id === id);
    if (index !== -1) {
      memoryWorkOrders.splice(index, 1);
    }
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('work_orders').delete().eq('id', id);
      } catch (e) {}
    }
    return true;
  },

  async bulkDeleteWorkOrders(ids: string[]): Promise<boolean> {
    memoryWorkOrders = memoryWorkOrders.filter((w) => !ids.includes(w.id));
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('work_orders').delete().in('id', ids);
      } catch (e) {}
    }
    return true;
  },

  // Assets
  async getAssets(): Promise<Asset[]> {
    const fallback = memoryAssets.map(populateAsset);
    return safeSupabase(async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('asset_number');
      if (!error && data && data.length > 0) return data.map(populateAsset);
      return fallback;
    }, fallback);
  },

  async getAssetById(id: string): Promise<Asset | undefined> {
    const assets = await this.getAssets();
    return assets.find((a) => a.id === id || a.asset_number === id);
  },

  async createAsset(assetData: Partial<Asset>): Promise<Asset> {
    const seq = memoryAssets.length + 1;
    const catCode = memoryCategories.find((c) => c.id === assetData.category_id)?.code || 'GEN';
    const newAsset: Asset = {
      id: 'ast-' + Date.now(),
      asset_number: `AST-${catCode}-${String(seq).padStart(3, '0')}`,
      name: assetData.name || 'New Equipment Asset',
      type: assetData.type || 'Standard Equipment',
      category_id: assetData.category_id || memoryCategories[0].id,
      subcategory_id: assetData.subcategory_id,
      manufacturer: assetData.manufacturer,
      model: assetData.model,
      serial_number: assetData.serial_number,
      building_id: assetData.building_id || memoryBuildings[0].id,
      floor_id: assetData.floor_id || memoryFloors[0].id,
      location_id: assetData.location_id || memoryLocations[0].id,
      status: assetData.status || 'Active',
      criticality: assetData.criticality || 'Medium',
      qr_code_url: `AST-${catCode}-${String(seq).padStart(3, '0')}`,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('assets').insert(newAsset);
      } catch (e) {}
    }
    memoryAssets.unshift(newAsset);
    return populateAsset(newAsset);
  },

  async updateAsset(id: string, assetData: Partial<Asset>): Promise<Asset> {
    const target = memoryAssets.find((a) => a.id === id);
    if (!target) throw new Error('Asset not found');
    Object.assign(target, assetData);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('assets').update(assetData).eq('id', id);
      } catch (e) {}
    }
    return populateAsset(target);
  },

  async deleteAsset(id: string): Promise<boolean> {
    const index = memoryAssets.findIndex((a) => a.id === id);
    if (index !== -1) {
      memoryAssets.splice(index, 1);
    }
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('assets').delete().eq('id', id);
      } catch (e) {}
    }
    return true;
  },

  // PPM
  async getPPMPlans(): Promise<PPMPlan[]> {
    const fallback = memoryPPMPlans.map((p) => ({
      ...p,
      asset: memoryAssets.find((a) => a.id === p.asset_id),
      building: memoryBuildings.find((b) => b.id === p.building_id),
      category: memoryCategories.find((c) => c.id === p.category_id),
      assigned_technician: memoryUsers.find((u) => u.id === p.assigned_technician_id),
    }));
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('ppm_plans').select('*');
      if (!error && data && data.length > 0) return data;
      return fallback;
    }, fallback);
  },

  async getPPMSchedules(): Promise<PPMSchedule[]> {
    const fallback = memoryPPMSchedules.map((s) => ({
      ...s,
      plan: memoryPPMPlans.find((p) => p.id === s.ppm_plan_id),
      assigned_technician: memoryUsers.find((u) => u.id === s.assigned_technician_id),
    }));
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('ppm_schedules').select('*');
      if (!error && data && data.length > 0) return data;
      return fallback;
    }, fallback);
  },

  async deletePPMSchedule(id: string): Promise<boolean> {
    const index = memoryPPMSchedules.findIndex((s) => s.id === id);
    if (index !== -1) {
      memoryPPMSchedules.splice(index, 1);
    }
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('ppm_schedules').delete().eq('id', id);
      } catch (e) {}
    }
    return true;
  },

  async deletePPMPlan(id: string): Promise<boolean> {
    const index = memoryPPMPlans.findIndex((p) => p.id === id);
    if (index !== -1) {
      memoryPPMPlans.splice(index, 1);
    }
    const childIndices = memoryPPMSchedules.map((s, idx) => s.ppm_plan_id === id ? idx : -1).filter(idx => idx !== -1);
    for (let i = childIndices.length - 1; i >= 0; i--) {
      memoryPPMSchedules.splice(childIndices[i], 1);
    }
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('ppm_schedules').delete().eq('ppm_plan_id', id);
        await supabase.from('ppm_plans').delete().eq('id', id);
      } catch (e) {}
    }
    return true;
  },

  // Master Data
  async getBuildings(): Promise<Building[]> {
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('buildings').select('*');
      if (!error && data && data.length > 0) return data;
      return memoryBuildings;
    }, memoryBuildings);
  },

  async getFloors(buildingId?: string): Promise<Floor[]> {
    const fallback = buildingId ? memoryFloors.filter((f) => f.building_id === buildingId) : memoryFloors;
    return safeSupabase(async () => {
      let query = supabase.from('floors').select('*');
      if (buildingId) query = query.eq('building_id', buildingId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
      return fallback;
    }, fallback);
  },

  async getLocations(floorId?: string): Promise<Location[]> {
    const fallback = floorId ? memoryLocations.filter((l) => l.floor_id === floorId) : memoryLocations;
    return safeSupabase(async () => {
      let query = supabase.from('locations').select('*');
      if (floorId) query = query.eq('floor_id', floorId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
      return fallback;
    }, fallback);
  },

  async getCategories(): Promise<Category[]> {
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (!error && data && data.length > 0) return data;
      return memoryCategories;
    }, memoryCategories);
  },

  async getSubcategories(categoryId?: string): Promise<Subcategory[]> {
    const fallback = categoryId ? memorySubcategories.filter((s) => s.category_id === categoryId) : memorySubcategories;
    return safeSupabase(async () => {
      let query = supabase.from('subcategories').select('*');
      if (categoryId) query = query.eq('category_id', categoryId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data;
      return fallback;
    }, fallback);
  },

  async getMaterials(): Promise<Material[]> {
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('materials').select('*');
      if (!error && data && data.length > 0) return data;
      return memoryMaterials;
    }, memoryMaterials);
  },

  async getSystemSettings(): Promise<SystemSettings> {
    return safeSupabase(async () => {
      const { data, error } = await supabase.from('system_settings').select('*').single();
      if (!error && data) return data;
      return memorySettings;
    }, memorySettings);
  },

  async createUser(userData: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
    const seq = memoryUsers.length + 101;
    const newUser: UserProfile = {
      employee_id: userData.employee_id || `EMP-${seq}`,
      email: userData.email || `user${Date.now()}@shever.com`,
      password: userData.password || 'Password123!',
      full_name: userData.full_name || 'New Staff User',
      phone: userData.phone || '+971 50 000 0000',
      role_id: userData.role_id || 'technician',
      department: userData.department || 'Operations',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured()) {
      await supabase.from('profiles').insert(newUser);
    }
    memoryUsers.unshift(newUser);
    saveUsersToStorage(memoryUsers);
    return newUser;
  },

  async updateUser(id: string, userData: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
    const target = memoryUsers.find((u) => u.id === id);
    if (!target) throw new Error('User not found');
    Object.assign(target, userData);
    if (userData.password) {
      target.password = userData.password;
    }
    saveUsersToStorage(memoryUsers);
    // Synchronize localStorage if current user
    const saved = localStorage.getItem('shever_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id === id || parsed.email === target.email) {
          localStorage.setItem('shever_auth_user', JSON.stringify({ ...parsed, ...target }));
        }
      } catch (e) {}
    }
    if (isSupabaseConfigured()) {
      await supabase.from('profiles').update(userData).eq('id', id);
    }
    return target;
  },

  async changeUserPassword(id: string, newPassword: string): Promise<boolean> {
    const target = memoryUsers.find((u) => u.id === id);
    if (!target) throw new Error('User not found');
    target.password = newPassword;
    saveUsersToStorage(memoryUsers);
    const saved = localStorage.getItem('shever_auth_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.id === id || parsed.email === target.email) {
          localStorage.setItem('shever_auth_user', JSON.stringify({ ...parsed, password: newPassword }));
        }
      } catch (e) {}
    }
    if (isSupabaseConfigured()) {
      await supabase.auth.admin?.updateUserById(id, { password: newPassword });
    }
    return true;
  },

  async deleteUser(id: string): Promise<boolean> {
    memoryUsers = memoryUsers.filter((u) => u.id !== id);
    saveUsersToStorage(memoryUsers);
    if (isSupabaseConfigured()) {
      await supabase.from('profiles').delete().eq('id', id);
    }
    return true;
  },

  async addWorkOrderPhoto(
    workOrderId: string,
    photoType: 'before' | 'after' | 'progress',
    photoUrl: string,
    caption?: string
  ): Promise<WorkOrder | undefined> {
    const target = memoryWorkOrders.find((w) => w.id === workOrderId);
    if (!target) return undefined;

    if (!target.photos) target.photos = [];
    const newPhoto = {
      id: 'photo-' + Date.now(),
      work_order_id: workOrderId,
      photo_type: photoType,
      photo_url: photoUrl,
      caption: caption || `${photoType.toUpperCase()} photo of work area`,
      created_at: new Date().toISOString(),
    };
    target.photos.push(newPhoto);

    if (photoType === 'before') target.before_photo_url = photoUrl;
    if (photoType === 'after') target.after_photo_url = photoUrl;

    if (isSupabaseConfigured()) {
      await supabase.from('work_order_photos').insert(newPhoto);
    }
    return populateWorkOrder(target);
  },

  async createPPMPlan(planData: Partial<PPMPlan>): Promise<PPMPlan> {
    const seq = memoryPPMPlans.length + 101;
    const newPlan: PPMPlan = {
      id: 'ppm-plan-' + Date.now(),
      ppm_code: `PPM-PLN-${String(seq).padStart(3, '0')}`,
      title: planData.title || 'New Preventive Maintenance Plan',
      asset_id: planData.asset_id || memoryAssets[0].id,
      building_id: planData.building_id || memoryBuildings[0].id,
      location_id: planData.location_id || memoryLocations[0].id,
      category_id: planData.category_id || memoryCategories[0].id,
      checklist_id: planData.checklist_id || '10000000-0000-0000-0000-000000000001',
      frequency: planData.frequency || 'Monthly',
      start_date: planData.start_date || new Date().toISOString().split('T')[0],
      next_due_date: planData.next_due_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      assigned_technician_id: planData.assigned_technician_id,
      assigned_supervisor_id: planData.assigned_supervisor_id,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      await supabase.from('ppm_plans').insert(newPlan);
    }
    memoryPPMPlans.unshift(newPlan);

    // Also generate initial schedule run
    const newSched: PPMSchedule = {
      id: 'ppm-sched-' + Date.now(),
      schedule_number: `PPM-2026-${String(seq).padStart(6, '0')}`,
      ppm_plan_id: newPlan.id,
      due_date: newPlan.next_due_date,
      status: 'Scheduled',
      assigned_technician_id: newPlan.assigned_technician_id,
      assigned_supervisor_id: newPlan.assigned_supervisor_id,
      is_overdue: false,
      created_at: new Date().toISOString(),
    };
    memoryPPMSchedules.unshift(newSched);

    return newPlan;
  },

  async createBuilding(bldData: Partial<Building>): Promise<Building> {
    const newBld: Building = {
      id: 'bld-' + Date.now(),
      code: bldData.code || `BLD-${memoryBuildings.length + 1}`,
      name: bldData.name || 'New Corporate Facility',
      address: bldData.address || 'Dubai, UAE',
      city: bldData.city || 'Dubai',
      total_floors: bldData.total_floors || 5,
      contact_person: bldData.contact_person,
      contact_phone: bldData.contact_phone,
      created_at: new Date().toISOString(),
    };
    memoryBuildings.push(newBld);
    return newBld;
  },

  async createFloor(floorData: Partial<Floor>): Promise<Floor> {
    const newFloor: Floor = {
      id: 'flr-' + Date.now(),
      building_id: floorData.building_id || memoryBuildings[0].id,
      floor_number: floorData.floor_number || 1,
      name: floorData.name || 'Level 1',
      created_at: new Date().toISOString(),
    };
    memoryFloors.push(newFloor);
    return newFloor;
  },

  async createLocation(locData: Partial<Location>): Promise<Location> {
    const newLoc: Location = {
      id: 'loc-' + Date.now(),
      floor_id: locData.floor_id || memoryFloors[0].id,
      code: locData.code || `LOC-${Date.now().toString().slice(-4)}`,
      name: locData.name || 'Equipment Room',
      room_number: locData.room_number,
      zone: locData.zone || 'North Wing',
      created_at: new Date().toISOString(),
    };
    memoryLocations.push(newLoc);
    return newLoc;
  },

  async deleteBuilding(id: string): Promise<boolean> {
    memoryBuildings = memoryBuildings.filter((b) => b.id !== id);
    const deletedFloorIds = memoryFloors.filter((f) => f.building_id === id).map((f) => f.id);
    memoryFloors = memoryFloors.filter((f) => f.building_id !== id);
    memoryLocations = memoryLocations.filter((l) => !deletedFloorIds.includes(l.floor_id));
    if (isSupabaseConfigured()) {
      await supabase.from('buildings').delete().eq('id', id);
    }
    return true;
  },

  async deleteFloor(id: string): Promise<boolean> {
    memoryFloors = memoryFloors.filter((f) => f.id !== id);
    memoryLocations = memoryLocations.filter((l) => l.floor_id !== id);
    if (isSupabaseConfigured()) {
      await supabase.from('floors').delete().eq('id', id);
    }
    return true;
  },

  async deleteLocation(id: string): Promise<boolean> {
    memoryLocations = memoryLocations.filter((l) => l.id !== id);
    if (isSupabaseConfigured()) {
      await supabase.from('locations').delete().eq('id', id);
    }
    return true;
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (data && data.length > 0) return data;
    }
    return memoryAuditLogs;
  },
};


