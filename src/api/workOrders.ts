import { supabase, isSupabaseConfigured, cafmDataService, cloudRead, cloudWrite, newId, loadStore, saveStore } from './supabase';
import {
  JobType, ServiceGroup, ServiceType, SlaPolicy, StatusHistoryEntry, TimeLogEntry, WorkOrder, WorkOrderPhoto, WorkOrderStatus,
} from '../types';
import { ActionId, LEGACY_PRIORITY, normaliseStatus } from '../utils/woFlow';

/**
 * Work-order engine: service matrix, SLA policies, lifecycle transitions and
 * the travel/labour time log.
 *
 * In the cloud the database does the bookkeeping (timestamps, SLA pause on
 * hold, breach flags, status history — see database/11_work_order_engine.sql).
 * Offline demo mode mirrors the essentials here so the screens still work.
 */

// ---------------------------------------------------------------------------
// Reference data (with an offline copy of the starter catalogue)
// ---------------------------------------------------------------------------

const OFFLINE_GROUPS: ServiceGroup[] = [
  { id: 'sg-hard', code: 'HARD', name: 'Hard Services', sort_order: 1 },
  { id: 'sg-soft', code: 'SOFT', name: 'Soft Services', sort_order: 2 },
];
const OFFLINE_TYPES: ServiceType[] = [
  ['st-hvac', 'sg-hard', 'HVAC', 'HVAC', 'HVAC'], ['st-elec', 'sg-hard', 'ELEC', 'Electrical', 'ELEC'],
  ['st-plmb', 'sg-hard', 'PLMB', 'Plumbing', 'PLMB'], ['st-civil', 'sg-hard', 'CIVIL', 'Civil & Joinery', 'CIVIL'],
  ['st-fls', 'sg-hard', 'FLS', 'Fire & Life Safety', 'FLS'], ['st-clean', 'sg-soft', 'CLEAN', 'Cleaning', 'GEN'],
  ['st-pest', 'sg-soft', 'PEST', 'Pest Control', 'GEN'], ['st-land', 'sg-soft', 'LAND', 'Landscaping', 'GEN'],
].map(([id, group_id, code, name, trade_code], i) => ({ id, group_id, code, name, trade_code, sort_order: i }));
const OFFLINE_JOBS: JobType[] = (
  [
    ['jt-hvac-nocool', 'st-hvac', 'AC not cooling', 'P2'], ['jt-hvac-leak', 'st-hvac', 'AC water leaking', 'P2'],
    ['jt-hvac-noise', 'st-hvac', 'AC noise / vibration', 'P3'], ['jt-elec-power', 'st-elec', 'Total power failure', 'P1'],
    ['jt-elec-trip', 'st-elec', 'Breaker tripping', 'P2'], ['jt-elec-light', 'st-elec', 'Lights not working', 'P3'],
    ['jt-plmb-leak', 'st-plmb', 'Water leak', 'P1'], ['jt-plmb-block', 'st-plmb', 'Drain / toilet blocked', 'P2'],
    ['jt-civil-door', 'st-civil', 'Door / lock faulty', 'P3'], ['jt-fls-alarm', 'st-fls', 'Fire alarm fault', 'P1'],
    ['jt-clean-spill', 'st-clean', 'Spillage cleaning', 'P2'], ['jt-pest-insect', 'st-pest', 'Insects sighted', 'P3'],
  ] as const
).map(([id, service_type_id, name, default_priority]) => ({ id, service_type_id, code: id.toUpperCase(), name, default_priority }));
const OFFLINE_SLA: SlaPolicy[] = [
  { id: 'sla-default-p1', priority: 'P1', name: 'Emergency', response_minutes: 60, restoration_minutes: 120, resolution_minutes: 240 },
  { id: 'sla-default-p2', priority: 'P2', name: 'Urgent', response_minutes: 240, restoration_minutes: 480, resolution_minutes: 1440 },
  { id: 'sla-default-p3', priority: 'P3', name: 'Normal', response_minutes: 1440, restoration_minutes: 1440, resolution_minutes: 4320 },
  { id: 'sla-default-p4', priority: 'P4', name: 'Planned', response_minutes: 2880, restoration_minutes: null, resolution_minutes: 7200 },
];

export interface ServiceMatrix {
  groups: ServiceGroup[];
  types: ServiceType[];
  jobs: JobType[];
}

const PHOTO_SELECT = 'id, work_order_id, photo_type, photo_url, caption, created_at';

