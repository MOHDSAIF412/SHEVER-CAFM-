import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, Search } from 'lucide-react';
import { aed, costingService } from '../../api/costing';
import { cafmDataService } from '../../api/supabase';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { JobCosting, WorkOrder } from '../../types';
import { WO_TYPES, statusMeta } from '../../utils/woFlow';
import { useAuth } from '../../context/AuthContext';

/**
 * Job costing across work orders: what each job cost, what it is worth to
 * the client, and the margin. Chargeable jobs are what gets invoiced; contract
 * jobs show their cost so overruns are visible.
 */

type Period = 'month' | 'last_month' | 'quarter' | 'ytd' | 'all';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'all', label: 'All time' },
];

const since = (p: Period): [Date | null, Date | null] => {
  const n = new Date();
  if (p === 'month') return [new Date(n.getFullYear(), n.getMonth(), 1), null];
  if (p === 'last_month') return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 1)];
  if (p === 'quarter') return [new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1), null];
  if (p === 'ytd') return [new Date(n.getFullYear(), 0, 1), null];
  return [null, null];
};

interface Row {
  wo: WorkOrder;
  c: JobCosting;
  building: string;
  margin: number;
  pct: number | null;
}

export const JobCostingReport: React.FC = () => {
  const { isAdmin, isManager, isSupervisor } = useAuth();
  if (!(isAdmin || isManager || isSupervisor)) {
    return <div className="py-20 text-center text-sm text-slate-500">Job costing is available to supervisors and managers.</div>;
  }
  return <JobCostingView />;
};

