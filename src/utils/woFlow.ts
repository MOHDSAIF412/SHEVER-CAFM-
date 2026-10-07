import { SlaPriority, UserRole, WorkOrder, WorkOrderStatus, WorkOrderType } from '../types';

/**
 * The work-order lifecycle in one place: labels, colours, the main path, and
 * which action each role sees next. Screens read from here so the flow can
 * never drift between the list, the detail page and the dashboard.
 *
 *   New -> Assigned -> In Progress -> Work Done -> Completed -> Closed
 *   On Hold pauses the SLA (from Assigned / In Progress). Cancelled exits.
 */
export const FLOW: WorkOrderStatus[] = ['New', 'Assigned', 'In Progress', 'Work Done', 'Completed', 'Closed'];

/** Older rows still carry the previous statuses; show them as their new step. */
export const normaliseStatus = (s: WorkOrderStatus): WorkOrderStatus =>
  s === 'Accepted' ? 'Assigned' : s === 'Pending Approval' ? 'Work Done' : s;

export const STATUS_META: Record<string, { label: string; hint: string; pill: string; dot: string }> = {
  New: { label: 'New', hint: 'Logged, waiting to be assigned', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', dot: 'bg-slate-400' },
  Assigned: { label: 'Assigned', hint: 'Technician assigned, not started', pill: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300', dot: 'bg-teal-500' },
  'In Progress': { label: 'In Progress', hint: 'Technician travelling or working', pill: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', dot: 'bg-orange-500' },
  'On Hold': { label: 'On Hold', hint: 'Paused — SLA clock stopped', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', dot: 'bg-sky-400' },
  'Work Done': { label: 'Work Done', hint: 'Technician finished, waiting for verification', pill: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', dot: 'bg-violet-500' },
  Completed: { label: 'Completed', hint: 'Verified and signed off', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', dot: 'bg-emerald-500' },
  Closed: { label: 'Closed', hint: 'Finished and archived', pill: 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900', dot: 'bg-slate-700' },
  Cancelled: { label: 'Cancelled', hint: 'Cancelled', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', dot: 'bg-rose-500' },
};

export const statusMeta = (s: WorkOrderStatus) => STATUS_META[normaliseStatus(s)] || STATUS_META.New;

/** Open = still needs work (counts toward "my jobs" and SLA risk). */
export const isOpen = (s: WorkOrderStatus) => ['New', 'Assigned', 'In Progress', 'On Hold'].includes(normaliseStatus(s));

export const PRIORITY_META: Record<SlaPriority, { label: string; name: string; chip: string; ring: string }> = {
  P1: { label: 'P1', name: 'Emergency', chip: 'bg-ocs-red text-white', ring: 'ring-ocs-red' },
  P2: { label: 'P2', name: 'Urgent', chip: 'bg-orange-500 text-white', ring: 'ring-orange-500' },
  P3: { label: 'P3', name: 'Normal', chip: 'bg-teal-600 text-white', ring: 'ring-teal-600' },
  P4: { label: 'P4', name: 'Planned', chip: 'bg-slate-400 text-white', ring: 'ring-slate-400' },
};

/** Map the legacy Emergency/High/Medium/Low onto P1-P4 for rows created before step 5. */
export const priorityOf = (wo: Pick<WorkOrder, 'sla_priority' | 'priority'>): SlaPriority =>
  wo.sla_priority ||
  ({ Emergency: 'P1', High: 'P2', Medium: 'P3', Low: 'P4' } as Record<string, SlaPriority>)[wo.priority] ||
  'P3';

export const LEGACY_PRIORITY: Record<SlaPriority, WorkOrder['priority']> = {
  P1: 'Emergency',
  P2: 'High',
  P3: 'Medium',
  P4: 'Low',
};

export const WO_TYPES: { id: WorkOrderType; label: string; hint: string; chargeable: boolean }[] = [
  { id: 'Reactive', label: 'Reactive', hint: 'Breakdown or complaint, covered by the contract', chargeable: false },
  { id: 'On-call', label: 'On-call', hint: 'After-hours call-out — billed to the client', chargeable: true },
  { id: 'Corrective', label: 'Corrective', hint: 'Fix found during a PPM or inspection', chargeable: false },
  { id: 'Quoted', label: 'Quoted works', hint: 'Extra work on an approved quote — billed', chargeable: true },
  { id: 'PPM', label: 'PPM', hint: 'Planned preventive maintenance visit', chargeable: false },
];

export const HOLD_REASONS = ['Awaiting Parts', 'Awaiting Access', 'Awaiting Client Approval', 'Other'] as const;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ActionId = 'assign' | 'start' | 'arrive' | 'hold' | 'resume' | 'work_done' | 'send_back' | 'complete' | 'close' | 'cancel' | 'reopen';

export interface FlowAction {
  id: ActionId;
  label: string;
  /** Main button vs. secondary menu. */
  primary: boolean;
  tone: 'brand' | 'accent' | 'success' | 'neutral' | 'danger';
}

const ACT: Record<ActionId, FlowAction> = {
  assign: { id: 'assign', label: 'Assign technician', primary: true, tone: 'brand' },
  start: { id: 'start', label: 'Start job', primary: true, tone: 'accent' },
  arrive: { id: 'arrive', label: 'Arrived on site', primary: true, tone: 'accent' },
  hold: { id: 'hold', label: 'Put on hold', primary: false, tone: 'neutral' },
  resume: { id: 'resume', label: 'Resume job', primary: true, tone: 'accent' },
  work_done: { id: 'work_done', label: 'Mark work done', primary: true, tone: 'success' },
  send_back: { id: 'send_back', label: 'Send back to technician', primary: false, tone: 'neutral' },
  complete: { id: 'complete', label: 'Verify & complete', primary: true, tone: 'success' },
  close: { id: 'close', label: 'Close job', primary: true, tone: 'brand' },
  cancel: { id: 'cancel', label: 'Cancel job', primary: false, tone: 'danger' },
  reopen: { id: 'reopen', label: 'Reopen', primary: false, tone: 'neutral' },
};

/**
 * What this user can do next on this job. Technicians drive the field steps on
 * their own jobs; supervisors and managers assign, verify and close.
 */
export const actionsFor = (wo: WorkOrder, role: UserRole | null, userId?: string): FlowAction[] => {
  const s = normaliseStatus(wo.status);
  const lead = role === 'admin' || role === 'fm_manager' || role === 'supervisor';
  const manager = role === 'admin' || role === 'fm_manager';
  const mine = !!userId && wo.assigned_technician_id === userId;
  const field = lead || mine;
  const out: FlowAction[] = [];

  if (s === 'New' && lead) out.push(ACT.assign);
  if (s === 'Assigned' && field) out.push(ACT.start);
  if (s === 'In Progress' && field) out.push(wo.arrived_at ? ACT.work_done : ACT.arrive);
  if (s === 'In Progress' && field && !wo.arrived_at) out.push({ ...ACT.work_done, primary: false });
  if ((s === 'Assigned' || s === 'In Progress') && field) out.push(ACT.hold);
  if (s === 'On Hold' && field) out.push(ACT.resume);
  if (s === 'Work Done' && lead) out.push(ACT.complete, ACT.send_back);
  // Chargeable jobs close themselves when their invoice is paid.
  const billable = !!wo.is_chargeable && !['Paid', 'Written Off'].includes(wo.billing_status || '');
  if (s === 'Completed' && manager && !billable) out.push(ACT.close);
  if (['New', 'Assigned', 'On Hold'].includes(s) && lead) out.push(ACT.cancel);
  if ((s === 'Closed' || s === 'Cancelled' || s === 'Completed') && manager) out.push(ACT.reopen);
  return out;
};
