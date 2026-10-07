import { supabase, isSupabaseConfigured, cafmDataService, cloudRead, cloudWrite, newId, loadStore, saveStore } from './supabase';
import { Hierarchy, hierarchyService } from './hierarchy';
import { costingService } from './costing';
import {
  BillingLine, BillingLineType, Client, Contract, Invoice, InvoiceStatus, JobCosting, Quote, QuoteStatus, SystemSettings, WorkOrder,
} from '../types';

/**
 * Billing: clients & contracts, quotes and AED invoices.
 *
 * Chargeable jobs follow  Completed -> To Bill -> Invoiced -> Paid (= Closed).
 * In the cloud the database enforces it (database/15_billing.sql): numbers,
 * totals and VAT, locking issued invoices, moving the jobs along, and refusing
 * to close a chargeable job by hand. Offline demo mode mirrors the rules here.
 */

const K = {
  clients: 'shever_clients',
  contracts: 'shever_contracts',
  invoices: 'shever_invoices',
  quotes: 'shever_quotes',
  lines: 'shever_billing_lines',
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const todayUae = () => new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

export interface BillingSettings {
  vat_enabled: boolean;
  vat_rate: number;
  company_trn: string;
  invoice_prefix: string;
  quote_prefix: string;
  payment_terms_days: number;
  bank_details: string;
  company_address: string;
}

export const billingSettingsOf = (s?: Partial<SystemSettings> | null): BillingSettings => ({
  vat_enabled: !!s?.vat_enabled,
  vat_rate: Number(s?.vat_rate ?? 5),
  company_trn: s?.company_trn || '',
  invoice_prefix: s?.invoice_prefix || 'INV',
  quote_prefix: s?.quote_prefix || 'QT',
  payment_terms_days: Number(s?.payment_terms_days ?? 30),
  bank_details: s?.bank_details || '',
  company_address: s?.company_address || '',
});

export const INVOICE_META: Record<InvoiceStatus | 'Overdue', { label: string; pill: string }> = {
  Draft: { label: 'Draft', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  Issued: { label: 'Issued', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  Overdue: { label: 'Overdue', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  Paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  Cancelled: { label: 'Cancelled', pill: 'bg-slate-100 text-slate-500 line-through dark:bg-slate-800' },
};

export const QUOTE_META: Record<QuoteStatus, { label: string; pill: string }> = {
  Draft: { label: 'Draft', pill: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  Sent: { label: 'Sent', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  Approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  Rejected: { label: 'Rejected', pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  Expired: { label: 'Expired', pill: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
};

export const invoiceState = (inv: Invoice): InvoiceStatus | 'Overdue' =>
  inv.status === 'Issued' && inv.due_date && inv.due_date < todayUae() ? 'Overdue' : inv.status;

export const BILLING_STATUS_META: Record<string, { label: string; pill: string }> = {
  'Not Billable': { label: 'Not billed yet', pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  'To Bill': { label: 'To bill', pill: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
  Quoted: { label: 'Quoted', pill: 'bg-sky-50 text-sky-700' },
  Invoiced: { label: 'Invoiced', pill: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  Paid: { label: 'Paid', pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  'Written Off': { label: 'Written off', pill: 'bg-slate-100 text-slate-500 dark:bg-slate-800' },
};

/** Which client a job belongs to: set on the job, or via its (facility's) contract. */
export const clientOf = (wo: WorkOrder, h: Hierarchy | null, contracts: Contract[]): string | null => {
  if (wo.client_id) return wo.client_id;
  const facilityId = wo.facility_id || h?.buildings.find((b) => b.id === wo.building_id)?.facility_id;
  const contractId = wo.contract_id || h?.facilities.find((f) => f.id === facilityId)?.contract_id;
  return contracts.find((c) => c.id === contractId)?.client_id || null;
};

/**
 * What a job is billed at: the approved quote price for quoted works,
 * otherwise the job costing total (cost + markup, call-out, minimum charge).
 */
export const jobBillAmount = (wo: WorkOrder, totals: Map<string, JobCosting>, quotes: Quote[]): number => {
  const q = wo.quote_id && quotes.find((x) => x.id === wo.quote_id && x.status === 'Approved');
  if (q) return Number(q.subtotal) || 0;
  return Number(totals.get(wo.id)?.total_sell) || 0;
};

const jobTitle = (wo: WorkOrder) => `${wo.wo_number} — ${(wo.problem_description || '').split('\n')[0].slice(0, 90)}`;

/** Invoice lines for a job: one line, or a breakdown that adds up to the same total. */
export const linesForJob = (wo: WorkOrder, totals: Map<string, JobCosting>, quotes: Quote[], detailed: boolean): Omit<BillingLine, 'id'>[] => {
  const amount = jobBillAmount(wo, totals, quotes);
  const c = totals.get(wo.id);
  const one = (line_type: BillingLineType, description: string, unit_price: number) => ({
    work_order_id: wo.id, line_type, description, quantity: 1, unit_price: round2(unit_price),
  });
  const quoted = wo.quote_id && quotes.find((x) => x.id === wo.quote_id && x.status === 'Approved');
  if (!detailed || !c || quoted) {
    return [one('Other', quoted ? `${jobTitle(wo)} (as per quote ${quoted.quote_number})` : jobTitle(wo), amount)];
  }
  const m = 1 + (c.markup_pct || 0) / 100;
  const lines = [
    one('Labour', `${wo.wo_number} — Labour & travel`, c.labour_sell * m),
    one('Material', `${wo.wo_number} — Materials`, c.material_sell * m),
    one('Subcontract', `${wo.wo_number} — Specialist / subcontract works`, c.subcontract_sell * m),
    one('Call-out', `${wo.wo_number} — Call-out fee`, c.callout_fee),
    one('Other', `${wo.wo_number} — Discount`, -c.discount),
  ].filter((l) => Math.abs(l.unit_price) >= 0.005);
  const sum = round2(lines.reduce((a, l) => a + l.unit_price, 0));
  if (c.minimum_charge > 0 && round2(amount) === round2(c.minimum_charge) && sum < amount) {
    return [one('Minimum Charge', `${jobTitle(wo)} — minimum charge`, amount)];
  }
  // Rounding: settle any cent difference on the first line.
  if (lines.length && round2(amount - sum) !== 0) lines[0].unit_price = round2(lines[0].unit_price + amount - sum);
  return lines.length ? lines : [one('Other', jobTitle(wo), amount)];
};

const sortLines = (ls: BillingLine[]) => [...ls].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

export const billingService = {
  // -------------------------------------------------------- clients & contracts
  async clients(): Promise<Client[]> {
    const rows = await cloudRead<Client>('clients', (q) => q.order('name'), K.clients);
    return rows || loadStore<Client[]>(K.clients, []);
  },
  async saveClient(c: Client): Promise<void> {
    if (!isSupabaseConfigured()) return upsertLocal(K.clients, c);
    await cloudWrite('Saving client', () => supabase.from('clients').upsert({ ...c, updated_at: new Date().toISOString() }, { onConflict: 'id', defaultToNull: false }));
  },
  async deleteClient(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return saveStore(K.clients, loadStore<Client[]>(K.clients, []).filter((c) => c.id !== id));
    await cloudWrite('Deleting client', () => supabase.from('clients').delete().eq('id', id));
  },
  async contracts(): Promise<Contract[]> {
    const rows = await cloudRead<Contract>('contracts', (q) => q.order('code'), K.contracts);
    return rows || loadStore<Contract[]>(K.contracts, []);
  },
  async saveContract(c: Contract): Promise<void> {
    if (!isSupabaseConfigured()) return upsertLocal(K.contracts, c);
    await cloudWrite('Saving contract', () => supabase.from('contracts').upsert({ ...c, updated_at: new Date().toISOString() }, { onConflict: 'id', defaultToNull: false }));
  },
  async deleteContract(id: string): Promise<void> {
    if (!isSupabaseConfigured()) return saveStore(K.contracts, loadStore<Contract[]>(K.contracts, []).filter((c) => c.id !== id));
    await cloudWrite('Deleting contract', () => supabase.from('contracts').delete().eq('id', id));
  },
  /** Which facilities a contract covers (facilities.contract_id). */
  async setContractFacilities(contractId: string, facilityIds: string[], h: Hierarchy): Promise<void> {
    for (const f of h.facilities) {
      const want = facilityIds.includes(f.id);
      const has = f.contract_id === contractId;
      if (want && !has) await hierarchyService.update('facilities', f.id, { contract_id: contractId });
      if (!want && has) await hierarchyService.update('facilities', f.id, { contract_id: null });
    }
  },

  // ------------------------------------------------------------ settings
  async settings(): Promise<BillingSettings> {
    return billingSettingsOf(await cafmDataService.getSystemSettings());
  },
  async saveSettings(s: BillingSettings): Promise<void> {
    await cafmDataService.updateSystemSettings(s as unknown as Partial<SystemSettings>);
  },

  // ------------------------------------------------------------ to bill
  async toBill(): Promise<WorkOrder[]> {
    const all = await cafmDataService.getWorkOrders();
    return all.filter((w) => w.is_chargeable && w.billing_status === 'To Bill');
  },

  async writeOff(wo: WorkOrder, reason: string): Promise<void> {
    await cafmDataService.updateWorkOrder(wo.id, { billing_status: 'Written Off', remarks: `Written off: ${reason}` });
  },

  // ------------------------------------------------------------ invoices
  async invoices(): Promise<Invoice[]> {
    const rows = await cloudRead<Invoice>('invoices', (q) => q.order('created_at', { ascending: false }), K.invoices);
    return (rows || loadStore<Invoice[]>(K.invoices, [])).map(num);
  },
  async invoice(id: string): Promise<Invoice | null> {
    return (await this.invoices()).find((i) => i.id === id) || null;
  },
  async lines(doc: { invoice_id?: string; quote_id?: string }): Promise<BillingLine[]> {
    if (!isSupabaseConfigured()) {
      return sortLines(loadStore<BillingLine[]>(K.lines, []).filter((l) => (doc.invoice_id ? l.invoice_id === doc.invoice_id : l.quote_id === doc.quote_id)));
    }
    const col = doc.invoice_id ? 'invoice_id' : 'quote_id';
    const { data, error } = await supabase.from('billing_lines').select('*').eq(col, doc.invoice_id || doc.quote_id).order('sort_order');
    if (error) throw new Error(`Loading lines failed: ${error.message}`);
    return (data || []).map((l) => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price), amount: Number(l.amount) })) as BillingLine[];
  },

  /** Draft invoice for a client, with the chosen jobs' lines. Returns its id. */
  async createInvoice(input: { client_id: string; jobs: WorkOrder[]; detailed: boolean; createdBy?: string }): Promise<string> {
    const [totals, quotes] = await Promise.all([costingService.allTotals(input.jobs), this.quotes()]);
    const id = newId();
    const inv = { id, client_id: input.client_id, status: 'Draft' as const, created_by: input.createdBy || null, currency: 'AED' };
    const lines = input.jobs.flatMap((w) => linesForJob(w, totals, quotes, input.detailed)).map((l, i) => ({ ...l, id: newId(), invoice_id: id, sort_order: i }));
    if (!isSupabaseConfigured()) {
      await offlineNewDoc('invoice', inv);
      for (const l of lines) await offlineAddLine(l);
      return id;
    }
    await cloudWrite('Creating invoice', () => supabase.from('invoices').insert(inv));
    if (lines.length) await cloudWrite('Adding invoice lines', () => supabase.from('billing_lines').insert(lines));
    return id;
  },

  async updateInvoice(id: string, patch: Partial<Invoice>): Promise<void> {
    if (!isSupabaseConfigured()) {
      const all = loadStore<Invoice[]>(K.invoices, []);
      const inv = all.find((i) => i.id === id);
      if (!inv) throw new Error('Invoice not found.');
      if (inv.status !== 'Draft' && Object.keys(patch).some((k) => !['notes', 'payment_ref'].includes(k))) throw new Error('Only draft invoices can be changed.');
      Object.assign(inv, patch);
      saveStore(K.invoices, all);
      if ('vat_rate' in patch) offlineRetotal('invoice', id);
      return;
    }
    await cloudWrite('Saving invoice', () => supabase.from('invoices').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
  },

  async setInvoiceStatus(inv: Invoice, status: InvoiceStatus, extra: Partial<Invoice> = {}): Promise<void> {
    if (!isSupabaseConfigured()) return offlineInvoiceStatus(inv, status, extra);
    await cloudWrite(`Marking invoice ${status.toLowerCase()}`, () =>
      supabase.from('invoices').update({ ...extra, status, updated_at: new Date().toISOString() }).eq('id', inv.id)
    );
  },

  async deleteInvoice(inv: Invoice): Promise<void> {
    if (inv.status !== 'Draft') throw new Error('Only draft invoices can be deleted. Cancel it instead.');
    if (!isSupabaseConfigured()) {
      saveStore(K.invoices, loadStore<Invoice[]>(K.invoices, []).filter((i) => i.id !== inv.id));
      saveStore(K.lines, loadStore<BillingLine[]>(K.lines, []).filter((l) => l.invoice_id !== inv.id));
      return;
    }
    await cloudWrite('Deleting invoice', () => supabase.from('invoices').delete().eq('id', inv.id));
  },

  // -------------------------------------------------------------- lines
  async addLine(line: Omit<BillingLine, 'id'>): Promise<void> {
    const row = { ...line, id: newId() };
    if (!isSupabaseConfigured()) return offlineAddLine(row);
    await cloudWrite('Adding line', () => supabase.from('billing_lines').insert(row));
  },
  async removeLine(line: BillingLine): Promise<void> {
    if (!isSupabaseConfigured()) {
      offlineAssertDraft(line);
      saveStore(K.lines, loadStore<BillingLine[]>(K.lines, []).filter((l) => l.id !== line.id));
      offlineRetotal(line.invoice_id ? 'invoice' : 'quote', (line.invoice_id || line.quote_id)!);
      return;
    }
    await cloudWrite('Removing line', () => supabase.from('billing_lines').delete().eq('id', line.id));
  },

  // -------------------------------------------------------------- quotes
  async quotes(): Promise<Quote[]> {
    const rows = await cloudRead<Quote>('quotes', (q) => q.order('created_at', { ascending: false }), K.quotes);
    return (rows || loadStore<Quote[]>(K.quotes, [])).map(num);
  },
  async quote(id: string): Promise<Quote | null> {
    return (await this.quotes()).find((q) => q.id === id) || null;
  },
  async createQuote(q: Partial<Quote>, createdBy?: string): Promise<string> {
    const id = newId();
    const row = {
      id, title: q.title || 'New quote', client_id: q.client_id || null, facility_id: q.facility_id || null,
      work_order_id: q.work_order_id || null, description: q.description || null, status: 'Draft' as const, created_by: createdBy || null, currency: 'AED',
    };
    if (!isSupabaseConfigured()) {
      await offlineNewDoc('quote', row);
      return id;
    }
    await cloudWrite('Creating quote', () => supabase.from('quotes').insert(row));
    return id;
  },
  async updateQuote(id: string, patch: Partial<Quote>): Promise<void> {
    if (!isSupabaseConfigured()) {
      const all = loadStore<Quote[]>(K.quotes, []);
      const q = all.find((x) => x.id === id);
      if (!q) throw new Error('Quote not found.');
      Object.assign(q, patch);
      saveStore(K.quotes, all);
      if ('vat_rate' in patch) offlineRetotal('quote', id);
      return;
    }
    await cloudWrite('Saving quote', () => supabase.from('quotes').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
  },
  async setQuoteStatus(q: Quote, status: QuoteStatus): Promise<void> {
    const now = new Date().toISOString();
    const patch: Partial<Quote> = { status };
    if (!isSupabaseConfigured()) {
      if (status === 'Sent') patch.sent_at = q.sent_at || now;
      if (status === 'Approved') patch.approved_at = q.approved_at || now;
      if (status === 'Draft') Object.assign(patch, { sent_at: null, approved_at: null });
    }
    await this.updateQuote(q.id, patch);
  },
  async deleteQuote(q: Quote): Promise<void> {
    if (!isSupabaseConfigured()) {
      saveStore(K.quotes, loadStore<Quote[]>(K.quotes, []).filter((x) => x.id !== q.id));
      saveStore(K.lines, loadStore<BillingLine[]>(K.lines, []).filter((l) => l.quote_id !== q.id));
      return;
    }
    await cloudWrite('Deleting quote', () => supabase.from('quotes').delete().eq('id', q.id));
  },
  /** An approved quote became a job: link both ways. */
  async linkQuoteToJob(quoteId: string, woId: string): Promise<void> {
    await this.updateQuote(quoteId, { work_order_id: woId });
  },
};

// Numeric columns come back from PostgREST as strings.
const num = <T extends { subtotal: number; vat_rate: number; vat_amount: number; total: number }>(d: T): T => ({
  ...d, subtotal: Number(d.subtotal) || 0, vat_rate: Number(d.vat_rate) || 0, vat_amount: Number(d.vat_amount) || 0, total: Number(d.total) || 0,
});

// ---------------------------------------------------------------------------
// Offline demo mode: the database rules, in the browser
// ---------------------------------------------------------------------------
const upsertLocal = <T extends { id: string }>(key: string, row: T) => {
  const all = loadStore<T[]>(key, []);
  const i = all.findIndex((x) => x.id === row.id);
  if (i >= 0) all[i] = { ...all[i], ...row };
  else all.push({ created_at: new Date().toISOString(), ...row });
  saveStore(key, all);
};

const offlineNewDoc = async (kind: 'invoice' | 'quote', row: Record<string, unknown>) => {
  const s = await billingService.settings();
  const vat_rate = s.vat_enabled ? s.vat_rate : 0;
  const year = todayUae().slice(0, 4);
  if (kind === 'invoice') {
    const all = loadStore<Invoice[]>(K.invoices, []);
    const prefix = `${s.invoice_prefix}-${year}-`;
    const n = all.filter((i) => i.invoice_number.startsWith(prefix)).length + 1;
    all.unshift({ ...(row as unknown as Invoice), invoice_number: `${prefix}${String(n).padStart(4, '0')}`, vat_rate, subtotal: 0, vat_amount: 0, total: 0, created_at: new Date().toISOString() });
    saveStore(K.invoices, all);
  } else {
    const all = loadStore<Quote[]>(K.quotes, []);
    const prefix = `${s.quote_prefix}-${year}-`;
    const n = all.filter((q) => q.quote_number.startsWith(prefix)).length + 1;
    all.unshift({ ...(row as unknown as Quote), quote_number: `${prefix}${String(n).padStart(4, '0')}`, vat_rate, subtotal: 0, vat_amount: 0, total: 0, valid_until: addDays(todayUae(), 30), created_at: new Date().toISOString() });
    saveStore(K.quotes, all);
  }
};

const offlineAssertDraft = (l: Pick<BillingLine, 'invoice_id' | 'quote_id'>) => {
  if (l.invoice_id && loadStore<Invoice[]>(K.invoices, []).find((i) => i.id === l.invoice_id)?.status !== 'Draft') throw new Error('Only draft invoices can be changed.');
  if (l.quote_id && loadStore<Quote[]>(K.quotes, []).find((q) => q.id === l.quote_id)?.status !== 'Draft') throw new Error('Only draft quotes can be changed.');
};

const offlineAddLine = async (line: BillingLine) => {
  offlineAssertDraft(line);
  const lines = loadStore<BillingLine[]>(K.lines, []);
  if (line.invoice_id && line.work_order_id) {
    const live = new Set(loadStore<Invoice[]>(K.invoices, []).filter((i) => i.status !== 'Cancelled' && i.id !== line.invoice_id).map((i) => i.id));
    const other = lines.find((l) => l.work_order_id === line.work_order_id && l.invoice_id && live.has(l.invoice_id));
    if (other) throw new Error('This job is already on another invoice.');
  }
  const quantity = Number(line.quantity ?? 1);
  const unit_price = Number(line.unit_price ?? 0);
  lines.push({ ...line, quantity, unit_price, amount: round2(quantity * unit_price), sort_order: line.sort_order ?? lines.length });
  saveStore(K.lines, lines);
  offlineRetotal(line.invoice_id ? 'invoice' : 'quote', (line.invoice_id || line.quote_id)!);
};

const offlineRetotal = (kind: 'invoice' | 'quote', id: string) => {
  const key = kind === 'invoice' ? K.invoices : K.quotes;
  const docs = loadStore<(Invoice | Quote)[]>(key, []);
  const d = docs.find((x) => x.id === id);
  if (!d) return;
  const sub = round2(loadStore<BillingLine[]>(K.lines, []).filter((l) => (kind === 'invoice' ? l.invoice_id : l.quote_id) === id).reduce((a, l) => a + (l.amount || 0), 0));
  d.subtotal = sub;
  d.vat_amount = round2((sub * (d.vat_rate || 0)) / 100);
  d.total = round2(sub + d.vat_amount);
  saveStore(key, docs);
};

const offlineInvoiceStatus = async (inv: Invoice, status: InvoiceStatus, extra: Partial<Invoice>) => {
  const ok =
    (inv.status === 'Draft' && ['Issued', 'Cancelled'].includes(status)) ||
    (inv.status === 'Issued' && ['Paid', 'Cancelled'].includes(status)) ||
    (inv.status === 'Paid' && status === 'Issued');
  if (!ok) throw new Error(`An invoice cannot go from ${inv.status} to ${status}.`);
  const lines = loadStore<BillingLine[]>(K.lines, []).filter((l) => l.invoice_id === inv.id);
  const patch: Partial<Invoice> = { ...extra, status };
  const jobs = [...new Set(lines.map((l) => l.work_order_id).filter(Boolean))] as string[];
  const wos = await cafmDataService.getWorkOrders();
  const onInvoice = wos.filter((w) => w.invoice_id === inv.id).map((w) => w.id);

  if (status === 'Issued' && inv.status === 'Draft') {
    if (!lines.length) throw new Error('Add at least one line before issuing the invoice.');
    if (!inv.client_id) throw new Error('Choose the client before issuing the invoice.');
    const s = await billingService.settings();
    patch.issued_at = new Date().toISOString();
    patch.issue_date = inv.issue_date || todayUae();
    patch.due_date = inv.due_date || addDays(patch.issue_date, s.payment_terms_days);
    for (const id of jobs) await cafmDataService.updateWorkOrder(id, { billing_status: 'Invoiced', invoice_id: inv.id });
  }
  if (status === 'Paid') {
    patch.paid_at = extra.paid_at || new Date().toISOString();
    const now = new Date().toISOString();
    for (const id of onInvoice) {
      const w = wos.find((x) => x.id === id)!;
      const close = ['Completed', 'Work Done'].includes(w.status);
      await cafmDataService.updateWorkOrder(id, { billing_status: 'Paid', ...(close ? { status: 'Closed', closed_at: now } : {}) });
    }
  }
  if (status === 'Issued' && inv.status === 'Paid') {
    Object.assign(patch, { paid_at: null, payment_ref: null });
    for (const id of onInvoice) {
      const w = wos.find((x) => x.id === id)!;
      await cafmDataService.updateWorkOrder(id, { billing_status: 'Invoiced', ...(w.status === 'Closed' ? { status: 'Completed' as const, closed_at: undefined } : {}) });
    }
  }
  if (status === 'Cancelled') {
    for (const id of onInvoice) await cafmDataService.updateWorkOrder(id, { billing_status: 'To Bill', invoice_id: null });
  }
  const all = loadStore<Invoice[]>(K.invoices, []);
  Object.assign(all.find((i) => i.id === inv.id)!, patch);
  saveStore(K.invoices, all);
};
