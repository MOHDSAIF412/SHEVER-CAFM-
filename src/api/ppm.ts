import { supabase, isSupabaseConfigured, cafmDataService, cloudRead, cloudWrite, newId, loadStore, saveStore } from './supabase';
import { Hierarchy } from './hierarchy';
import { SlaPriority, WorkOrder } from '../types';

/**
 * PPM plans and the PPM jobs they generate.
 *
 * In the cloud, cafm_generate_ppm_jobs() (database/13_ppm_scheduling.sql)
 * creates the jobs every morning and on demand. Offline demo mode runs the
 * same rules here.
 */

export const FREQUENCIES = ['Weekly', 'Fortnightly', 'Monthly', 'Bi-Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Custom'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface PpmPlan {
  id: string;
  ppm_code: string;
  title: string;
  asset_id?: string | null;
  location_id?: string | null;
  building_id?: string | null;
  floor_id?: string | null;
  facility_id?: string | null;
  category_id?: string | null;
  checklist_id?: string | null;
  frequency: Frequency;
  custom_interval_days?: number | null;
  start_date: string;
  next_due_date: string;
  end_date?: string | null;
  lead_days?: number;
  sla_priority?: SlaPriority;
  est_hours?: number | null;
  assigned_technician_id?: string | null;
  assigned_supervisor_id?: string | null;
  is_active?: boolean;
  notes?: string | null;
  last_generated_at?: string | null;
  created_at?: string;
}

const KEY = 'shever_ppm_plans';
const DAY = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);

/** Same rule as cafm_ppm_next() in the database. */
export const nextDue = (date: string, freq: Frequency, customDays?: number | null): string => {
  const d = parse(date);
  const addMonths = (m: number) => {
    const day = d.getUTCDate();
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(day, last)); // 31 Jan + 1 month = 28/29 Feb, like Postgres
    return iso(t);
  };
  switch (freq) {
    case 'Weekly': return iso(new Date(d.getTime() + 7 * DAY));
    case 'Fortnightly': return iso(new Date(d.getTime() + 14 * DAY));
    case 'Monthly': return addMonths(1);
    case 'Bi-Monthly': return addMonths(2);
    case 'Quarterly': return addMonths(3);
    case 'Half-Yearly': return addMonths(6);
    case 'Yearly': return addMonths(12);
    default: return iso(new Date(d.getTime() + Math.max(customDays || 30, 1) * DAY));
  }
};

/** Every visit date of a plan between two dates (for the yearly planner). */
export const visitsBetween = (plan: PpmPlan, from: string, to: string): string[] => {
  const out: string[] = [];
  let d = plan.start_date;
  let guard = 0;
  while (d <= to && guard++ < 800) {
    if (plan.end_date && d > plan.end_date) break;
    if (d >= from) out.push(d);
    d = nextDue(d, plan.frequency, plan.custom_interval_days);
  }
  return out;
};

export const visitsPerYear: Record<Frequency, number | null> = {
  Weekly: 52, Fortnightly: 26, Monthly: 12, 'Bi-Monthly': 6, Quarterly: 4, 'Half-Yearly': 2, Yearly: 1, Custom: null,
};

const today = () => {
  // UAE date, like the database.
  return iso(new Date(Date.now() + 4 * 3600_000));
};

export const ppmService = {
  async plans(): Promise<PpmPlan[]> {
    const rows = await cloudRead<PpmPlan>('ppm_plans', (q) => q.order('ppm_code'), KEY);
    return rows || loadStore<PpmPlan[]>(KEY, []);
  },

  /** Next free PPM-0001 style code. */
  nextCode(existing: PpmPlan[], n = 0): string {
    const max = existing.reduce((m, p) => Math.max(m, Number(/(\d+)$/.exec(p.ppm_code)?.[1] || 0)), 0);
    return `PPM-${String(max + 1 + n).padStart(4, '0')}`;
  },

  /** Create or update; several at once for "same plan on many assets". */
  async save(plans: PpmPlan[]): Promise<void> {
    const rows = plans.map((p) => ({ ...p, updated_at: new Date().toISOString() }));
    if (!isSupabaseConfigured()) {
      const byId = new Map(loadStore<PpmPlan[]>(KEY, []).map((p) => [p.id, p]));
      rows.forEach((r) => byId.set(r.id, { ...byId.get(r.id), ...r }));
      saveStore(KEY, [...byId.values()]);
      return;
    }
    await cloudWrite(plans.length > 1 ? `Saving ${plans.length} PPM plans` : 'Saving PPM plan', () =>
      supabase.from('ppm_plans').upsert(rows, { onConflict: 'id', defaultToNull: false })
    );
  },

  async remove(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      saveStore(KEY, loadStore<PpmPlan[]>(KEY, []).filter((p) => p.id !== id));
      return;
    }
    await cloudWrite('Deleting PPM plan', () => supabase.from('ppm_plans').delete().eq('id', id));
  },

  blank(): PpmPlan {
    const t = today();
    return {
      id: newId(), ppm_code: '', title: '', frequency: 'Monthly', start_date: t, next_due_date: t,
      lead_days: 7, sla_priority: 'P4', is_active: true,
    };
  },

  /** Create the PPM jobs now due. Returns how many were created. */
  async generate(h: Hierarchy, planId?: string): Promise<number> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.rpc('cafm_generate_ppm_jobs', { p_plan_id: planId ?? null });
      if (error) throw new Error(`Generating PPM jobs failed: ${error.message}`);
      return Number(data) || 0;
    }
    return generateOffline(h, planId);
  },

  /** All PPM work orders (generated or created by hand). */
  async jobs(): Promise<WorkOrder[]> {
    const all = await cafmDataService.getWorkOrders();
    return all.filter((w) => w.wo_type === 'PPM');
  },
};

