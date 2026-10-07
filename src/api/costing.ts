import { supabase, isSupabaseConfigured, cafmDataService, cloudRead, cloudWrite, newId, loadStore, saveStore } from './supabase';
import { workOrderService } from './workOrders';
import {
  JobCosting, JobMaterial, LabourRate, PublicHoliday, RateType, SubcontractLine, SystemSettings, TimeLogEntry, WorkOrder,
} from '../types';

/**
 * Job costing: what a job costs OCS and what the client is charged, in AED.
 *
 * In the cloud the database prices every line (database/14_job_costing.sql):
 * labour from the rate card, materials and subcontractors with their markup,
 * store issues moving stock, and wo_costing holding the totals. Offline demo
 * mode runs the same rules here so the screens behave the same.
 */

export const GRADES = ['Helper', 'Technician', 'Senior Technician', 'Supervisor', 'Engineer'] as const;
export const RATE_TYPES: RateType[] = ['Normal', 'Overtime', 'Holiday'];
export const WEEKDAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun'],
] as const;

export const aed = (n?: number | null, decimals = 2) =>
  `AED ${(Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Defaults (same starter card as the migration)
// ---------------------------------------------------------------------------
const STARTER: [string, number, number][] = [
  ['Helper', 15, 45], ['Technician', 25, 75], ['Senior Technician', 35, 95], ['Supervisor', 50, 120], ['Engineer', 80, 180],
];
const OFFLINE_TRADES = [
  ['CIVIL', 'Civil & Joinery'], ['ELEC', 'Electrical'], ['FLS', 'Fire & Life Safety'], ['GEN', 'General Maintenance'], ['HVAC', 'HVAC'], ['PLMB', 'Plumbing'],
].map(([code, name]) => ({ code, name }));
const FACTOR: Record<RateType, number> = { Normal: 1, Overtime: 1.25, Holiday: 1.5 };
const starterRates = (): LabourRate[] =>
  STARTER.flatMap(([grade, cost, sell]) =>
    RATE_TYPES.map((rate_type) => ({
      id: `rate-${grade}-${rate_type}`.toLowerCase().replace(/\s+/g, '-'),
      grade, rate_type, cost_rate: round2(cost * FACTOR[rate_type]), sell_rate: round2(sell * FACTOR[rate_type]),
      effective_from: '2020-01-01', contract_id: null, trade_code: null,
    }))
  );

export interface CostingSettings {
  material_markup_pct: number;
  subcontract_markup_pct: number;
  bill_travel: boolean;
  work_day_start: string;
  work_day_end: string;
  weekend_days: number[];
}

export const settingsOf = (s?: Partial<SystemSettings> | null): CostingSettings => ({
  material_markup_pct: Number(s?.material_markup_pct ?? 15),
  subcontract_markup_pct: Number(s?.subcontract_markup_pct ?? 10),
  bill_travel: s?.bill_travel ?? true,
  work_day_start: (s?.work_day_start || '07:00').slice(0, 5),
  work_day_end: (s?.work_day_end || '17:00').slice(0, 5),
  weekend_days: s?.weekend_days?.length ? s.weekend_days : [6, 7],
});

// ---------------------------------------------------------------------------
// Pricing rules (mirror the database functions)
// ---------------------------------------------------------------------------

/** UAE local date/time parts of an instant. */
const uae = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 4 * 3600_000);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), isoDow: d.getUTCDay() || 7 };
};

/** Same rule as cafm_rate_type_at(): holiday, then weekend / out of hours = overtime. */
export const rateTypeAt = (iso: string, s: CostingSettings, holidays: PublicHoliday[]): RateType => {
  const t = uae(iso);
  if (holidays.some((h) => h.holiday_date === t.date)) return 'Holiday';
  if (s.weekend_days.includes(t.isoDow)) return 'Overtime';
  if (t.time < s.work_day_start || t.time >= s.work_day_end) return 'Overtime';
  return 'Normal';
};

/** Most specific rate in force: contract, then trade, then company default. */
export const resolveRate = (
  rates: LabourRate[],
  q: { grade: string; rate_type: RateType; trade_code?: string | null; contract_id?: string | null; date?: string }
): LabourRate | undefined => {
  const day = (q.date || new Date().toISOString()).slice(0, 10);
  const eff = (r: LabourRate) => r.effective_from || '2000-01-01';
  return rates
    .filter((r) => r.grade === q.grade && r.rate_type === q.rate_type)
    .filter((r) => !r.contract_id || r.contract_id === q.contract_id)
    .filter((r) => !r.trade_code || r.trade_code === q.trade_code)
    .sort((a, b) =>
      Number(!!b.contract_id) - Number(!!a.contract_id) ||
      Number(!!b.trade_code) - Number(!!a.trade_code) ||
      Number(eff(b) <= day) - Number(eff(a) <= day) ||
      (eff(a) <= day ? eff(b).localeCompare(eff(a)) : eff(a).localeCompare(eff(b)))
    )[0];
};

export interface Charges {
  callout_fee: number;
  minimum_charge: number;
  markup_pct: number;
  discount: number;
  notes?: string | null;
}

/** Same formula as cafm_recalc_wo_costing(). */
export const computeTotals = (
  labour: TimeLogEntry[], materials: JobMaterial[], subs: SubcontractLine[], c: Charges, workOrderId: string
): JobCosting => {
  const sum = <T,>(xs: T[], f: (x: T) => number) => round2(xs.reduce((a, x) => a + (Number(f(x)) || 0), 0));
  const lc = sum(labour, (l) => l.cost_amount ?? (l.hours || 0) * (l.cost_rate || 0));
  const ls = sum(labour, (l) => l.sell_amount ?? (l.hours || 0) * (l.sell_rate || 0));
  const mc = sum(materials, (m) => m.total_cost ?? 0);
  const ms = sum(materials, (m) => m.sell_amount ?? m.total_cost ?? 0);
  const sc = sum(subs, (s) => s.cost_amount);
  const ss = sum(subs, (s) => s.sell_amount ?? s.cost_amount);
  const lines = (ls + ms + ss) * (1 + (c.markup_pct || 0) / 100) + (c.callout_fee || 0) - (c.discount || 0);
  return {
    work_order_id: workOrderId,
    labour_cost: lc, labour_sell: ls, material_cost: mc, material_sell: ms, subcontract_cost: sc, subcontract_sell: ss,
    callout_fee: c.callout_fee || 0, minimum_charge: c.minimum_charge || 0, markup_pct: c.markup_pct || 0, discount: c.discount || 0,
    notes: c.notes ?? null,
    total_cost: round2(lc + mc + sc),
    total_sell: round2(Math.max(lines, c.minimum_charge || 0, 0)),
  };
};

const priceMaterial = (m: JobMaterial, markup: number): JobMaterial => {
  const total_cost = round2(m.quantity_used * (m.unit_cost || 0));
  const markup_pct = m.markup_pct ?? markup;
  return { ...m, total_cost, markup_pct, sell_amount: round2(total_cost * (1 + markup_pct / 100)) };
};
const priceSub = (s: SubcontractLine, markup: number): SubcontractLine => {
  const markup_pct = s.markup_pct ?? markup;
  return { ...s, markup_pct, sell_amount: round2((s.cost_amount || 0) * (1 + markup_pct / 100)) };
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
const K = {
  rates: 'shever_labour_rates',
  holidays: 'shever_public_holidays',
  mats: (wo: string) => `shever_wo_materials_${wo}`,
  subs: (wo: string) => `shever_wo_subcontract_${wo}`,
  charges: (wo: string) => `shever_wo_charges_${wo}`,
};

export interface JobCostingData {
  labour: TimeLogEntry[];
  materials: JobMaterial[];
  subs: SubcontractLine[];
  totals: JobCosting;
  /** false when this user may not see money (technicians). */
  canSeeMoney: boolean;
}

const cloudError = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what} failed: ${error.message}`);
};