export const workOrderService = {
  async serviceMatrix(): Promise<ServiceMatrix> {
    const [groups, types, jobs] = await Promise.all([
      cloudRead<ServiceGroup>('service_groups', (q) => q.order('sort_order'), 'shever_service_groups'),
      cloudRead<ServiceType>('service_types', (q) => q.order('sort_order'), 'shever_service_types'),
      cloudRead<JobType>('job_types', (q) => q.eq('is_active', true).order('name'), 'shever_job_types'),
    ]);
    return { groups: groups || OFFLINE_GROUPS, types: types || OFFLINE_TYPES, jobs: jobs || OFFLINE_JOBS };
  },

  /** Default policies plus any contract-specific overrides. */
  async slaPolicies(): Promise<SlaPolicy[]> {
    const rows = await cloudRead<SlaPolicy>('sla_policies', (q) => q.order('priority'), 'shever_sla_policies');
    return rows || OFFLINE_SLA;
  },

  policyFor(policies: SlaPolicy[], priority: string, contractId?: string | null): SlaPolicy | undefined {
    return (
      policies.find((p) => p.priority === priority && contractId && p.contract_id === contractId) ||
      policies.find((p) => p.priority === priority && !p.contract_id)
    );
  },

  async create(data: Partial<WorkOrder>, policies: SlaPolicy[]): Promise<WorkOrder> {
    const priority = data.sla_priority || 'P3';
    const payload: Partial<WorkOrder> = {
      ...data,
      priority: LEGACY_PRIORITY[priority],
      status: data.assigned_technician_id ? 'Assigned' : 'New',
      assigned_at: data.assigned_technician_id ? new Date().toISOString() : null,
    };
    if (!isSupabaseConfigured()) {
      // Offline: the database trigger is not there to set the deadlines.
      const p = this.policyFor(policies, priority, data.contract_id);
      const at = (m?: number | null) => (m ? new Date(Date.now() + m * 60000).toISOString() : null);
      Object.assign(payload, {
        response_due_at: at(p?.response_minutes),
        restoration_due_at: at(p?.restoration_minutes),
        resolution_due_at: at(p?.resolution_minutes),
        sla_policy_id: p?.id,
      });
    }
    return cafmDataService.createWorkOrder(payload);
  },

  /**
   * Move a job along its lifecycle. `extra` carries what the step needs
   * (technician, hold reason, work notes, client sign-off...).
   */
  async act(wo: WorkOrder, action: ActionId, extra: Partial<WorkOrder> = {}, user?: { id: string; full_name: string }): Promise<WorkOrder> {
    const now = new Date().toISOString();
    const to: Record<ActionId, WorkOrderStatus | null> = {
      assign: normaliseStatus(wo.status) === 'New' ? 'Assigned' : null,
      start: 'In Progress',
      arrive: null,
      hold: 'On Hold',
      resume: 'In Progress',
      work_done: 'Work Done',
      send_back: 'In Progress',
      complete: 'Completed',
      close: 'Closed',
      cancel: 'Cancelled',
      reopen: 'In Progress',
    };
    if (action === 'close' && wo.is_chargeable && !['Paid', 'Written Off'].includes(wo.billing_status || '')) {
      throw new Error('This is a chargeable job: it closes automatically when its invoice is paid.');
    }
    const patch: Partial<WorkOrder> = { ...extra };
    const next = to[action];
    if (next) patch.status = next;

    // Field clock: travel starts with the job, labour starts on arrival.
    const techId = wo.assigned_technician_id || user?.id;
    const techName = wo.assigned_technician?.full_name || user?.full_name;
    if (action === 'start' || (action === 'resume' && !wo.arrived_at)) {
      await this.startClock(wo.id, 'Travel', techId, techName);
    }
    if (action === 'arrive') {
      patch.arrived_at = now;
      await this.stopClocks(wo.id);
      await this.startClock(wo.id, 'Labour', techId, techName);
    }
    if (action === 'resume' && wo.arrived_at) await this.startClock(wo.id, 'Labour', techId, techName);
    if (action === 'hold' || action === 'work_done' || action === 'cancel') await this.stopClocks(wo.id);
    if (action === 'complete') {
      patch.client_signoff_at = now;
    }
    if (action === 'reopen') {
      Object.assign(patch, { work_done_at: null, completed_at: null, closed_at: null });
    }

    if (!isSupabaseConfigured()) mirrorOffline(wo, patch, now);
    const updated = await cafmDataService.updateWorkOrder(wo.id, patch);
    if (!updated) throw new Error('Work order not found.');
    return updated;
  },

  // -------------------------------------------------------------- time log
  async timeLog(woId: string): Promise<TimeLogEntry[]> {
    if (!isSupabaseConfigured()) return loadStore<TimeLogEntry[]>(`shever_timelog_${woId}`, []);
    const { data, error } = await supabase.from('wo_labour').select('*').eq('work_order_id', woId).order('started_at', { ascending: true });
    if (error) throw new Error(`Loading time log failed: ${error.message}`);
    return (data || []) as TimeLogEntry[];
  },

  async startClock(woId: string, type: 'Travel' | 'Labour', techId?: string, techName?: string) {
    const row: Partial<TimeLogEntry> = {
      id: newId(), work_order_id: woId, record_type: type, technician_id: techId || null,
      technician_name: techName || null, started_at: new Date().toISOString(), hours: 0,
    };
    if (!isSupabaseConfigured()) {
      const key = `shever_timelog_${woId}`;
      saveStore(key, [...loadStore<TimeLogEntry[]>(key, []), row as TimeLogEntry]);
      return;
    }
    await cloudWrite(`Starting ${type.toLowerCase()} timer`, () => supabase.from('wo_labour').insert(row));
  },

  /** Close any running timer, recording its hours. */
  async stopClocks(woId: string) {
    const entries = await this.timeLog(woId);
    const now = new Date();
    for (const e of entries.filter((x) => x.started_at && !x.ended_at)) {
      const hours = Math.round(((now.getTime() - new Date(e.started_at!).getTime()) / 3_600_000) * 100) / 100;
      if (!isSupabaseConfigured()) {
        const key = `shever_timelog_${woId}`;
        saveStore(key, loadStore<TimeLogEntry[]>(key, []).map((x) => (x.id === e.id ? { ...x, ended_at: now.toISOString(), hours } : x)));
      } else {
        await cloudWrite('Stopping timer', () =>
          supabase.from('wo_labour').update({ ended_at: now.toISOString(), hours }).eq('id', e.id)
        );
      }
    }
  },

  async addManualTime(woId: string, entry: { record_type: 'Travel' | 'Labour'; hours: number; rate_type?: 'Normal' | 'Overtime' | 'Holiday'; technician_id?: string; technician_name?: string; note?: string; started_at?: string }) {
    const row = { id: newId(), work_order_id: woId, is_manual: true, ...entry };
    if (!isSupabaseConfigured()) {
      const key = `shever_timelog_${woId}`;
      saveStore(key, [...loadStore<TimeLogEntry[]>(key, []), row as TimeLogEntry]);
      return;
    }
    await cloudWrite('Adding time', () => supabase.from('wo_labour').insert(row));
  },

  // --------------------------------------------------------------- history
  async history(woId: string): Promise<StatusHistoryEntry[]> {
    if (!isSupabaseConfigured()) return loadStore<StatusHistoryEntry[]>(`shever_history_${woId}`, []);
    const { data } = await supabase
      .from('work_order_status_history')
      .select('*')
      .eq('work_order_id', woId)
      .order('created_at', { ascending: true });
    return (data || []) as StatusHistoryEntry[];
  },

  /** Photos live in their own table; attach them to the work order. */
  async photos(woId: string): Promise<WorkOrderPhoto[] | null> {
    if (!isSupabaseConfigured()) return null;
    const { data } = await supabase.from('work_order_photos').select(PHOTO_SELECT).eq('work_order_id', woId).order('created_at');
    return (data || []) as WorkOrderPhoto[];
  },
};

