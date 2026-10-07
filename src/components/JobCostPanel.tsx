import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HardHat, Loader2, Package, Plus, Receipt, Save, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { Charges, JobCostingData, RATE_TYPES, aed, costingService } from '../api/costing';
import { cafmDataService } from '../api/supabase';
import { JobMaterial, Material, RateType, SubcontractLine, TimeLogEntry, WorkOrder } from '../types';

/**
 * Materials & costs tab on a work order.
 *
 * Everyone working the job records the materials they used. Supervisors and
 * managers also see the money: labour priced from the rate card, material and
 * subcontractor cost + markup, and the job charges. Only managers change the
 * charges (call-out fee, manual minimum charge, markup, discount).
 */

interface Props {
  wo: WorkOrder;
  /** Supervisor / manager / admin: sees costs, removes lines. */
  lead: boolean;
  /** Manager / admin: edits charges, labour rate type, subcontractors. */
  manager: boolean;
  /** May add materials now (assigned technician on a live job, or a lead). */
  canAdd: boolean;
  userId?: string;
  /** Timers changed elsewhere (start / arrive / work done). */
  refreshKey?: unknown;
}

type Form = null | 'store' | 'direct' | 'sub';

export const JobCostPanel: React.FC<Props> = ({ wo, lead, manager, canAdd, userId, refreshKey }) => {
  const [data, setData] = useState<JobCostingData | null>(null);
  const [store, setStore] = useState<Material[]>([]);
  const [form, setForm] = useState<Form>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [charges, setCharges] = useState<Charges | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const load = async () => {
    const d = await costingService.job(wo, lead);
    setData(d);
    const t = d.totals;
    setCharges({ callout_fee: t.callout_fee, minimum_charge: t.minimum_charge, markup_pct: t.markup_pct, discount: t.discount, notes: t.notes || '' });
  };

  useEffect(() => {
    load().catch((e) => setError(e?.message || 'Could not load costs.'));
    cafmDataService.getMaterials().then(setStore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wo.id, refreshKey]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setForm(null);
      setF({});
      await load();
      cafmDataService.getMaterials().then(setStore);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!data || !charges) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading costs…
      </div>
    );
  }

  const t = data.totals;
  const margin = t.total_sell - t.total_cost;
  const marginPct = t.total_sell > 0 ? Math.round((margin / t.total_sell) * 100) : null;
  const linesSell = t.labour_sell + t.material_sell + t.subcontract_sell;
  const minimumApplies = t.minimum_charge > 0 && t.total_sell === t.minimum_charge && t.minimum_charge > linesSell * (1 + t.markup_pct / 100) + t.callout_fee - t.discount;
  const chosen = store.find((m) => m.id === f.material);

  return (
    <div className="space-y-5">
      {/* Summary */}
      {lead && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Money label="Cost to OCS" value={aed(t.total_cost)} />
          <Money label={wo.is_chargeable ? 'Charge to client' : 'Value (in contract)'} value={aed(t.total_sell)} tone="text-ocs-blue dark:text-white" sub={wo.is_chargeable ? 'before VAT' : 'not billed'} />
          <Money label="Margin" value={aed(margin)} tone={margin < 0 ? 'text-ocs-red' : 'text-emerald-600'} />
          <Money label="Margin %" value={marginPct == null ? '—' : `${marginPct}%`} tone={marginPct != null && marginPct < 15 ? 'text-orange-600' : 'text-emerald-600'} />
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      {/* Materials */}
      <Section icon={Package} title="Materials used" right={
        canAdd && (
          <div className="flex gap-2">
            <AddBtn onClick={() => { setForm('store'); setF({ qty: '1' }); }} label="From store" />
            <AddBtn onClick={() => { setForm('direct'); setF({ qty: '1' }); }} label="Bought for this job" />
          </div>
        )
      }>
        {form === 'store' && (
          <FormRow onCancel={() => setForm(null)} busy={busy} disabled={!f.material || !(Number(f.qty) > 0)}
            onSave={() => act(() => costingService.addMaterial(wo, { source: 'Store', material_id: f.material, quantity_used: Number(f.qty) }, userId))}>
            <select value={f.material || ''} onChange={(e) => set('material', e.target.value)} className="enterprise-input sm:col-span-3">
              <option value="">Choose store item…</option>
              {store.map((m) => (
                <option key={m.id} value={m.id} disabled={Number(m.quantity_in_stock) <= 0}>
                  {m.item_code} · {m.name} — {m.quantity_in_stock} {m.unit} in stock{lead ? ` · ${aed(m.unit_cost)}` : ''}
                </option>
              ))}
            </select>
            <input type="number" min="0" step="any" value={f.qty} onChange={(e) => set('qty', e.target.value)} placeholder={`Qty${chosen ? ` (${chosen.unit})` : ''}`} className="enterprise-input" />
          </FormRow>
        )}
        {form === 'direct' && (
          <FormRow onCancel={() => setForm(null)} busy={busy} disabled={!f.desc?.trim() || !(Number(f.qty) > 0) || f.cost === undefined || f.cost === ''}
            onSave={() => act(() => costingService.addMaterial(wo, {
              source: 'Direct Purchase', description: f.desc.trim(), quantity_used: Number(f.qty), unit: f.unit || 'pcs',
              unit_cost: Number(f.cost), supplier: f.supplier, supplier_invoice_ref: f.ref, markup_pct: lead && f.markup !== undefined && f.markup !== '' ? Number(f.markup) : undefined,
            }, userId))}>
            <input value={f.desc || ''} onChange={(e) => set('desc', e.target.value)} placeholder="What was bought (e.g. Capacitor 35µF)" className="enterprise-input sm:col-span-2" />
            <input type="number" min="0" step="any" value={f.qty} onChange={(e) => set('qty', e.target.value)} placeholder="Qty" className="enterprise-input" />
            <input type="number" min="0" step="0.01" value={f.cost || ''} onChange={(e) => set('cost', e.target.value)} placeholder="Unit cost AED" className="enterprise-input" />
            <input value={f.supplier || ''} onChange={(e) => set('supplier', e.target.value)} placeholder="Supplier" className="enterprise-input sm:col-span-2" />
            <input value={f.ref || ''} onChange={(e) => set('ref', e.target.value)} placeholder="Receipt / invoice no." className="enterprise-input" />
            {lead && <input type="number" step="0.5" value={f.markup ?? ''} onChange={(e) => set('markup', e.target.value)} placeholder="Markup % (default)" className="enterprise-input" />}
          </FormRow>
        )}
        <Table
          head={['Item', 'Source', 'Qty', ...(lead ? ['Cost', 'Markup', 'Sell'] : []), '']}
          empty="No materials recorded."
          rows={data.materials.map((m: JobMaterial) => [
            <span key="d" className="font-semibold text-slate-800 dark:text-slate-100">{m.description || '—'}{m.supplier ? <span className="block text-[10px] font-normal text-slate-500">{m.supplier}{m.supplier_invoice_ref ? ` · ${m.supplier_invoice_ref}` : ''}</span> : null}</span>,
            <span key="s" className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${m.source === 'Store' ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' : 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300'}`}>{m.source === 'Store' ? 'Store' : 'Bought'}</span>,
            `${Number(m.quantity_used)} ${m.unit || ''}`,
            ...(lead ? [aed(m.total_cost), `${Number(m.markup_pct ?? 0)}%`, <b key="sell">{aed(m.sell_amount)}</b>] : []),
            lead && wo.billing_status !== 'Invoiced' ? <Del key="x" busy={busy} title={m.source === 'Store' ? 'Remove (returns it to the store)' : 'Remove'} onClick={() => act(() => costingService.removeMaterial(m))} /> : null,
          ])}
        />
      </Section>

      {lead && (
        <>
          {/* Labour */}
          <Section icon={HardHat} title="Labour & travel" right={<span className="text-[10px] text-slate-500">Priced from the <Link to="/settings/costing" className="font-semibold text-teal-600">rate card</Link></span>}>
            <Table
              head={['Who', 'Type', 'Rate', 'Hours', 'Cost', 'Sell', '']}
              empty="No time recorded yet. Timers start when the job is started."
              rows={data.labour.map((l: TimeLogEntry) => [
                <span key="w"><b className="text-slate-800 dark:text-slate-100">{l.technician_name || '—'}</b><span className="block text-[10px] text-slate-500">{l.grade || 'Technician'}{l.trade_code ? ` · ${l.trade_code}` : ''}</span></span>,
                `${l.record_type}${l.is_manual ? ' · manual' : ''}`,
                manager ? (
                  <select key="r" value={l.rate_type || 'Normal'} disabled={busy} onChange={(e) => act(() => costingService.updateLabour(l, { rate_type: e.target.value as RateType }))} className="enterprise-input w-auto py-1 text-[11px]">
                    {RATE_TYPES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                ) : <RateChip key="r" r={l.rate_type} />,
                l.ended_at || !l.started_at ? Number(l.hours).toFixed(2) : <span key="h" className="font-semibold text-orange-600">running</span>,
                <span key="c">{aed(l.cost_amount)}<span className="block text-[10px] text-slate-500">@ {Number(l.cost_rate || 0)}/h</span></span>,
                <span key="s"><b>{aed(l.sell_amount)}</b><span className="block text-[10px] text-slate-500">@ {Number(l.sell_rate || 0)}/h</span></span>,
                manager ? <Del key="x" busy={busy} onClick={() => act(() => costingService.removeLabour(l))} /> : null,
              ])}
            />
          </Section>

          {/* Subcontractors */}
          <Section icon={Truck} title="Subcontractors" right={manager && <AddBtn onClick={() => { setForm('sub'); setF({}); }} label="Add subcontractor cost" />}>
            {form === 'sub' && (
              <FormRow onCancel={() => setForm(null)} busy={busy} disabled={!f.name?.trim() || !(Number(f.cost) > 0)}
                onSave={() => act(() => costingService.addSubcontract(wo.id, { subcontractor: f.name.trim(), description: f.desc, po_number: f.po, supplier_invoice_ref: f.ref, cost_amount: Number(f.cost), markup_pct: f.markup === '' || f.markup === undefined ? undefined : Number(f.markup) }))}>
                <input value={f.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Subcontractor" className="enterprise-input sm:col-span-2" />
                <input value={f.desc || ''} onChange={(e) => set('desc', e.target.value)} placeholder="Work done" className="enterprise-input sm:col-span-2" />
                <input type="number" min="0" step="0.01" value={f.cost || ''} onChange={(e) => set('cost', e.target.value)} placeholder="Cost AED" className="enterprise-input" />
                <input type="number" step="0.5" value={f.markup ?? ''} onChange={(e) => set('markup', e.target.value)} placeholder="Markup % (default)" className="enterprise-input" />
                <input value={f.po || ''} onChange={(e) => set('po', e.target.value)} placeholder="PO number" className="enterprise-input" />
                <input value={f.ref || ''} onChange={(e) => set('ref', e.target.value)} placeholder="Their invoice no." className="enterprise-input" />
              </FormRow>
            )}
            <Table
              head={['Subcontractor', 'PO / invoice', 'Cost', 'Markup', 'Sell', '']}
              empty="No subcontractor costs."
              rows={data.subs.map((s: SubcontractLine) => [
                <span key="n"><b className="text-slate-800 dark:text-slate-100">{s.subcontractor}</b>{s.description ? <span className="block text-[10px] text-slate-500">{s.description}</span> : null}</span>,
                [s.po_number, s.supplier_invoice_ref].filter(Boolean).join(' · ') || '—',
                aed(s.cost_amount),
                `${Number(s.markup_pct ?? 0)}%`,
                <b key="s">{aed(s.sell_amount)}</b>,
                manager ? <Del key="x" busy={busy} onClick={() => act(() => costingService.removeSubcontract(s))} /> : null,
              ])}
            />
          </Section>

          {/* Charges */}
          <Section icon={Receipt} title="Job charges">
            <div className="grid gap-4 md:grid-cols-[1fr_280px]">
              <div className="grid grid-cols-2 gap-3">
                <Num label="Call-out fee" value={charges.callout_fee} disabled={!manager} onChange={(v) => setCharges({ ...charges, callout_fee: v })} />
                <Num label="Minimum charge (manual)" value={charges.minimum_charge} disabled={!manager} onChange={(v) => setCharges({ ...charges, minimum_charge: v })} />
                <Num label="Extra markup on job %" value={charges.markup_pct} disabled={!manager} onChange={(v) => setCharges({ ...charges, markup_pct: v })} />
                <Num label="Discount" value={charges.discount} disabled={!manager} onChange={(v) => setCharges({ ...charges, discount: v })} />
                <label className="col-span-2 block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Notes</span>
                  <input value={charges.notes || ''} disabled={!manager} onChange={(e) => setCharges({ ...charges, notes: e.target.value })} className="enterprise-input" placeholder="e.g. Minimum charge as per contract schedule" />
                </label>
                {manager && (
                  <div className="col-span-2 flex items-center gap-3">
                    <button
                      disabled={busy}
                      onClick={() => act(async () => { await costingService.saveCharges(wo.id, charges); setSaved(true); setTimeout(() => setSaved(false), 2500); })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save charges
                    </button>
                    {saved && <span className="text-xs font-semibold text-emerald-600">Saved</span>}
                  </div>
                )}
              </div>
              <dl className="space-y-1.5 rounded-lg bg-slate-50 p-4 text-xs dark:bg-slate-800/60">
                <Line k="Labour & travel" v={aed(t.labour_sell)} />
                <Line k="Materials" v={aed(t.material_sell)} />
                <Line k="Subcontractors" v={aed(t.subcontract_sell)} />
                {t.markup_pct ? <Line k={`Extra markup ${t.markup_pct}%`} v={aed(linesSell * t.markup_pct / 100)} /> : null}
                {t.callout_fee ? <Line k="Call-out fee" v={aed(t.callout_fee)} /> : null}
                {t.discount ? <Line k="Discount" v={`− ${aed(t.discount)}`} /> : null}
                <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                <Line k={<b>Total (before VAT)</b>} v={<b className="text-sm text-ocs-blue dark:text-white">{aed(t.total_sell)}</b>} />
                {minimumApplies && <p className="rounded bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Minimum charge applied</p>}
                {!wo.is_chargeable && <p className="pt-1 text-[11px] text-slate-500">Covered by the contract — shown for cost control, not billed.</p>}
              </dl>
            </div>
          </Section>
        </>
      )}

      {!lead && (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShoppingCart className="h-3.5 w-3.5" /> Record every part you use. Store items come off stock straight away.</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- pieces
const Section: React.FC<{ icon: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ icon: Icon, title, right, children }) => (
  <section className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500"><Icon className="h-3.5 w-3.5" /> {title}</h3>
      {right}
    </div>
    {children}
  </section>
);

const Money: React.FC<{ label: string; value: string; tone?: string; sub?: string }> = ({ label, value, tone = 'text-slate-800 dark:text-slate-100', sub }) => (
  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-base font-bold ${tone}`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
  </div>
);

const AddBtn: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 dark:border-slate-700 dark:text-teal-300 dark:hover:bg-slate-800">
    <Plus className="h-3.5 w-3.5" /> {label}
  </button>
);

const Del: React.FC<{ onClick: () => void; busy: boolean; title?: string }> = ({ onClick, busy, title = 'Remove' }) => (
  <button onClick={onClick} disabled={busy} title={title} className="rounded p-1 text-slate-400 hover:text-rose-600 disabled:opacity-40">
    <Trash2 className="h-3.5 w-3.5" />
  </button>
);

const FormRow: React.FC<{ children: React.ReactNode; onSave: () => void; onCancel: () => void; busy: boolean; disabled?: boolean }> = ({ children, onSave, onCancel, busy, disabled }) => (
  <div className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900 dark:bg-teal-500/5">
    <div className="grid gap-2 sm:grid-cols-4">{children}</div>
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
      <button onClick={onSave} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add
      </button>
    </div>
  </div>
);

const Table: React.FC<{ head: string[]; rows: React.ReactNode[][]; empty: string }> = ({ head, rows, empty }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
    <table className="w-full text-left text-xs">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
        <tr>{head.map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-5 text-center text-slate-500">{empty}</td></tr>}
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}
      </tbody>
    </table>
  </div>
);

const RateChip: React.FC<{ r?: RateType }> = ({ r = 'Normal' }) => (
  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r === 'Normal' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : r === 'Overtime' ? 'bg-orange-50 text-orange-700' : 'bg-rose-50 text-rose-700'}`}>{r}</span>
);

const Num: React.FC<{ label: string; value: number; onChange: (v: number) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    <input type="number" min="0" step="0.01" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) || 0)} className="enterprise-input disabled:opacity-70" />
  </label>
);

const Line: React.FC<{ k: React.ReactNode; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex justify-between gap-3"><dt className="text-slate-600 dark:text-slate-300">{k}</dt><dd className="text-right">{v}</dd></div>
);
