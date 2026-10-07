import React, { useEffect, useMemo, useState } from 'react';
import { CalendarX2, Check, HardHat, Loader2, Percent, Plus, Save, Trash2 } from 'lucide-react';
import { CostingSettings as Settings, GRADES, RATE_TYPES, WEEKDAYS, costingService } from '../../api/costing';
import { useAuth } from '../../context/AuthContext';
import { LabourRate, PublicHoliday, RateType } from '../../types';

/**
 * Rate card and costing defaults. Labour lines on jobs are priced from here:
 * a trade-specific rate wins over the company rate for the same grade.
 * Changing a rate affects new time only; recorded lines keep their price.
 */
export const CostingSettings: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const canRates = isAdmin || isManager;

  const [rates, setRates] = useState<LabourRate[] | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [trades, setTrades] = useState<{ code: string; name: string }[]>([]);
  const [newGrade, setNewGrade] = useState('');
  const [hol, setHol] = useState({ date: '', name: '' });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    const [r, s, h, t] = await Promise.all([costingService.rates(), costingService.settings(), costingService.holidays(), costingService.trades()]);
    setRates(r);
    setSavedIds(new Set(r.map((x) => x.id)));
    setSettings(s);
    setHolidays(h);
    setTrades(t);
    setDirty(new Set());
  };
  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg({ ok: true, text: ok });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy('');
    }
  };

  const companyRates = useMemo(() => (rates || []).filter((r) => !r.trade_code && !r.contract_id), [rates]);
  const tradeRates = useMemo(() => (rates || []).filter((r) => r.trade_code && !r.contract_id), [rates]);
  const grades = useMemo(() => {
    const g = new Set<string>(GRADES);
    companyRates.forEach((r) => g.add(r.grade));
    return [...g];
  }, [companyRates]);

  const cell = (grade: string, type: RateType) =>
    companyRates.filter((r) => r.grade === grade && r.rate_type === type).sort((a, b) => (b.effective_from || '').localeCompare(a.effective_from || ''))[0];

  const edit = (row: LabourRate, patch: Partial<LabourRate>) => {
    setRates((rs) => (rs || []).map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    setDirty((d) => new Set(d).add(row.id));
  };

  const setCell = (grade: string, type: RateType, field: 'cost_rate' | 'sell_rate', value: number) => {
    const existing = cell(grade, type);
    if (existing) return edit(existing, { [field]: value });
    const row = { ...costingService.newRate(grade, type), effective_from: '2020-01-01', [field]: value };
    setRates((rs) => [...(rs || []), row]);
    setDirty((d) => new Set(d).add(row.id));
  };

  const addTradeRate = () => {
    const row = { ...costingService.newRate(), trade_code: trades[0]?.code || 'HVAC' };
    setRates((rs) => [...(rs || []), row]);
    setDirty((d) => new Set(d).add(row.id));
  };

  if (!canRates) {
    return <div className="py-20 text-center text-sm text-slate-500">Rates and costing are managed by admins and FM managers.</div>;
  }
  if (!rates || !settings) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading rates…
      </div>
    );
  }

  const saveRates = () => run('rates', () => costingService.saveRates(rates.filter((r) => dirty.has(r.id))), 'Rate card saved. New time will use these rates.');

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Rates & Costing</h1>
        <p className="text-xs text-slate-500">How job time and materials are priced, in AED. Changes apply to new time; recorded lines keep their price.</p>
      </div>

      {msg && (
        <div className={`rounded-lg p-2.5 text-xs font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{msg.text}</div>
      )}

      {/* Rate card */}
      <div className="enterprise-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ocs-blue dark:text-white"><HardHat className="h-4 w-4 text-orange-500" /> Labour rate card (AED per hour)</h2>
          {canRates && (
            <button onClick={saveRates} disabled={!dirty.size || busy === 'rates'} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40">
              {busy === 'rates' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rate card{dirty.size ? ` (${dirty.size})` : ''}
            </button>
          )}
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          <b>Cost</b> = what an hour costs OCS. <b>Sell</b> = what the client is charged. Timers pick <b>Overtime</b> automatically on weekends and outside working hours, and <b>Holiday</b> on public holidays.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1 text-left">Grade</th>
                {RATE_TYPES.map((t) => <th key={t} colSpan={2} className="px-2 py-1 text-center">{t}</th>)}
              </tr>
              <tr className="text-[10px] text-slate-400">
                <th />
                {RATE_TYPES.map((t) => (
                  <React.Fragment key={t}><th className="px-2 pb-1 font-normal">cost</th><th className="px-2 pb-1 font-normal">sell</th></React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {grades.map((g) => (
                <tr key={g}>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 dark:text-slate-100">{g}</td>
                  {RATE_TYPES.map((t) => {
                    const c = cell(g, t);
                    return (
                      <React.Fragment key={t}>
                        <td className="px-1 py-1"><RateInput value={c?.cost_rate} disabled={!canRates} onChange={(v) => setCell(g, t, 'cost_rate', v)} /></td>
                        <td className="px-1 py-1"><RateInput value={c?.sell_rate} disabled={!canRates} onChange={(v) => setCell(g, t, 'sell_rate', v)} strong /></td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canRates && (
          <div className="mt-3 flex items-center gap-2">
            <input value={newGrade} onChange={(e) => setNewGrade(e.target.value)} placeholder="Add a grade (e.g. Chiller Specialist)" className="enterprise-input w-64" />
            <button
              disabled={!newGrade.trim() || grades.includes(newGrade.trim())}
              onClick={() => {
                const rows = RATE_TYPES.map((t) => ({ ...costingService.newRate(newGrade.trim(), t), effective_from: '2020-01-01' }));
                setRates((rs) => [...(rs || []), ...rows]);
                setDirty((d) => new Set([...d, ...rows.map((r) => r.id)]));
                setNewGrade('');
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-teal-700 disabled:opacity-40 dark:border-slate-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add grade
            </button>
          </div>
        )}

        {/* Trade-specific */}
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Trade-specific rates <span className="font-normal text-slate-500">— override the card above for one trade</span></h3>
            {canRates && (
              <button onClick={addTradeRate} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600"><Plus className="h-3.5 w-3.5" /> Add</button>
            )}
          </div>
          {tradeRates.length === 0 ? (
            <p className="text-[11px] text-slate-500">None. Every trade uses the company rates.</p>
          ) : (
            <div className="space-y-2">
              {tradeRates.map((r) => (
                <div key={r.id} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_90px_90px_130px_32px]">
                  <select value={r.trade_code || ''} disabled={!canRates} onChange={(e) => edit(r, { trade_code: e.target.value })} className="enterprise-input">
                    {trades.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
                  </select>
                  <select value={r.grade} disabled={!canRates} onChange={(e) => edit(r, { grade: e.target.value })} className="enterprise-input">
                    {grades.map((g) => <option key={g}>{g}</option>)}
                  </select>
                  <select value={r.rate_type} disabled={!canRates} onChange={(e) => edit(r, { rate_type: e.target.value as RateType })} className="enterprise-input">
                    {RATE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <RateInput value={r.cost_rate} disabled={!canRates} onChange={(v) => edit(r, { cost_rate: v })} placeholder="cost" />
                  <RateInput value={r.sell_rate} disabled={!canRates} onChange={(v) => edit(r, { sell_rate: v })} placeholder="sell" strong />
                  <input type="date" value={r.effective_from || ''} disabled={!canRates} onChange={(e) => edit(r, { effective_from: e.target.value })} title="Effective from" className="enterprise-input" />
                  {canRates && (
                    <button onClick={() => savedIds.has(r.id)
                      ? run('del' + r.id, () => costingService.deleteRate(r.id), 'Rate removed.')
                      : (setRates((rs) => (rs || []).filter((x) => x.id !== r.id)), setDirty((d) => { const n = new Set(d); n.delete(r.id); return n; }))} className="p-1 text-slate-400 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Defaults */}
        <div className="enterprise-card space-y-4 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ocs-blue dark:text-white"><Percent className="h-4 w-4 text-orange-500" /> Markups & working hours</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Material markup %">
              <input type="number" step="0.5" value={settings.material_markup_pct} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, material_markup_pct: Number(e.target.value) })} className="enterprise-input" />
            </Field>
            <Field label="Subcontractor markup %">
              <input type="number" step="0.5" value={settings.subcontract_markup_pct} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, subcontract_markup_pct: Number(e.target.value) })} className="enterprise-input" />
            </Field>
            <Field label="Working day starts">
              <input type="time" value={settings.work_day_start} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, work_day_start: e.target.value })} className="enterprise-input" />
            </Field>
            <Field label="Working day ends">
              <input type="time" value={settings.work_day_end} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, work_day_end: e.target.value })} className="enterprise-input" />
            </Field>
          </div>
          <Field label="Weekend (overtime all day)">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(([n, label]) => {
                const on = settings.weekend_days.includes(n);
                return (
                  <button
                    key={n}
                    disabled={!isAdmin}
                    onClick={() => setSettings({ ...settings, weekend_days: on ? settings.weekend_days.filter((d) => d !== n) : [...settings.weekend_days, n].sort() })}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${on ? 'border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={settings.bill_travel} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, bill_travel: e.target.checked })} className="h-4 w-4 accent-teal-600" />
            Charge travel time to the client (otherwise travel is cost only)
          </label>
          {isAdmin ? (
            <button onClick={() => run('settings', () => costingService.saveSettings(settings), 'Costing defaults saved.')} disabled={busy === 'settings'} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
              {busy === 'settings' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save defaults
            </button>
          ) : (
            <p className="text-[11px] text-slate-500">Only an admin can change these.</p>
          )}
          <p className="text-[11px] text-slate-500">A contract's own markup, when set, is used for materials on that contract's jobs.</p>
        </div>

        {/* Holidays */}
        <div className="enterprise-card space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ocs-blue dark:text-white"><CalendarX2 className="h-4 w-4 text-orange-500" /> Public holidays</h2>
          <p className="text-[11px] text-slate-500">Time worked on these days is priced at the Holiday rate.</p>
          {canRates && (
            <div className="flex gap-2">
              <input type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} className="enterprise-input w-auto" />
              <input value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} placeholder="e.g. Eid Al Adha" className="enterprise-input" />
              <button
                disabled={!hol.date || !hol.name.trim() || busy === 'hol'}
                onClick={() => run('hol', async () => { await costingService.addHoliday({ holiday_date: hol.date, name: hol.name.trim() }); setHol({ date: '', name: '' }); }, 'Holiday added.')}
                className="rounded-lg bg-teal-600 px-3 text-white disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {holidays.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No holidays added yet.</p>}
            {holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2 text-xs">
                <span>
                  <b className="text-slate-800 dark:text-slate-100">{new Date(`${h.holiday_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</b>
                  <span className="ml-2 text-slate-500">{h.name}</span>
                </span>
                {isAdmin && (
                  <button onClick={() => run('hdel', () => costingService.removeHoliday(h.id), 'Holiday removed.')} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RateInput: React.FC<{ value?: number; onChange: (v: number) => void; disabled?: boolean; strong?: boolean; placeholder?: string }> = ({ value, onChange, disabled, strong, placeholder }) => (
  <input
    type="number"
    min="0"
    step="0.25"
    value={value ?? ''}
    placeholder={placeholder || '—'}
    disabled={disabled}
    onChange={(e) => onChange(Number(e.target.value) || 0)}
    className={`enterprise-input px-2 py-1.5 text-right ${strong ? 'font-semibold text-ocs-blue dark:text-white' : ''}`}
  />
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);
