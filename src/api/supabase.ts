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
  PPMChecklist,
  PPMChecklistItem,
  SLAConfig
} from '../types';

/** Supabase Storage bucket holding work-order before/after photos. */
export const PHOTO_BUCKET = 'work-order-photos';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-shever.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || url === 'https://mock-shever.supabase.co') return false;
  if (url.includes('vercel.app')) return false;
  return Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);
};

// ==============================================================================
// SEED IN-MEMORY STORE (Fallback & Instant Dev Testing)
// ==============================================================================
const SEED_USERS: UserProfile[] = [
  {
    id: '90000000-0000-0000-0000-000000000001',
    email: 'admin@shever.com',
    full_name: 'Saif Al-Nuaimi (Admin)',
    phone: '+971 50 100 2000',
    role_id: 'admin',
    department: 'Executive Management',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '90000000-0000-0000-0000-000000000002',
    email: 'manager@shever.com',
    full_name: 'David Reynolds (FM Manager)',
    phone: '+971 50 200 3000',
    role_id: 'fm_manager',
    department: 'Facilities Operations',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '90000000-0000-0000-0000-000000000003',
    email: 'supervisor@shever.com',
    full_name: 'Hamad Al-Maktoum (Supervisor)',
    phone: '+971 50 300 4000',
    role_id: 'supervisor',
    department: 'MEP Operations',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '90000000-0000-0000-0000-000000000004',
    email: 'technician@shever.com',
    full_name: 'Rashid Khan (HVAC Technician)',
    phone: '+971 50 400 5000',
    role_id: 'technician',
    department: 'HVAC Maintenance',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '90000000-0000-0000-0000-000000000005',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: '90000000-0000-0000-0000-000000000003',
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
    assigned_supervisor_id: '90000000-0000-0000-0000-000000000003',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: '90000000-0000-0000-0000-000000000003',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: '90000000-0000-0000-0000-000000000003',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
    assigned_supervisor_id: '90000000-0000-0000-0000-000000000003',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000005',
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
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
    is_overdue: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    schedule_number: 'PPM-2026-000102',
    ppm_plan_id: '30000000-0000-0000-0000-000000000002',
    due_date: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Scheduled',
    assigned_technician_id: '90000000-0000-0000-0000-000000000005',
    is_overdue: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    schedule_number: 'PPM-2026-000098',
    ppm_plan_id: '30000000-0000-0000-0000-000000000001',
    due_date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    status: 'Overdue',
    assigned_technician_id: '90000000-0000-0000-0000-000000000004',
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
// IN-MEMORY STATE FOR DEV PREVIEW & OFFLINE RUNS WITH INSTANT LOCALSTORAGE CACHE
// ==============================================================================
/**
 * Devices that ran the pre-fix build hold local records that were never
 * persisted to the cloud — some with ids Postgres cannot accept. Bump this to
 * clear those caches once so every device reloads the real data from Supabase.
 */
const CACHE_VERSION = '2';
try {
  if (localStorage.getItem('shever_cache_version') !== CACHE_VERSION) {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('shever_') && k !== 'shever_auth_user')
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('shever_cache_version', CACHE_VERSION);
  }
} catch (e) {}

const loadStore = <T>(key: string, seed: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as T;
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') return parsed as T;
    }
  } catch (e) {}
  return seed;
};

const saveStore = <T>(key: string, data: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

let memoryUsers = loadStore('shever_users_registry', [...SEED_USERS]);
let memoryBuildings = loadStore('shever_buildings', [...SEED_BUILDINGS]);
let memoryFloors = loadStore('shever_floors', [...SEED_FLOORS]);
let memoryLocations = loadStore('shever_locations', [...SEED_LOCATIONS]);
let memoryCategories = loadStore('shever_categories', [...SEED_CATEGORIES]);
let memorySubcategories = loadStore('shever_subcategories', [...SEED_SUBCATEGORIES]);
let memoryAssets = loadStore('shever_assets', [...SEED_ASSETS]);
let memoryWorkOrders = loadStore('shever_work_orders', [...SEED_WORK_ORDERS]);
let memoryPPMPlans = loadStore('shever_ppm_plans', [...SEED_PPM_PLANS]);
let memoryPPMSchedules = loadStore('shever_ppm_schedules', [...SEED_PPM_SCHEDULES]);
let memoryMaterials = loadStore('shever_materials', [...SEED_MATERIALS]);
let memoryChecklists = loadStore<PPMChecklist[]>('shever_ppm_checklists', []);
let memoryChecklistItems = loadStore<PPMChecklistItem[]>('shever_ppm_checklist_items', []);
let memorySettings = loadStore('shever_settings', { ...SEED_SETTINGS });
let memoryAuditLogs = loadStore<AuditLog[]>('shever_audit_logs', [
  {
    id: '80000000-0000-0000-0000-000000000001',
    user_email: 'admin@shever.com',
    action: 'SYSTEM_INITIALIZED',
    module: 'CORE',
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  }
]);

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

// ==============================================================================
// CLOUD PERSISTENCE LAYER
//
// Every write goes to Supabase FIRST and is awaited. If the database rejects it
// the error is thrown, so the UI reports a real failure instead of showing a
// success toast over a change that only ever existed in this browser.
// ==============================================================================

/** Real UUIDs — Postgres rejects ids like 'ast-1724...' with error 22P02. */
export const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Live cloud state, surfaced in the UI so a sync failure is never silent. */
export const cloudSync = {
  online: false,
  lastError: null as string | null,
  lastSyncedAt: null as string | null,
  listeners: new Set<() => void>(),
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  set(online: boolean, error: string | null) {
    this.online = online;
    this.lastError = error;
    if (online) this.lastSyncedAt = new Date().toISOString();
    this.listeners.forEach((fn) => fn());
  },
};

/**
 * Fields the app keeps for its own rendering that are NOT database columns.
 * Sending them makes PostgREST reject the whole statement (PGRST204), which is
 * why joined objects previously had to be stripped before every write.
 */
const NON_COLUMN_FIELDS = [
  'building', 'floor', 'location', 'asset', 'category', 'subcategory',
  'assigned_technician', 'assigned_supervisor', 'plan', 'checklist',
  'photos', 'comments', 'materials', 'status_history', 'password',
];

const toRow = <T extends Record<string, any>>(obj: T): Record<string, any> => {
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (NON_COLUMN_FIELDS.includes(k)) continue;
    if (v === undefined) continue;
    row[k] = v;
  }
  return row;
};