const JobCostingView: React.FC = () => {
  const [wos, setWos] = useState<WorkOrder[] | null>(null);
  const [costs, setCosts] = useState<Map<string, JobCosting>>(new Map());
  const [h, setH] = useState<Hierarchy | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [type, setType] = useState('');
  const [chargeable, setChargeable] = useState<'' | 'yes' | 'no'>('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [w, hier] = await Promise.all([cafmDataService.getWorkOrders(), hierarchyService.loadAll()]);
        setH(hier);
        setCosts(await costingService.allTotals(w));
        setWos(w);
      } catch (e: any) {
        setError(e?.message || 'Could not load job costs.');
        setWos([]);
      }
    })();
  }, []);

  const rows: Row[] = useMemo(() => {
    if (!wos || !h) return [];
    const [from, to] = since(period);
    const s = q.trim().toLowerCase();
    return wos
      .filter((w) => costs.has(w.id))
      .filter((w) => {
        const d = new Date(w.work_done_at || w.created_at);
        return (!from || d >= from) && (!to || d < to);
      })
      .filter((w) => !type || (w.wo_type || 'Reactive') === type)
      .filter((w) => !chargeable || (chargeable === 'yes') === !!w.is_chargeable)
      .filter((w) => !s || `${w.wo_number} ${w.problem_description}`.toLowerCase().includes(s))
      .map((w) => {
        const c = costs.get(w.id)!;
        const margin = c.total_sell - c.total_cost;
        return { wo: w, c, building: h.buildings.find((b) => b.id === w.building_id)?.name || '—', margin, pct: c.total_sell > 0 ? Math.round((margin / c.total_sell) * 100) : null };
      })
      .sort((a, b) => (b.wo.created_at || '').localeCompare(a.wo.created_at || ''));
  }, [wos, costs, h, period, type, chargeable, q]);

  const tot = useMemo(() => {
    const t = { labour: 0, material: 0, sub: 0, cost: 0, sell: 0, billable: 0 };
    rows.forEach(({ wo, c }) => {
      t.labour += c.labour_cost;
      t.material += c.material_cost;
      t.sub += c.subcontract_cost;
      t.cost += c.total_cost;
      t.sell += c.total_sell;
      if (wo.is_chargeable) t.billable += c.total_sell;
    });
    return t;
  }, [rows]);

  const exportExcel = () => {
    const data = rows.map(({ wo, c, building, margin, pct }) => ({
      'WO number': wo.wo_number,
      Date: (wo.work_done_at || wo.created_at || '').slice(0, 10),
      Type: wo.wo_type || 'Reactive',
      Building: building,
      Status: statusMeta(wo.status).label,
      Chargeable: wo.is_chargeable ? 'Yes' : 'No',
      'Billing status': wo.billing_status || '',
      'Labour cost': c.labour_cost,
      'Material cost': c.material_cost,
      'Subcontract cost': c.subcontract_cost,
      'Total cost': c.total_cost,
      'Call-out fee': c.callout_fee,
      'Minimum charge': c.minimum_charge,
      Discount: c.discount,
      'Total sell (AED, before VAT)': c.total_sell,
      Margin: margin,
      'Margin %': pct ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Job costing');
    XLSX.writeFile(wb, `OCS_Job_Costing_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!wos || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading job costs…
      </div>
    );
  }

  const marginAll = tot.sell - tot.cost;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Job Costing</h1>
          <p className="text-xs text-slate-500">Cost, charge and margin per job, in AED (before VAT). Dated by work-done date.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {PERIODS.map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${period === p.id ? 'bg-ocs-blue text-white' : 'text-slate-600 dark:text-slate-300'}`}>{p.label}</button>
            ))}
          </div>
          <button onClick={exportExcel} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FileSpreadsheet className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Jobs costed" value={String(rows.length)} />
        <Kpi label="Total cost" value={aed(tot.cost, 0)} sub={`Labour ${aed(tot.labour, 0)} · Materials ${aed(tot.material, 0)} · Subcon ${aed(tot.sub, 0)}`} />
        <Kpi label="Total value" value={aed(tot.sell, 0)} tone="text-ocs-blue dark:text-white" />
        <Kpi label="Chargeable (to bill)" value={aed(tot.billable, 0)} tone="text-orange-600" />
        <Kpi label="Margin" value={aed(marginAll, 0)} sub={tot.sell ? `${Math.round((marginAll / tot.sell) * 100)}% of value` : undefined} tone={marginAll < 0 ? 'text-ocs-red' : 'text-emerald-600'} />
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search WO number or description…" className="enterprise-input pl-8" />
          </div>
          <select value={type} onChange={(e) => setType(e.target.value)} className="enterprise-input w-auto">
            <option value="">All types</option>
            {WO_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={chargeable} onChange={(e) => setChargeable(e.target.value as '' | 'yes' | 'no')} className="enterprise-input w-auto">
            <option value="">Chargeable + contract</option>
            <option value="yes">Chargeable only</option>
            <option value="no">Contract only</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Building</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Labour</th>
                <th className="px-3 py-2 text-right">Materials</th>
                <th className="px-3 py-2 text-right">Subcon</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-12 text-center text-slate-500">No costed jobs in this period. Costs appear once time, materials or charges are recorded on a job.</td></tr>
              )}
              {rows.map(({ wo, c, building, margin, pct }) => {
                const sm = statusMeta(wo.status);
                return (
                  <tr key={wo.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <Link to={`/work-orders/${wo.id}`} className="font-mono font-semibold text-teal-700 hover:underline dark:text-teal-300">{wo.wo_number}</Link>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        {wo.wo_type || 'Reactive'}
                        {wo.is_chargeable && <span className="rounded bg-orange-50 px-1 font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">Chargeable</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{building}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.pill}`}>{sm.label}</span></td>
                    <td className="px-3 py-2 text-right">{aed(c.labour_cost)}</td>
                    <td className="px-3 py-2 text-right">{aed(c.material_cost)}</td>
                    <td className="px-3 py-2 text-right">{aed(c.subcontract_cost)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{aed(c.total_cost)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ocs-blue dark:text-white">{aed(c.total_sell)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${margin < 0 ? 'text-ocs-red' : 'text-emerald-600'}`}>
                      {aed(margin)}
                      {pct != null && <div className="text-[10px] font-normal text-slate-500">{pct}%</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: string; sub?: string; tone?: string }> = ({ label, value, sub, tone = 'text-slate-800 dark:text-slate-100' }) => (
  <div className="enterprise-card p-4">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xl font-bold ${tone}`}>{value}</div>
    {sub && <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>}
  </div>
);