/** Offline demo: stamp what the database trigger would. */
const mirrorOffline = (wo: WorkOrder, patch: Partial<WorkOrder>, now: string) => {
  const s = patch.status;
  if (s === 'Assigned') patch.assigned_at = wo.assigned_at || now;
  if (s === 'In Progress') patch.started_at = wo.started_at || now;
  if (s === 'On Hold') patch.on_hold_since = now;
  if (wo.status === 'On Hold' && s && s !== 'On Hold' && wo.on_hold_since) {
    const paused = Date.now() - new Date(wo.on_hold_since).getTime();
    const shift = (d?: string | null) => (d ? new Date(new Date(d).getTime() + paused).toISOString() : d);
    if (!wo.arrived_at) patch.response_due_at = shift(wo.response_due_at) || undefined;
    if (!wo.restored_at) patch.restoration_due_at = shift(wo.restoration_due_at);
    patch.resolution_due_at = shift(wo.resolution_due_at) || undefined;
    patch.sla_paused_minutes = (wo.sla_paused_minutes || 0) + Math.round(paused / 60000);
    patch.on_hold_since = null;
  }
  if (s === 'Work Done') {
    patch.work_done_at = now;
    patch.arrived_at = wo.arrived_at || wo.started_at || now;
    patch.restored_at = wo.restored_at || now;
  }
  if (s === 'Completed') {
    patch.completed_at = now;
    if (wo.is_chargeable && (!wo.billing_status || wo.billing_status === 'Not Billable')) patch.billing_status = 'To Bill';
  }
  if (s === 'Closed') patch.closed_at = now;
  if (s) {
    const key = `shever_history_${wo.id}`;
    saveStore(key, [
      ...loadStore<StatusHistoryEntry[]>(key, []),
      { id: newId(), work_order_id: wo.id, from_status: wo.status, to_status: s, comments: patch.hold_reason || patch.cancel_reason || null, created_at: now },
    ]);
  }
};