export const costingService = {
  // ------------------------------------------------------------ rate card
  async rates(): Promise<LabourRate[]> {
    const rows = await cloudRead<LabourRate>('labour_rates', (q) => q.order('grade'), K.rates);
    return rows || loadStore<LabourRate[]>(K.rates, starterRates());
  },

  async saveRates(rows: LabourRate[]): Promise<void> {
    if (!isSupabaseConfigured()) {
      const byId = new Map(loadStore<LabourRate[]>(K.rates, starterRates()).map((r) => [r.id, r]));
      rows.forEach((r) => byId.set(r.id, r));
      saveStore(K.rates, [...byId.values()]);
      return;
    }
    const clean = rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    await cloudWrite('Saving rate card', () => supabase.from('labour_rates').upsert(clean, { onConflict: 'id', defaultToNull: false }));
  },

  async deleteRate(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      saveStore(K.rates, loadStore<LabourRate[]>(K.rates, starterRates()).filter((r) => r.id !== id));
      return;
    }
    await cloudWrite('Deleting rate', () => supabase.from('labour_rates').delete().eq('id', id));
  },

  newRate(grade = 'Technician', rate_type: RateType = 'Normal'): LabourRate {
    return { id: newId(), grade, rate_type, cost_rate: 0, sell_rate: 0, trade_code: null, contract_id: null, effective_from: new Date().toISOString().slice(0, 10) };
  },

  async trades(): Promise<{ code: string; name: string }[]> {
    const rows = await cloudRead<{ code: string; name: string }>('trades', (q) => q.order('name'), 'shever_trades');
    return rows || OFFLINE_TRADES;
  },

  // ------------------------------------------------------------- settings
  async settings(): Promise<CostingSettings> {
    return settingsOf(await cafmDataService.getSystemSettings());
  },

  async saveSettings(s: CostingSettings): Promise<void> {
    await cafmDataService.updateSystemSettings(s as unknown as Partial<SystemSettings>);
  },

  async holidays(): Promise<PublicHoliday[]> {
    const rows = await cloudRead<PublicHoliday>('public_holidays', (q) => q.order('holiday_date'), K.holidays);
    return rows || loadStore<PublicHoliday[]>(K.holidays, []);
  },

  async addHoliday(h: Omit<PublicHoliday, 'id'>): Promise<void> {
    const row = { id: newId(), ...h };
    if (!isSupabaseConfigured()) {
      saveStore(K.holidays, [...loadStore<PublicHoliday[]>(K.holidays, []), row].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date)));
      return;
    }
    await cloudWrite('Adding holiday', () => supabase.from('public_holidays').insert(row));
  },

  async removeHoliday(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      saveStore(K.holidays, loadStore<PublicHoliday[]>(K.holidays, []).filter((h) => h.id !== id));
      return;
    }
    await cloudWrite('Removing holiday', () => supabase.from('public_holidays').delete().eq('id', id));
  },

  // ------------------------------------------------------------ job lines
  async job(wo: WorkOrder, canSeeMoney: boolean): Promise<JobCostingData> {
    if (!isSupabaseConfigured()) return offlineJob(wo, canSeeMoney);
    const [labour, mats, subs, totals] = await Promise.all([
      workOrderService.timeLog(wo.id),
      supabase.from('work_order_materials').select('*').eq('work_order_id', wo.id).order('created_at'),
      supabase.from('wo_subcontract_costs').select('*').eq('work_order_id', wo.id).order('created_at'),
      canSeeMoney ? supabase.from('wo_costing').select('*').eq('work_order_id', wo.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    cloudError('Loading materials', mats.error);
    const materials = (mats.data || []) as JobMaterial[];
    const subLines = (subs.data || []) as SubcontractLine[];
    const blank: Charges = { callout_fee: 0, minimum_charge: 0, markup_pct: 0, discount: 0 };
    const t = (totals.data as JobCosting | null) || computeTotals(labour, materials, subLines, blank, wo.id);
    return { labour, materials, subs: subLines, totals: normaliseTotals(t), canSeeMoney };
  },

  async addMaterial(wo: WorkOrder, line: Partial<JobMaterial>, by?: string): Promise<void> {
    const row: Partial<JobMaterial> = {
      id: newId(), work_order_id: wo.id, source: line.source || 'Store', quantity_used: Number(line.quantity_used),
      material_id: line.material_id || null, description: line.description || null, unit: line.unit || null,
      unit_cost: line.unit_cost != null ? Number(line.unit_cost) : (null as unknown as number),
      markup_pct: line.markup_pct != null && String(line.markup_pct) !== '' ? Number(line.markup_pct) : null,
      supplier: line.supplier || null, supplier_invoice_ref: line.supplier_invoice_ref || null, added_by: by || null,
    };
    if (!isSupabaseConfigured()) return offlineAddMaterial(wo, row as JobMaterial);
    await cloudWrite('Adding material', () => supabase.from('work_order_materials').insert(row));
  },

  async removeMaterial(line: JobMaterial): Promise<void> {
    if (!isSupabaseConfigured()) {
      const key = K.mats(line.work_order_id);
      saveStore(key, loadStore<JobMaterial[]>(key, []).filter((m) => m.id !== line.id));
      if (line.source === 'Store' && line.material_id) {
        await cafmDataService.adjustMaterialStock(line.material_id, Number(line.quantity_used), 'IN', 'Returned from job');
      }
      return;
    }
    await cloudWrite('Removing material', () => supabase.from('work_order_materials').delete().eq('id', line.id));
  },

  async addSubcontract(woId: string, line: Partial<SubcontractLine>): Promise<void> {
    const row = {
      id: newId(), work_order_id: woId, subcontractor: line.subcontractor, description: line.description || null,
      po_number: line.po_number || null, supplier_invoice_ref: line.supplier_invoice_ref || null,
      cost_amount: Number(line.cost_amount) || 0,
      markup_pct: line.markup_pct != null && String(line.markup_pct) !== '' ? Number(line.markup_pct) : null,
    };
    if (!isSupabaseConfigured()) {
      const s = settingsOf(await cafmDataService.getSystemSettings());
      const key = K.subs(woId);
      saveStore(key, [...loadStore<SubcontractLine[]>(key, []), priceSub(row as SubcontractLine, s.subcontract_markup_pct)]);
      return;
    }
    await cloudWrite('Adding subcontractor cost', () => supabase.from('wo_subcontract_costs').insert(row));
  },

  async removeSubcontract(line: SubcontractLine): Promise<void> {
    if (!isSupabaseConfigured()) {
      const key = K.subs(line.work_order_id);
      saveStore(key, loadStore<SubcontractLine[]>(key, []).filter((s) => s.id !== line.id));
      return;
    }
    await cloudWrite('Removing subcontractor cost', () => supabase.from('wo_subcontract_costs').delete().eq('id', line.id));
  },

  /** Change a labour line's rate type or grade; it is re-priced from the card. */
  async updateLabour(line: TimeLogEntry, patch: Partial<Pick<TimeLogEntry, 'rate_type' | 'grade' | 'hours'>>): Promise<void> {
    if (!isSupabaseConfigured()) {
      const key = `shever_timelog_${line.work_order_id}`;
      saveStore(key, loadStore<TimeLogEntry[]>(key, []).map((e) => (e.id === line.id ? { ...e, ...patch, rate_locked: false } : e)));
      return;
    }
    await cloudWrite('Updating labour line', () => supabase.from('wo_labour').update({ ...patch, rate_locked: false }).eq('id', line.id));
  },

  async removeLabour(line: TimeLogEntry): Promise<void> {
    if (!isSupabaseConfigured()) {
      const key = `shever_timelog_${line.work_order_id}`;
      saveStore(key, loadStore<TimeLogEntry[]>(key, []).filter((e) => e.id !== line.id));
      return;
    }
    await cloudWrite('Removing labour line', () => supabase.from('wo_labour').delete().eq('id', line.id));
  },

  /** Call-out fee, manual minimum charge, job markup, discount. */
  async saveCharges(woId: string, c: Charges): Promise<void> {
    const row = { work_order_id: woId, ...c, updated_at: new Date().toISOString() };
    if (!isSupabaseConfigured()) {
      saveStore(K.charges(woId), c);
      return;
    }
    await cloudWrite('Saving job charges', () => supabase.from('wo_costing').upsert(row, { onConflict: 'work_order_id', defaultToNull: false }));
  },

  /** Totals for many jobs (job costing report). */
  async allTotals(workOrders: WorkOrder[]): Promise<Map<string, JobCosting>> {
    const out = new Map<string, JobCosting>();
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('wo_costing').select('*');
      cloudError('Loading job costs', error);
      (data || []).forEach((r) => out.set(r.work_order_id, normaliseTotals(r as JobCosting)));
      return out;
    }
    for (const wo of workOrders) {
      const j = await offlineJob(wo, true);
      if (j.labour.length || j.materials.length || j.subs.length || j.totals.total_sell) out.set(wo.id, j.totals);
    }
    return out;
  },
};

const normaliseTotals = (t: JobCosting): JobCosting => {
  const n = { ...t } as unknown as Record<string, unknown>;
  for (const k of ['labour_cost', 'labour_sell', 'material_cost', 'material_sell', 'subcontract_cost', 'subcontract_sell',
    'callout_fee', 'minimum_charge', 'markup_pct', 'discount', 'total_cost', 'total_sell']) n[k] = Number(n[k]) || 0;
  return n as unknown as JobCosting;
};

// ---------------------------------------------------------------------------
// Offline demo mode
// ---------------------------------------------------------------------------
const offlineJob = async (wo: WorkOrder, canSeeMoney: boolean): Promise<JobCostingData> => {
  const [log, rates, s, holidays, users] = await Promise.all([
    workOrderService.timeLog(wo.id),
    costingService.rates(),
    costingService.settings(),
    costingService.holidays(),
    cafmDataService.getUsers(),
  ]);
  // Price the time log the way the database trigger does.
  const labour = log.map((e) => {
    const who = users.find((u) => u.id === e.technician_id);
    const grade = e.grade || who?.grade || 'Technician';
    const trade_code = e.trade_code || who?.trade_code || null;
    const rate_type: RateType = e.rate_type || (!e.is_manual && e.started_at ? rateTypeAt(e.started_at, s, holidays) : 'Normal');
    const hours = e.started_at && e.ended_at && !e.is_manual
      ? round2((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000)
      : Number(e.hours) || 0;
    const r = resolveRate(rates, { grade, rate_type, trade_code, contract_id: wo.contract_id, date: e.started_at || undefined });
    const cost_rate = r?.cost_rate || 0;
    const sell_rate = e.record_type === 'Travel' && !s.bill_travel ? 0 : r?.sell_rate || 0;
    return { ...e, grade, trade_code, rate_type, hours, cost_rate, sell_rate, cost_amount: round2(hours * cost_rate), sell_amount: round2(hours * sell_rate) };
  });
  const materials = loadStore<JobMaterial[]>(K.mats(wo.id), []);
  const subs = loadStore<SubcontractLine[]>(K.subs(wo.id), []);
  const charges = loadStore<Charges>(K.charges(wo.id), { callout_fee: 0, minimum_charge: 0, markup_pct: 0, discount: 0 });
  return { labour, materials, subs, totals: computeTotals(labour, materials, subs, charges, wo.id), canSeeMoney };
};

const offlineAddMaterial = async (wo: WorkOrder, row: JobMaterial) => {
  if (!(row.quantity_used > 0)) throw new Error('Quantity must be more than zero.');
  const s = settingsOf(await cafmDataService.getSystemSettings());
  if (row.source === 'Store') {
    const item = (await cafmDataService.getMaterials()).find((m) => m.id === row.material_id);
    if (!item) throw new Error('Pick the store item.');
    if (Number(item.quantity_in_stock) < row.quantity_used) {
      throw new Error(`Only ${item.quantity_in_stock} ${item.unit} of "${item.name}" in the store.`);
    }
    row.unit_cost = row.unit_cost || item.unit_cost;
    row.description = row.description || item.name;
    row.unit = row.unit || item.unit;
    await cafmDataService.adjustMaterialStock(item.id, -row.quantity_used, 'OUT', `Issued to job ${wo.wo_number}`);
  } else if (!row.description) {
    throw new Error('Describe what was bought.');
  }
  const key = K.mats(wo.id);
  saveStore(key, [...loadStore<JobMaterial[]>(key, []), priceMaterial({ ...row, unit_cost: Number(row.unit_cost) || 0, created_at: new Date().toISOString() }, s.material_markup_pct)]);
};
