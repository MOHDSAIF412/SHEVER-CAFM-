import * as XLSX from 'xlsx';
import { WorkOrder, PPMSchedule, Asset } from '../types';

export const exportWorkOrdersToExcel = (workOrders: WorkOrder[], filename = 'WorkOrders_Report.xlsx') => {
  const formattedData = workOrders.map((wo) => ({
    'WO Number': wo.wo_number,
    Date: new Date(wo.created_at).toLocaleDateString(),
    Building: wo.building?.name || 'N/A',
    Location: wo.location?.name || 'N/A',
    Asset: wo.asset?.asset_number ? `${wo.asset.asset_number} - ${wo.asset.name}` : 'N/A',
    Category: wo.category?.name || 'N/A',
    Priority: wo.priority,
    Status: wo.status,
    'Reported By': wo.reported_by_name || 'N/A',
    Technician: wo.assigned_technician?.full_name || 'Unassigned',
    'Response (Min)': wo.response_time_minutes || '-',
    'Resolution (Min)': wo.resolution_time_minutes || '-',
    'Is Overdue': wo.is_overdue ? 'YES' : 'NO',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Work Orders');
  XLSX.writeFile(workbook, filename);
};

export const exportAssetsToExcel = (assets: Asset[], filename = 'Assets_Registry.xlsx') => {
  const formattedData = assets.map((a) => ({
    'Asset Number': a.asset_number,
    'Asset Name': a.name,
    Type: a.type || 'N/A',
    Category: a.category?.name || 'N/A',
    Manufacturer: a.manufacturer || 'N/A',
    Model: a.model || 'N/A',
    'Serial Number': a.serial_number || 'N/A',
    Building: a.building?.name || 'N/A',
    Location: a.location?.name || 'N/A',
    Status: a.status,
    Criticality: a.criticality,
    'Installation Date': a.installation_date || 'N/A',
    'Warranty Expiry': a.warranty_expiry || 'N/A',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
  XLSX.writeFile(workbook, filename);
};

export const exportPPMToExcel = (schedules: PPMSchedule[], filename = 'PPM_Schedules.xlsx') => {
  const formattedData = schedules.map((s) => ({
    'Schedule Number': s.schedule_number,
    'Plan Code': s.plan?.ppm_code || 'N/A',
    'Task Title': s.plan?.title || 'N/A',
    Asset: s.plan?.asset?.name || 'N/A',
    Frequency: s.plan?.frequency || 'N/A',
    'Due Date': s.due_date,
    Technician: s.assigned_technician?.full_name || 'Unassigned',
    Status: s.status,
    'Is Overdue': s.is_overdue ? 'YES' : 'NO',
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PPM Schedules');
  XLSX.writeFile(workbook, filename);
};