/** Host only — safe to show on screen, unlike the full URL with its key. */
export const supabaseHost = (() => {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return supabaseUrl;
  }
})();

const describe = (err: any): string => {
  if (!err) return 'Unknown database error';
  const msg = err.message || err.details || String(err);

  if (/<(!doctype|html)/i.test(msg)) {
    return `Server returned a webpage (HTML) instead of database API response. Please verify your VITE_SUPABASE_URL is a valid https://xxx.supabase.co URL.`;
  }

  // "Failed to fetch" means the request never reached the server, so there is
  // no database error to report — the address itself is unreachable. Naming the
  // host turns an opaque TypeError into something actionable.
  if (/failed to fetch|networkerror|load failed|err_name_not_resolved/i.test(msg)) {
    return (
      `cannot reach ${supabaseHost}. Check that the project is not paused in ` +
      `Supabase (free projects pause after inactivity), that VITE_SUPABASE_URL ` +
      `is spelled correctly, and that no ad blocker is blocking the request.`
    );
  }

  if (err.message && err.hint) return `${err.message} (${err.hint})`;
  return msg;
};

/**
 * Awaited write. Throws on rejection so callers cannot report false success.
 * `label` names the operation in the error the user sees.
 */
const cloudWrite = async <T>(
  label: string,
  run: () => PromiseLike<{ data: T; error: any }>
): Promise<T | null> => {
  if (!isSupabaseConfigured()) {
    cloudSync.set(false, 'Supabase is not configured — changes stay on this device only.');
    return null;
  }
  const { data, error } = await run();
  if (error) {
    const msg = `${label} failed: ${describe(error)}`;
    cloudSync.set(false, msg);
    console.error('[cloud]', msg, error);
    throw new Error(msg);
  }
  cloudSync.set(true, null);
  return data;
};

/**
 * Awaited read. Returns cloud rows when reachable, otherwise the local cache.
 * Reads are cloud-first so a second browser or phone sees the same data.
 */
const cloudRead = async <T>(
  table: string,
  build: (q: any) => any,
  cacheKey: string
): Promise<T[] | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const query = build(supabase.from(table).select('*'));
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timed out after 8s')), 8000)
    );
    const { data, error } = (await Promise.race([query, timeout])) as any;
    if (error) {
      cloudSync.set(false, `Loading ${table} failed: ${describe(error)}`);
      console.error('[cloud] read', table, error);
      return null;
    }
    cloudSync.set(true, null);
    if (Array.isArray(data)) {
      // An empty table is a valid answer — cache it rather than falling back
      // to seed data, otherwise deletions never propagate between devices.
      saveStore(cacheKey, data);
      return data as T[];
    }
    return null;
  } catch (e: any) {
    cloudSync.set(false, `Loading ${table} failed: ${describe(e)}`);
    console.error('[cloud] read', table, e);
    return null;
  }
};