/** Offline demo: the database generator's rules, run in the browser. */
const generateOffline = async (h: Hierarchy, planId?: string): Promise<number> => {
  const plans = loadStore<PpmPlan[]>(KEY, []);
  const existing = await cafmDataService.getWorkOrders();
  const t = today();
  const horizon = (lead: number) => iso(new Date(parse(t).getTime() + lead * DAY));
  const weekAgo = iso(new Date(parse(t).getTime() - 7 * DAY));
  let created = 0;

  for (const p of plans) {
    if (p.is_active === false || (planId && p.id !== planId)) continue;
    const asset = h.assets.find((a) => a.id === p.asset_id);
    const room = h.rooms.find((r) => r.id === (p.location_id || asset?.location_id));
    const floor = room && h.floors.find((f) => f.id === room.floor_id);
    const building = floor && h.buildings.find((b) => b.id === floor.building_id);
    if (!room || !floor || !building) continue;

    let due = p.next_due_date;
    let guard = 0;
    while (due <= horizon(p.lead_days ?? 7) && (!p.end_date || due <= p.end_date) && guard++ < 400) {
      const dup = existing.some((w) => w.ppm_plan_id === p.id && w.ppm_due_date === due);
      if (due >= weekAgo && !dup) {
        await cafmDataService.createWorkOrder({
          wo_number: `${p.ppm_code}-${due.slice(2).replace(/-/g, '')}`,
          wo_type: 'PPM',
          source: 'PPM',
          ppm_plan_id: p.id,
          ppm_due_date: due,
          checklist_id: p.checklist_id || null,
          problem_description: `${p.title} — ${p.frequency} PPM due ${new Date(`${due}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
          sla_priority: p.sla_priority || 'P4',
          priority: 'Low',
          asset_id: p.asset_id || undefined,
          location_id: room.id,
          floor_id: floor.id,
          building_id: building.id,
          zone_id: room.zone_id || null,
          facility_id: building.facility_id || null,
          category_id: p.category_id || asset?.category_id || '',
          assigned_technician_id: p.assigned_technician_id || undefined,
          assigned_at: p.assigned_technician_id ? new Date().toISOString() : null,
          reported_by_name: 'PPM scheduler',
          response_due_at: new Date(`${due}T07:00:00+04:00`).toISOString(),
          resolution_due_at: new Date(`${due}T23:59:00+04:00`).toISOString(),
        } as Partial<WorkOrder>);
        created++;
      }
      due = nextDue(due, p.frequency, p.custom_interval_days);
    }
    p.next_due_date = due;
    p.last_generated_at = new Date().toISOString();
  }
  saveStore(KEY, plans);
  return created;
};

// ---------------------------------------------------------------------------
// Visit status (planner + compliance)
// ---------------------------------------------------------------------------
export type VisitState = 'planned' | 'open' | 'overdue' | 'on_time' | 'late' | 'cancelled';

export const VISIT_META: Record<VisitState, { label: string; cls: string }> = {
  planned: { label: 'Planned (job not created yet)', cls: 'border border-dashed border-slate-300 text-slate-500 dark:border-slate-600' },
  open: { label: 'Job open', cls: 'bg-teal-600 text-white' },
  overdue: { label: 'Overdue', cls: 'bg-ocs-red text-white' },
  on_time: { label: 'Done on time', cls: 'bg-emerald-500 text-white' },
  late: { label: 'Done late', cls: 'bg-orange-500 text-white' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-300 text-slate-600 line-through dark:bg-slate-700 dark:text-slate-300' },
};

/** Where a PPM visit stands. A visit is done once the technician marks work done. */
export const visitState = (dueDate: string, job?: WorkOrder): VisitState => {
  const todayStr = today();
  if (!job) return dueDate < todayStr ? 'overdue' : 'planned';
  if (job.status === 'Cancelled') return 'cancelled';
  const doneAt = job.work_done_at || job.completed_at || job.closed_at;
  if (doneAt) {
    // Due by the end of the due day (UAE).
    const deadline = job.resolution_due_at ? new Date(job.resolution_due_at) : new Date(`${dueDate}T23:59:00+04:00`);
    return new Date(doneAt) <= deadline ? 'on_time' : 'late';
  }
  return dueDate < todayStr ? 'overdue' : 'open';
};
