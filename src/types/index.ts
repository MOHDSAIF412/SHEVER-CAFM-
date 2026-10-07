export type UserRole = 'admin' | 'fm_manager' | 'supervisor' | 'technician';

export interface UserPermissions {
  can_delete: boolean;
  can_close: boolean;
  can_edit: boolean;
  can_create: boolean;
  can_manage_users: boolean;
}

export interface UserProfile {
  id: string;
  employee_id?: string;
  email: string;
  password?: string;
  full_name: string;
  phone?: string;
  role_id: UserRole;
  avatar_url?: string;
  department?: string;
  trade_code?: string | null;
  grade?: string | null;
  is_active: boolean;
  permissions?: UserPermissions;
  last_login_at?: string;
  created_at: string;
}

export interface Facility {
  id: string;
  contract_id?: string | null;
  code: string;
  name: string;
  address?: string;
  city?: string;
  qr_token?: string | null;
  is_active?: boolean;
  created_at: string;
}

export interface Zone {
  id: string;
  floor_id: string;
  code: string;
  name: string;
  created_at: string;
}

export interface Building {
  id: string;
  facility_id?: string | null;
  code: string;
  name: string;
  address?: string;
  city?: string;
  total_floors: number;
  contact_person?: string;
  contact_phone?: string;
  created_at: string;
}

export interface Floor {
  id: string;
  building_id: string;
  floor_number: number;
  name: string;
  floor_plan_url?: string;
  created_at: string;
  building?: Building;
}

export interface Location {
  id: string;
  floor_id: string;
  code: string;
  name: string;
  room_number?: string;
  zone?: string;
  zone_id?: string | null;
  space_type?: string;
  area_sqm?: number | null;
  qr_token?: string | null;
  created_at: string;
  floor?: Floor;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  code: string;
  description?: string;
  created_at: string;
  category?: Category;
}

export interface SLAConfig {
  id: 'Emergency' | 'High' | 'Medium' | 'Low';
  priority: string;
  response_time_minutes: number;
  resolution_time_hours: number;
  color_hex: string;
  description?: string;
}

export interface Asset {
  id: string;
  asset_number: string;
  name: string;
  type?: string;
  category_id: string;
  subcategory_id?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  building_id: string;
  floor_id: string;
  location_id: string;
  installation_date?: string;
  warranty_expiry?: string;
  amc_start?: string;
  amc_expiry?: string;
  status: 'Active' | 'Inactive' | 'Under Maintenance' | 'Disposed';
  criticality: 'Critical' | 'High' | 'Medium' | 'Low';
  qr_code_url?: string;
  photo_url?: string;
  specifications?: Record<string, any>;
  facility_id?: string | null;
  zone_id?: string | null;
  parent_asset_id?: string | null;
  nesting_reference?: string;
  position_code?: string;
  barcode?: string;
  purchase_cost?: number | null;
  expected_life_years?: number | null;
  condition_score?: number | null;
  created_at: string;
  building?: Building;
  floor?: Floor;
  location?: Location;
  category?: Category;
  subcategory?: Subcategory;
}

export type WorkOrderStatus =
  | 'New'
  | 'Assigned'
  | 'Accepted'
  | 'In Progress'
  | 'On Hold'
  | 'Work Done'
  | 'Completed'
  | 'Pending Approval'
  | 'Closed'
  | 'Cancelled';

export type PriorityLevel = 'Emergency' | 'High' | 'Medium' | 'Low';

export interface WorkOrder {
  id: string;
  wo_number: string;
  reported_by?: string;
  reported_by_name?: string;
  reported_by_phone?: string;
  building_id: string;
  floor_id: string;
  location_id: string;
  asset_id?: string;
  category_id: string;
  subcategory_id?: string;
  priority: PriorityLevel;
  problem_description: string;
  status: WorkOrderStatus;
  assigned_supervisor_id?: string;
  assigned_technician_id?: string;
  target_completion_at?: string;
  response_due_at?: string;
  resolution_due_at?: string;
  is_overdue: boolean;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  approved_at?: string;
  closed_at?: string;
  start_gps?: { lat: number; lng: number; accuracy?: number };
  completion_gps?: { lat: number; lng: number; accuracy?: number };
  response_time_minutes?: number;
  resolution_time_minutes?: number;
  work_performed?: string;
  root_cause?: string;
  action_taken?: string;
  remarks?: string;
  rejection_reason?: string;
  before_photo_url?: string;
  after_photo_url?: string;
  photos?: WorkOrderPhoto[];