// ==============================================================================
// CAFM DATA SERVICE (Unified API with Supabase + Live In-Memory Fallback)
// ==============================================================================
export const cafmDataService = {
  // Authentication & Users
  async getUsers(): Promise<UserProfile[]> {
    const cloud = await cloudRead<UserProfile>(
      'profiles',
      (q) => q.order('created_at', { ascending: false }),
      'shever_users_registry'
    );
    if (cloud) {
      memoryUsers = cloud;
      return cloud;
    }
    return memoryUsers.length > 0 ? memoryUsers : SEED_USERS;
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
    const cloud = await cloudRead<WorkOrder>(
      'work_orders',
      (q) => q.order('created_at', { ascending: false }),
      'shever_work_orders'
    );
    if (cloud) memoryWorkOrders = cloud;
    const local = cloud || (memoryWorkOrders.length > 0 ? memoryWorkOrders : SEED_WORK_ORDERS);
    return local.map(populateWorkOrder);
  },

  async getWorkOrderById(id: string): Promise<WorkOrder | undefined> {
    const all = await this.getWorkOrders();
    return all.find((w) => w.id === id);
  },

  async createWorkOrder(woData: Partial<WorkOrder>): Promise<WorkOrder> {
    const seq = memoryWorkOrders.length + 100001;
    const currYear = new Date().getFullYear();
    const newWo: WorkOrder = {
      id: newId(),
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

    await cloudWrite('Creating work order', () =>
      supabase.from('work_orders').insert(toRow(newWo))
    );
    memoryWorkOrders.unshift(newWo);
    saveStore('shever_work_orders', memoryWorkOrders);
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

    saveStore('shever_work_orders', memoryWorkOrders);

    // toRow() drops the joined building/floor/asset objects — sending those
    // made PostgREST reject the whole UPDATE as unknown columns.
    await cloudWrite('Updating work order status', () =>
      supabase.from('work_orders').update(toRow(target)).eq('id', id)
    );
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

    saveStore('shever_work_orders', memoryWorkOrders);

    await cloudWrite('Closing work orders', () =>
      supabase.from('work_orders').update({ status: 'Closed', closed_at: now, updated_at: now }).in('id', ids)
    );
    return true;
  },

  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const target = memoryWorkOrders.find((w) => w.id === id);
    if (!target) return undefined;
    await cloudWrite('Updating work order', () =>
      supabase
        .from('work_orders')
        .update(toRow({ ...updates, updated_at: new Date().toISOString() }))
        .eq('id', id)
    );
    Object.assign(target, updates);
    saveStore('shever_work_orders', memoryWorkOrders);
    return populateWorkOrder(target);
  },

  async deleteWorkOrder(id: string): Promise<boolean> {
    await cloudWrite('Deleting work order', () =>
      supabase.from('work_orders').delete().eq('id', id)
    );
    const index = memoryWorkOrders.findIndex((w) => w.id === id);
    if (index !== -1) memoryWorkOrders.splice(index, 1);
    saveStore('shever_work_orders', memoryWorkOrders);
    return true;
  },

  async bulkDeleteWorkOrders(ids: string[]): Promise<boolean> {
    await cloudWrite('Deleting work orders', () =>
      supabase.from('work_orders').delete().in('id', ids)
    );
    memoryWorkOrders = memoryWorkOrders.filter((w) => !ids.includes(w.id));
    saveStore('shever_work_orders', memoryWorkOrders);
    return true;
  },

  // Assets
  async getAssets(): Promise<Asset[]> {
    const cloud = await cloudRead<Asset>('assets', (q) => q.order('asset_number'), 'shever_assets');
    if (cloud) memoryAssets = cloud;
    const local = cloud || (memoryAssets.length > 0 ? memoryAssets : SEED_ASSETS);
    return local.map(populateAsset);
  },

  async getAssetById(id: string): Promise<Asset | undefined> {
    const assets = await this.getAssets();
    return assets.find((a) => a.id === id || a.asset_number === id);
  },

  async createAsset(assetData: Partial<Asset>): Promise<Asset> {
    const seq = memoryAssets.length + 1;
    const catCode = memoryCategories.find((c) => c.id === assetData.category_id)?.code || 'GEN';
    const newAsset: Asset = {
      id: newId(),
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

    await cloudWrite('Creating asset', () => supabase.from('assets').insert(toRow(newAsset)));
    memoryAssets.unshift(newAsset);
    saveStore('shever_assets', memoryAssets);
    return populateAsset(newAsset);
  },

  async updateAsset(id: string, assetData: Partial<Asset>): Promise<Asset> {
    const target = memoryAssets.find((a) => a.id === id);
    if (!target) throw new Error('Asset not found');
    await cloudWrite('Updating asset', () =>
      supabase
        .from('assets')
        .update(toRow({ ...assetData, updated_at: new Date().toISOString() }))
        .eq('id', id)
    );
    Object.assign(target, assetData);
    saveStore('shever_assets', memoryAssets);
    return populateAsset(target);
  },

  async deleteAsset(id: string): Promise<boolean> {
    await cloudWrite('Deleting asset', () => supabase.from('assets').delete().eq('id', id));
    const index = memoryAssets.findIndex((a) => a.id === id);
    if (index !== -1) memoryAssets.splice(index, 1);
    saveStore('shever_assets', memoryAssets);
    return true;
  },

  // PPM
  async getPPMPlans(): Promise<PPMPlan[]> {
    const cloud = await cloudRead<PPMPlan>('ppm_plans', (q) => q, 'shever_ppm_plans');
    if (cloud) memoryPPMPlans = cloud;
    const local = cloud || (memoryPPMPlans.length > 0 ? memoryPPMPlans : SEED_PPM_PLANS);
    return local.map((p) => ({
      ...p,
      asset: memoryAssets.find((a) => a.id === p.asset_id),
      building: memoryBuildings.find((b) => b.id === p.building_id),
      category: memoryCategories.find((c) => c.id === p.category_id),
      assigned_technician: memoryUsers.find((u) => u.id === p.assigned_technician_id),
    }));
  },

  async getPPMSchedules(): Promise<PPMSchedule[]> {
    const cloud = await cloudRead<PPMSchedule>('ppm_schedules', (q) => q, 'shever_ppm_schedules');
    if (cloud) memoryPPMSchedules = cloud;
    const local = cloud || (memoryPPMSchedules.length > 0 ? memoryPPMSchedules : SEED_PPM_SCHEDULES);
    return local.map((s) => ({
      ...s,
      plan: memoryPPMPlans.find((p) => p.id === s.ppm_plan_id),
      assigned_technician: memoryUsers.find((u) => u.id === s.assigned_technician_id),
    }));
  },

  async deletePPMSchedule(id: string): Promise<boolean> {
    await cloudWrite('Deleting PPM schedule', () =>
      supabase.from('ppm_schedules').delete().eq('id', id)
    );
    const index = memoryPPMSchedules.findIndex((s) => s.id === id);
    if (index !== -1) memoryPPMSchedules.splice(index, 1);
    saveStore('shever_ppm_schedules', memoryPPMSchedules);
    return true;
  },

  async deletePPMPlan(id: string): Promise<boolean> {
    await cloudWrite('Deleting PPM plan', async () => {
      const child = await supabase.from('ppm_schedules').delete().eq('ppm_plan_id', id);
      if (child.error) return child;
      return supabase.from('ppm_plans').delete().eq('id', id);
    });

    const index = memoryPPMPlans.findIndex((p) => p.id === id);
    if (index !== -1) {
      memoryPPMPlans.splice(index, 1);
    }
    const childIndices = memoryPPMSchedules.map((s, idx) => s.ppm_plan_id === id ? idx : -1).filter(idx => idx !== -1);
    for (let i = childIndices.length - 1; i >= 0; i--) {
      memoryPPMSchedules.splice(childIndices[i], 1);
    }
    saveStore('shever_ppm_plans', memoryPPMPlans);
    saveStore('shever_ppm_schedules', memoryPPMSchedules);
    return true;
  },

  // Master Data
  async getBuildings(): Promise<Building[]> {
    const cloud = await cloudRead<Building>('buildings', (q) => q.order('code'), 'shever_buildings');
    if (cloud) memoryBuildings = cloud;
    return cloud || (memoryBuildings.length > 0 ? memoryBuildings : SEED_BUILDINGS);
  },

  async getFloors(buildingId?: string): Promise<Floor[]> {
    const cloud = await cloudRead<Floor>('floors', (q) => q, 'shever_floors');
    if (cloud) memoryFloors = cloud;
    const all = cloud || memoryFloors;
    return buildingId ? all.filter((f) => f.building_id === buildingId) : all;
  },

  async getLocations(floorId?: string): Promise<Location[]> {
    const cloud = await cloudRead<Location>('locations', (q) => q, 'shever_locations');
    if (cloud) memoryLocations = cloud;
    const all = cloud || memoryLocations;
    return floorId ? all.filter((l) => l.floor_id === floorId) : all;
  },

  async getCategories(): Promise<Category[]> {
    const cloud = await cloudRead<Category>('categories', (q) => q, 'shever_categories');
    if (cloud) memoryCategories = cloud;
    return cloud || (memoryCategories.length > 0 ? memoryCategories : SEED_CATEGORIES);
  },

  async getSubcategories(categoryId?: string): Promise<Subcategory[]> {
    const cloud = await cloudRead<Subcategory>('subcategories', (q) => q, 'shever_subcategories');
    if (cloud) memorySubcategories = cloud;
    const all = cloud || memorySubcategories;
    return categoryId ? all.filter((s) => s.category_id === categoryId) : all;
  },

  async getMaterials(): Promise<Material[]> {
    const cloud = await cloudRead<Material>('materials', (q) => q, 'shever_materials');
    if (cloud) memoryMaterials = cloud;
    return cloud || (memoryMaterials.length > 0 ? memoryMaterials : SEED_MATERIALS);
  },

  /** Response and resolution targets per priority, straight from the table. */
  async getSlaConfigs(): Promise<SLAConfig[]> {
    const cloud = await cloudRead<SLAConfig>(
      'sla_configs',
      (q) => q.order('response_time_minutes'),
      'shever_sla_configs'
    );
    return cloud || [];
  },

  async getSystemSettings(): Promise<SystemSettings> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*').limit(1).maybeSingle();
        if (!error && data) {
          memorySettings = data;
          saveStore('shever_settings', memorySettings);
          cloudSync.set(true, null);
        }
      } catch (e) {
        console.error('[cloud] read system_settings', e);
      }
    }
    return memorySettings;
  },

  async updateSystemSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    const merged = { ...memorySettings, ...updates, updated_at: new Date().toISOString() };
    await cloudWrite('Saving system settings', () =>
      supabase.from('system_settings').update(toRow(updates)).eq('id', merged.id)
    );
    memorySettings = merged;
    saveStore('shever_settings', memorySettings);
    return memorySettings;
  },

  async createUser(userData: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
    const seq = memoryUsers.length + 101;
    const newUser: UserProfile = {
      id: userData.id || newId(),
      employee_id: userData.employee_id || `EMP-${seq}`,
      email: (userData.email || `user${Date.now()}@shever.com`).trim().toLowerCase(),
      full_name: userData.full_name || 'New Staff User',
      phone: userData.phone || '+971 50 000 0000',
      role_id: userData.role_id || 'technician',
      department: userData.department || 'Operations',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Cloud first: if the profile cannot be saved, the account must not appear
    // to exist locally either.
    const saved = await cloudWrite('Creating user', () =>
      supabase.from('profiles').insert(toRow(newUser)).select().single()
    );
    const stored: UserProfile = (saved as UserProfile) || newUser;

    if (isSupabaseConfigured()) {
      await cloudWrite('Setting the password', () =>
        supabase.rpc('app_set_password', {
          p_user_id: stored.id,
          p_password: userData.password || 'Password123!',
        })
      );
    } else {
      // Offline demo mode: the device is the only place the password can live.
      stored.password = userData.password || 'Password123!';
    }

    memoryUsers.unshift(stored);
    saveStore('shever_users_registry', memoryUsers);
    return stored;
  },

  async updateUser(id: string, userData: Partial<UserProfile> & { password?: string }): Promise<UserProfile> {
    const { password, ...profileFields } = userData;

    // Normalise the sign-in identifiers exactly as createUser does. Saving an
    // address with a stray space or capital used to lock the account out: the
    // login lookup lowercases the stored value but the user types the clean one.
    if (typeof profileFields.email === 'string') {
      profileFields.email = profileFields.email.trim().toLowerCase();
    }
    if (typeof profileFields.employee_id === 'string') {
      profileFields.employee_id = profileFields.employee_id.trim();
    }

    const updated = await cloudWrite('Saving user details', () =>
      supabase
        .from('profiles')
        .update(toRow({ ...profileFields, updated_at: new Date().toISOString() }))
        .eq('id', id)
        .select()
        .single()
    );

    if (password) {
      await this.changeUserPassword(id, password);
    }

    const target = memoryUsers.find((u) => u.id === id);
    const merged: UserProfile =
      (updated as UserProfile) ||
      (target ? Object.assign(target, profileFields) : ({ id, ...profileFields } as UserProfile));

    if (target) Object.assign(target, merged);
    else memoryUsers.unshift(merged);
    saveStore('shever_users_registry', memoryUsers);

    // Keep the signed-in user's own cached profile in step
    const session = localStorage.getItem('shever_auth_user');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.id === id) {
          localStorage.setItem('shever_auth_user', JSON.stringify({ ...parsed, ...merged }));
        }
      } catch (e) {}
    }
    return merged;
  },

  async changeUserPassword(id: string, newPassword: string): Promise<boolean> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (!isSupabaseConfigured()) {
      throw new Error(
        'Cannot change the password: this build has no Supabase connection, so the ' +
          'new password would only work in this browser. Set VITE_SUPABASE_URL and ' +
          'VITE_SUPABASE_ANON_KEY, then redeploy.'
      );
    }

    // Hashed and stored server-side by app_set_password. Throws if it fails,
    // so the Users screen can never show "password changed" over a no-op.
    await cloudWrite('Changing the password', () =>
      supabase.rpc('app_set_password', { p_user_id: id, p_password: newPassword })
    );

    // The plaintext password is never kept on the device any more.
    const target = memoryUsers.find((u) => u.id === id);
    if (target) delete target.password;
    saveStore('shever_users_registry', memoryUsers);
    return true;
  },

  async deleteUser(id: string): Promise<boolean> {
    await cloudWrite('Deleting user', () => supabase.from('profiles').delete().eq('id', id));
    memoryUsers = memoryUsers.filter((u) => u.id !== id);
    saveStore('shever_users_registry', memoryUsers);
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
      id: newId(),
      work_order_id: workOrderId,
      photo_type: photoType,
      photo_url: photoUrl,
      caption: caption || `${photoType.toUpperCase()} photo of work area`,
      created_at: new Date().toISOString(),
    };
    target.photos.push(newPhoto);

    if (photoType === 'before') target.before_photo_url = photoUrl;
    if (photoType === 'after') target.after_photo_url = photoUrl;

    await cloudWrite('Saving photo', () =>
      supabase.from('work_order_photos').insert(toRow(newPhoto))
    );
    if (photoType === 'before' || photoType === 'after') {
      await cloudWrite('Updating work order photo', () =>
        supabase
          .from('work_orders')
          .update({
            [`${photoType}_photo_url`]: photoUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', workOrderId)
      );
    }
    saveStore('shever_work_orders', memoryWorkOrders);
    return populateWorkOrder(target);
  },

  async createPPMPlan(planData: Partial<PPMPlan>): Promise<PPMPlan> {
    const seq = memoryPPMPlans.length + 101;
    const newPlan: PPMPlan = {
      id: newId(),
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

    await cloudWrite('Creating PPM plan', () => supabase.from('ppm_plans').insert(toRow(newPlan)));
    memoryPPMPlans.unshift(newPlan);
    saveStore('shever_ppm_plans', memoryPPMPlans);

    // Also generate initial schedule run
    const newSched: PPMSchedule = {
      id: newId(),
      schedule_number: `PPM-2026-${String(seq).padStart(6, '0')}`,
      ppm_plan_id: newPlan.id,
      due_date: newPlan.next_due_date,
      status: 'Scheduled',
      assigned_technician_id: newPlan.assigned_technician_id,
      assigned_supervisor_id: newPlan.assigned_supervisor_id,
      is_overdue: false,
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating PPM schedule', () =>
      supabase.from('ppm_schedules').insert(toRow(newSched))
    );
    memoryPPMSchedules.unshift(newSched);
    saveStore('shever_ppm_schedules', memoryPPMSchedules);

    return newPlan;
  },

  async createBuilding(bldData: Partial<Building>): Promise<Building> {
    const newBld: Building = {
      id: newId(),
      code: bldData.code || `BLD-${memoryBuildings.length + 1}`,
      name: bldData.name || 'New Corporate Facility',
      address: bldData.address || 'Dubai, UAE',
      city: bldData.city || 'Dubai',
      total_floors: bldData.total_floors || 5,
      contact_person: bldData.contact_person,
      contact_phone: bldData.contact_phone,
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating building', () => supabase.from('buildings').insert(toRow(newBld)));
    memoryBuildings.push(newBld);
    saveStore('shever_buildings', memoryBuildings);
    return newBld;
  },

  async createFloor(floorData: Partial<Floor>): Promise<Floor> {
    const newFloor: Floor = {
      id: newId(),
      building_id: floorData.building_id || memoryBuildings[0].id,
      floor_number: floorData.floor_number || 1,
      name: floorData.name || 'Level 1',
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating floor', () => supabase.from('floors').insert(toRow(newFloor)));
    memoryFloors.push(newFloor);
    saveStore('shever_floors', memoryFloors);
    return newFloor;
  },

  async createLocation(locData: Partial<Location>): Promise<Location> {
    const newLoc: Location = {
      id: newId(),
      floor_id: locData.floor_id || memoryFloors[0].id,
      code: locData.code || `LOC-${Date.now().toString().slice(-4)}`,
      name: locData.name || 'Equipment Room',
      room_number: locData.room_number,
      zone: locData.zone || 'North Wing',
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating location', () => supabase.from('locations').insert(toRow(newLoc)));
    memoryLocations.push(newLoc);
    saveStore('shever_locations', memoryLocations);
    return newLoc;
  },

  async deleteBuilding(id: string): Promise<boolean> {
    await cloudWrite('Deleting building', () => supabase.from('buildings').delete().eq('id', id));
    memoryBuildings = memoryBuildings.filter((b) => b.id !== id);
    const deletedFloorIds = memoryFloors.filter((f) => f.building_id === id).map((f) => f.id);
    memoryFloors = memoryFloors.filter((f) => f.building_id !== id);
    memoryLocations = memoryLocations.filter((l) => !deletedFloorIds.includes(l.floor_id));
    saveStore('shever_buildings', memoryBuildings);
    saveStore('shever_floors', memoryFloors);
    saveStore('shever_locations', memoryLocations);
    return true;
  },

  async deleteFloor(id: string): Promise<boolean> {
    await cloudWrite('Deleting floor', () => supabase.from('floors').delete().eq('id', id));
    memoryFloors = memoryFloors.filter((f) => f.id !== id);
    memoryLocations = memoryLocations.filter((l) => l.floor_id !== id);
    saveStore('shever_floors', memoryFloors);
    saveStore('shever_locations', memoryLocations);
    return true;
  },

  async deleteLocation(id: string): Promise<boolean> {
    await cloudWrite('Deleting location', () => supabase.from('locations').delete().eq('id', id));
    memoryLocations = memoryLocations.filter((l) => l.id !== id);
    saveStore('shever_locations', memoryLocations);
    return true;
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const cloud = await cloudRead<AuditLog>(
      'audit_logs',
      (q) => q.order('created_at', { ascending: false }).limit(50),
      'shever_audit_logs'
    );
    if (cloud && cloud.length > 0) {
      memoryAuditLogs = cloud;
      return cloud;
    }
    return memoryAuditLogs;
  },

  // ============================================================================
  // MATERIALS & STOCK
  // ============================================================================
  async createMaterial(data: Partial<Material>): Promise<Material> {
    const material: Material = {
      id: newId(),
      item_code: (data.item_code || `MAT-${Date.now().toString().slice(-6)}`).toUpperCase(),
      name: data.name || 'New Material',
      category: data.category || 'General',
      unit: data.unit || 'pcs',
      quantity_in_stock: Number(data.quantity_in_stock ?? 0),
      min_stock_level: Number(data.min_stock_level ?? 5),
      unit_cost: Number(data.unit_cost ?? 0),
      location: data.location || 'Central Store',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await cloudWrite('Creating material', () =>
      supabase.from('materials').insert(toRow(material))
    );
    memoryMaterials.unshift(material);
    saveStore('shever_materials', memoryMaterials);
    return material;
  },

  async updateMaterial(id: string, data: Partial<Material>): Promise<Material> {
    const target = memoryMaterials.find((m) => m.id === id);
    if (!target) throw new Error('Material not found');
    await cloudWrite('Updating material', () =>
      supabase
        .from('materials')
        .update(toRow({ ...data, updated_at: new Date().toISOString() }))
        .eq('id', id)
    );
    Object.assign(target, data);
    saveStore('shever_materials', memoryMaterials);
    return target;
  },

  async deleteMaterial(id: string): Promise<boolean> {
    await cloudWrite('Deleting material', () => supabase.from('materials').delete().eq('id', id));
    memoryMaterials = memoryMaterials.filter((m) => m.id !== id);
    saveStore('shever_materials', memoryMaterials);
    return true;
  },

  /**
   * Stock movement. Writes a material_transactions row alongside the new level
   * so consumption stays auditable rather than the quantity silently changing.
   */
  async adjustMaterialStock(
    id: string,
    delta: number,
    reason: 'IN' | 'OUT' | 'ADJUST',
    notes?: string
  ): Promise<Material> {
    const target = memoryMaterials.find((m) => m.id === id);
    if (!target) throw new Error('Material not found');

    const next = Math.max(0, Number(target.quantity_in_stock) + delta);

    await cloudWrite('Updating stock level', () =>
      supabase
        .from('materials')
        .update({ quantity_in_stock: next, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    // Ledger entry is best-effort: the stock level is the source of truth and
    // must not be rolled back if only the audit row fails.
    try {
      await cloudWrite('Recording stock movement', () =>
        supabase.from('material_transactions').insert(
          toRow({
            id: newId(),
            material_id: id,
            transaction_type: reason,
            quantity: Math.abs(delta),
            reference_type: 'AUDIT_ADJUSTMENT',
            notes: notes || `Stock ${reason} of ${Math.abs(delta)} ${target.unit}`,
            created_at: new Date().toISOString(),
          })
        )
      );
    } catch (e) {
      console.warn('Stock ledger entry failed; level was still updated', e);
    }

    target.quantity_in_stock = next;
    saveStore('shever_materials', memoryMaterials);
    return target;
  },

  // ============================================================================
  // CATEGORIES & SUBCATEGORIES
  // ============================================================================
  async createCategory(data: Partial<Category>): Promise<Category> {
    const category: Category = {
      id: newId(),
      name: data.name || 'New Trade',
      code: (data.code || data.name || 'NEW').toUpperCase().slice(0, 12),
      description: data.description,
      icon: data.icon || 'Wrench',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating category', () =>
      supabase.from('categories').insert(toRow(category))
    );
    memoryCategories.push(category);
    saveStore('shever_categories', memoryCategories);
    return category;
  },

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const target = memoryCategories.find((c) => c.id === id);
    if (!target) throw new Error('Category not found');
    await cloudWrite('Updating category', () =>
      supabase.from('categories').update(toRow(data)).eq('id', id)
    );
    Object.assign(target, data);
    saveStore('shever_categories', memoryCategories);
    return target;
  },

  async deleteCategory(id: string): Promise<boolean> {
    await cloudWrite('Deleting category', () =>
      supabase.from('categories').delete().eq('id', id)
    );
    memoryCategories = memoryCategories.filter((c) => c.id !== id);
    memorySubcategories = memorySubcategories.filter((s) => s.category_id !== id);
    saveStore('shever_categories', memoryCategories);
    saveStore('shever_subcategories', memorySubcategories);
    return true;
  },

  async createSubcategory(data: Partial<Subcategory>): Promise<Subcategory> {
    if (!data.category_id) throw new Error('Pick a parent trade first');
    const sub: Subcategory = {
      id: newId(),
      category_id: data.category_id,
      name: data.name || 'New Equipment Type',
      code: (data.code || data.name || 'NEW').toUpperCase().slice(0, 12),
      description: data.description,
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating subcategory', () =>
      supabase.from('subcategories').insert(toRow(sub))
    );
    memorySubcategories.push(sub);
    saveStore('shever_subcategories', memorySubcategories);
    return sub;
  },

  async updateSubcategory(id: string, data: Partial<Subcategory>): Promise<Subcategory> {
    const target = memorySubcategories.find((s) => s.id === id);
    if (!target) throw new Error('Subcategory not found');
    await cloudWrite('Updating subcategory', () =>
      supabase.from('subcategories').update(toRow(data)).eq('id', id)
    );
    Object.assign(target, data);
    saveStore('shever_subcategories', memorySubcategories);
    return target;
  },

  async deleteSubcategory(id: string): Promise<boolean> {
    await cloudWrite('Deleting subcategory', () =>
      supabase.from('subcategories').delete().eq('id', id)
    );
    memorySubcategories = memorySubcategories.filter((s) => s.id !== id);
    saveStore('shever_subcategories', memorySubcategories);
    return true;
  },

  // ============================================================================
  // PPM CHECKLISTS
  // ============================================================================
  async getPPMChecklists(): Promise<PPMChecklist[]> {
    const cloud = await cloudRead<PPMChecklist>(
      'ppm_checklists',
      (q) => q.order('title'),
      'shever_ppm_checklists'
    );
    if (cloud) memoryChecklists = cloud;
    const items = await this.getPPMChecklistItems();
    return (cloud || memoryChecklists).map((c) => ({
      ...c,
      category: memoryCategories.find((cat) => cat.id === c.category_id),
      items: items
        .filter((i) => i.checklist_id === c.id)
        .sort((a, b) => a.item_order - b.item_order),
    }));
  },

  async getPPMChecklistItems(): Promise<PPMChecklistItem[]> {
    const cloud = await cloudRead<PPMChecklistItem>(
      'ppm_checklist_items',
      (q) => q.order('item_order'),
      'shever_ppm_checklist_items'
    );
    if (cloud) memoryChecklistItems = cloud;
    return cloud || memoryChecklistItems;
  },

  async createPPMChecklist(data: Partial<PPMChecklist>): Promise<PPMChecklist> {
    const checklist: PPMChecklist = {
      id: newId(),
      title: data.title || 'New Inspection Checklist',
      category_id: data.category_id || memoryCategories[0]?.id,
      description: data.description,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await cloudWrite('Creating checklist', () =>
      supabase.from('ppm_checklists').insert(toRow(checklist))
    );
    memoryChecklists.unshift(checklist);
    saveStore('shever_ppm_checklists', memoryChecklists);
    return checklist;
  },

  async updatePPMChecklist(id: string, data: Partial<PPMChecklist>): Promise<PPMChecklist> {
    const target = memoryChecklists.find((c) => c.id === id);
    if (!target) throw new Error('Checklist not found');
    await cloudWrite('Updating checklist', () =>
      supabase
        .from('ppm_checklists')
        .update(toRow({ ...data, updated_at: new Date().toISOString() }))
        .eq('id', id)
    );
    Object.assign(target, data);
    saveStore('shever_ppm_checklists', memoryChecklists);
    return target;
  },

  async deletePPMChecklist(id: string): Promise<boolean> {
    await cloudWrite('Deleting checklist', () =>
      supabase.from('ppm_checklists').delete().eq('id', id)
    );
    memoryChecklists = memoryChecklists.filter((c) => c.id !== id);
    memoryChecklistItems = memoryChecklistItems.filter((i) => i.checklist_id !== id);
    saveStore('shever_ppm_checklists', memoryChecklists);
    saveStore('shever_ppm_checklist_items', memoryChecklistItems);
    return true;
  },

  async createPPMChecklistItem(data: Partial<PPMChecklistItem>): Promise<PPMChecklistItem> {
    if (!data.checklist_id) throw new Error('Checklist is required');
    const siblings = memoryChecklistItems.filter((i) => i.checklist_id === data.checklist_id);
    const item: PPMChecklistItem = {
      id: newId(),
      checklist_id: data.checklist_id,
      item_order: data.item_order ?? siblings.length + 1,
      task_description: data.task_description || 'New inspection task',
      field_type: data.field_type || 'pass_fail',
      unit_of_measure: data.unit_of_measure,
      min_value: data.min_value,
      max_value: data.max_value,
      is_mandatory: data.is_mandatory ?? true,
      dropdown_options: data.dropdown_options || [],
    };
    await cloudWrite('Adding checklist task', () =>
      supabase.from('ppm_checklist_items').insert(toRow(item))
    );
    memoryChecklistItems.push(item);
    saveStore('shever_ppm_checklist_items', memoryChecklistItems);
    return item;
  },

  async updatePPMChecklistItem(
    id: string,
    data: Partial<PPMChecklistItem>
  ): Promise<PPMChecklistItem> {
    const target = memoryChecklistItems.find((i) => i.id === id);
    if (!target) throw new Error('Task not found');
    await cloudWrite('Updating checklist task', () =>
      supabase.from('ppm_checklist_items').update(toRow(data)).eq('id', id)
    );
    Object.assign(target, data);
    saveStore('shever_ppm_checklist_items', memoryChecklistItems);
    return target;
  },

  async deletePPMChecklistItem(id: string): Promise<boolean> {
    await cloudWrite('Removing checklist task', () =>
      supabase.from('ppm_checklist_items').delete().eq('id', id)
    );
    memoryChecklistItems = memoryChecklistItems.filter((i) => i.id !== id);
    saveStore('shever_ppm_checklist_items', memoryChecklistItems);
    return true;
  },

  // ============================================================================
  // PHOTO UPLOAD (Supabase Storage)
  // ============================================================================
  /**
   * Uploads the file to the `work-order-photos` bucket and records the row.
   * Previously photos could only be attached by URL, so nothing was ever
   * actually stored.
   */
  async uploadWorkOrderPhoto(
    workOrderId: string,
    file: File,
    photoType: 'before' | 'progress' | 'after',
    caption?: string
  ): Promise<WorkOrder | undefined> {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Photo upload needs a cloud connection. Set VITE_SUPABASE_URL and ' +
          'VITE_SUPABASE_ANON_KEY, then redeploy.'
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`);
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files can be attached as photos.');
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${workOrderId}/${photoType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (uploadError) {
      const msg = /bucket/i.test(uploadError.message)
        ? `Storage bucket "${PHOTO_BUCKET}" is missing. Run database/07_storage_and_sla.sql in Supabase.`
        : `Photo upload failed: ${uploadError.message}`;
      cloudSync.set(false, msg);
      throw new Error(msg);
    }

    const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return this.addWorkOrderPhoto(workOrderId, photoType, pub.publicUrl, caption);
  },

  async deleteWorkOrderPhoto(workOrderId: string, photoId: string): Promise<boolean> {
    await cloudWrite('Removing photo', () =>
      supabase.from('work_order_photos').delete().eq('id', photoId)
    );
    const wo = memoryWorkOrders.find((w) => w.id === workOrderId);
    if (wo?.photos) wo.photos = wo.photos.filter((p) => p.id !== photoId);
    saveStore('shever_work_orders', memoryWorkOrders);
    return true;
  },

  // ============================================================================
  // SLA ESCALATION
  // ============================================================================
  /**
   * Flags work orders whose resolution deadline has passed. `resolution_due_at`
   * was stored but nothing ever acted on it, so breaches went unnoticed.
   * Returns the ones newly marked so the caller can notify.
   */
  async escalateBreachedWorkOrders(): Promise<WorkOrder[]> {
    const now = new Date();
    const open = memoryWorkOrders.filter(
      (w) =>
        !['Completed', 'Closed', 'Cancelled'].includes(w.status) &&
        w.resolution_due_at &&
        new Date(w.resolution_due_at) < now &&
        !w.is_overdue
    );
    if (open.length === 0) return [];

    const ids = open.map((w) => w.id);
    await cloudWrite('Flagging SLA breaches', () =>
      supabase
        .from('work_orders')
        .update({ is_overdue: true, updated_at: now.toISOString() })
        .in('id', ids)
    );

    open.forEach((w) => {
      w.is_overdue = true;
    });
    saveStore('shever_work_orders', memoryWorkOrders);
    return open;
  },
};


