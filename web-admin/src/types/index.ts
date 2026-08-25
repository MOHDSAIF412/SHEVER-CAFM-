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
  is_active: boolean;
  permissions?: UserPermissions;
  last_login_at?: string;
  created_at: string;
}

export interface Building {
  id: string;
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