  // Work-order engine (database/11_work_order_engine.sql)
  wo_type?: WorkOrderType;
  sla_priority?: SlaPriority;
  sla_policy_id?: string | null;
  job_type_id?: string | null;
  facility_id?: string | null;
  zone_id?: string | null;
  contract_id?: string | null;
  parent_wo_id?: string | null;
  source?: string;
  trade?: string | null;
  assigned_at?: string | null;
  arrived_at?: string | null;
  restoration_due_at?: string | null;
  restored_at?: string | null;
  work_done_at?: string | null;
  on_hold_since?: string | null;
  hold_reason?: string | null;
  sla_paused_minutes?: number | null;
  response_breached?: boolean;
  resolution_breached?: boolean;
  symptoms?: string | null;
  is_chargeable?: boolean;
  billing_status?: string;
  client_id?: string | null;
  quote_id?: string | null;
  invoice_id?: string | null;
  client_signoff_name?: string | null;
  client_signoff_at?: string | null;
  client_rating?: number | null;
  client_comment?: string | null;
  cancel_reason?: string | null;
  job_type?: JobType;
  checklist_id?: string | null;
  ppm_plan_id?: string | null;
  ppm_due_date?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  building?: Building;
  floor?: Floor;
  location?: Location;
  asset?: Asset;
  category?: Category;
  subcategory?: Subcategory;
  assigned_technician?: UserProfile;
  assigned_supervisor?: UserProfile;
}

export interface WorkOrderStatusHistory {
  id: string;
  work_order_id: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  comments?: string;
  created_at: string;
  changer?: UserProfile;
}

export interface WorkOrderPhoto {
  id: string;
  work_order_id: string;
  photo_type: 'before' | 'progress' | 'after';
  photo_url: string;
  caption?: string;
  uploaded_by?: string;
  created_at: string;
}

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  material_id: string;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  material?: Material;
}

export interface Material {
  id: string;
  item_code: string;
  name: string;
  category: string;
  unit: string;
  quantity_in_stock: number;
  min_stock_level: number;
  unit_cost: number;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface PPMChecklist {
  id: string;
  title: string;
  category_id: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  applies_to?: string;
  category?: Category;
  items?: PPMChecklistItem[];
}

export interface PPMChecklistItem {
  id: string;
  checklist_id: string;
  item_order: number;
  task_description: string;
  field_type: 'pass_fail' | 'yes_no' | 'numeric_reading' | 'text' | 'dropdown' | 'photo_required';
  unit_of_measure?: string;
  min_value?: number;
  max_value?: number;
  is_mandatory: boolean;
  dropdown_options?: string[];
  photo_required?: boolean;
  raise_corrective_on_fail?: boolean;
  section?: string | null;
  fail_priority?: SlaPriority;
}

export type PPMFrequency = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly' | 'Custom';

export interface PPMPlan {
  id: string;
  ppm_code: string;
  title: string;
  asset_id: string;
  building_id: string;
  location_id: string;
  category_id: string;
  checklist_id: string;
  frequency: PPMFrequency;
  custom_interval_days?: number;
  start_date: string;
  next_due_date: string;
  assigned_technician_id?: string;
  assigned_supervisor_id?: string;
  is_active: boolean;
  created_at: string;
  asset?: Asset;
  building?: Building;
  location?: Location;
  category?: Category;
  checklist?: PPMChecklist;
  assigned_technician?: UserProfile;
}

export interface PPMSchedule {
  id: string;
  schedule_number: string;
  ppm_plan_id: string;
  due_date: string;
  status: 'Scheduled' | 'Assigned' | 'In Progress' | 'Completed' | 'Pending Approval' | 'Closed' | 'Overdue' | 'Cancelled';
  assigned_technician_id?: string;
  assigned_supervisor_id?: string;
  started_at?: string;
  completed_at?: string;
  approved_at?: string;
  remarks?: string;
  is_overdue: boolean;
  created_at: string;
  plan?: PPMPlan;
  assigned_technician?: UserProfile;
}

export interface PPMChecklistResponse {
  id: string;
  ppm_schedule_id: string;
  checklist_item_id: string;
  result_status?: 'Pass' | 'Fail' | 'N/A' | 'Yes' | 'No';
  numeric_value?: number;
  text_response?: string;
  remarks?: string;
  photo_url?: string;
  created_at: string;
  item?: PPMChecklistItem;
}

export interface Signature {
  id: string;
  entity_type: 'work_order' | 'ppm_schedule';
  entity_id: string;
  signature_type: 'technician' | 'supervisor' | 'client';
  signer_name: string;
  signature_data_url: string;
  signed_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  action: string;
  module: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  created_at: string;
}

export interface SystemSettings {
  id: number;
  company_name: string;
  company_logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  currency: string;
  wo_prefix: string;
  ppm_prefix: string;
  timezone: string;
  notification_settings: {
    email_enabled: boolean;
    push_enabled: boolean;
    sms_enabled: boolean;
  };
  // Costing defaults (database/14_job_costing.sql)
  material_markup_pct?: number;
  subcontract_markup_pct?: number;
  bill_travel?: boolean;
  work_day_start?: string;
  work_day_end?: string;
  /** ISO weekdays, 1 = Monday ... 7 = Sunday */
  weekend_days?: number[];
  vat_enabled?: boolean;
  vat_rate?: number;
  company_trn?: string | null;
  invoice_prefix?: string;
  quote_prefix?: string;
  payment_terms_days?: number;
  bank_details?: string | null;
  company_address?: string | null;
  updated_at: string;
}

export interface DashboardStats {
  totalWorkOrders: number;
  openWorkOrders: number;
  inProgressWorkOrders: number;
  overdueWorkOrders: number;
  completedWorkOrders: number;
  todayPPM: number;
  overduePPM: number;
  totalAssets: number;
  slaComplianceRate: number;
  avgResolutionHours: number;
}

export type WorkOrderType = 'Reactive' | 'On-call' | 'PPM' | 'Corrective' | 'Quoted';
export type SlaPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface ServiceGroup {
  id: string;
  code: string;
  name: string;
  sort_order?: number;
}

export interface ServiceType {
  id: string;
  group_id: string;
  code: string;
  name: string;
  trade_code?: string | null;
  category_id?: string | null;
  sort_order?: number;
}

export interface JobType {
  id: string;
  service_type_id: string;
  code: string;
  name: string;
  name_ar?: string | null;
  default_priority: SlaPriority;
  checklist_id?: string | null;
  est_hours?: number | null;
  is_active?: boolean;
}

export interface SlaPolicy {
  id: string;
  contract_id?: string | null;
  priority: SlaPriority;
  name: string;
  response_minutes: number;
  restoration_minutes?: number | null;
  resolution_minutes: number;
  color_hex?: string | null;
}

export interface TimeLogEntry {
  id: string;
  work_order_id: string;
  technician_id?: string | null;
  technician_name?: string | null;
  record_type: 'Travel' | 'Labour';
  started_at?: string | null;
  ended_at?: string | null;
  hours: number;
  is_manual?: boolean;
  note?: string | null;
  created_at?: string;
  // Costing (priced from the rate card by the database)
  trade_code?: string | null;
  grade?: string | null;
  rate_type?: RateType;
  cost_rate?: number;
  sell_rate?: number;
  cost_amount?: number;
  sell_amount?: number;
  rate_locked?: boolean;
}

export type RateType = 'Normal' | 'Overtime' | 'Holiday';

export interface LabourRate {
  id: string;
  contract_id?: string | null;
  trade_code?: string | null;
  grade: string;
  rate_type: RateType;
  cost_rate: number;
  sell_rate: number;
  effective_from?: string | null;
}

export interface JobMaterial {
  id: string;
  work_order_id: string;
  source: 'Store' | 'Direct Purchase';
  material_id?: string | null;
  description?: string | null;
  unit?: string | null;
  quantity_used: number;
  unit_cost: number;
  total_cost?: number;
  markup_pct?: number | null;
  sell_amount?: number;
  supplier?: string | null;
  supplier_invoice_ref?: string | null;
  added_by?: string | null;
  created_at?: string;
}

export interface SubcontractLine {
  id: string;
  work_order_id: string;
  subcontractor: string;
  description?: string | null;
  po_number?: string | null;
  supplier_invoice_ref?: string | null;
  cost_amount: number;
  markup_pct?: number | null;
  sell_amount?: number;
  created_at?: string;
}

export interface JobCosting {
  work_order_id: string;
  labour_cost: number;
  labour_sell: number;
  material_cost: number;
  material_sell: number;
  subcontract_cost: number;
  subcontract_sell: number;
  callout_fee: number;
  minimum_charge: number;
  markup_pct: number;
  discount: number;
  total_cost: number;
  total_sell: number;
  notes?: string | null;
  updated_at?: string;
}

export interface PublicHoliday {
  id: string;
  holiday_date: string;
  name: string;
  calendar_id?: string | null;
}

export interface StatusHistoryEntry {
  id: string;
  work_order_id: string;
  from_status?: string | null;
  to_status: string;
  changed_by?: string | null;
  comments?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Billing (database/15_billing.sql)
// ---------------------------------------------------------------------------
export interface Client {
  id: string;
  code: string;
  name: string;
  trn?: string | null;
  billing_address?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface Contract {
  id: string;
  client_id: string;
  code: string;
  name: string;
  contract_type?: string;
  start_date?: string | null;
  end_date?: string | null;
  default_markup_pct?: number | null;
  callout_fee?: number | null;
  status?: string;
  created_at?: string;
}

export type BillingLineType = 'Labour' | 'Material' | 'Subcontract' | 'Call-out' | 'Minimum Charge' | 'Other';

export interface BillingLine {
  id: string;
  invoice_id?: string | null;
  quote_id?: string | null;
  work_order_id?: string | null;
  line_type: BillingLineType;
  description: string;
  quantity: number;
  unit_price: number;
  amount?: number;
  sort_order?: number;
}

export type InvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Cancelled';

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id?: string | null;
  contract_id?: string | null;
  status: InvoiceStatus;
  issue_date?: string | null;
  due_date?: string | null;
  issued_at?: string | null;
  paid_at?: string | null;
  payment_ref?: string | null;
  client_po_number?: string | null;
  cancel_reason?: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency?: string;
  notes?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Rejected' | 'Expired';

export interface Quote {
  id: string;
  quote_number: string;
  client_id?: string | null;
  contract_id?: string | null;
  facility_id?: string | null;
  work_order_id?: string | null;
  title: string;
  description?: string | null;
  status: QuoteStatus;
  valid_until?: string | null;
  client_po_number?: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  notes?: string | null;
  sent_at?: string | null;
  approved_at?: string | null;
  created_by?: string | null;
  created_at?: string;
}
