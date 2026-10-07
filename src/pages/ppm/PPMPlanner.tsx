import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import { FREQUENCIES, PpmPlan, VISIT_META, VisitState, ppmService, visitState, visitsBetween } from '../../api/ppm';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { WorkOrder } from '../../types';

/**
 * Yearly PPM planner: one row per plan, one column per month, every visit
 * shown on its day and coloured by what actually happened. The same picture
 * as the annual PPM spreadsheet, but live.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Visit {
  date: string;
  state: VisitState;
  job?: WorkOrder;
}

export const PPMPlanner: React.FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [plans, setPlans] = useState<PpmPlan[] | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [query, setQuery] = useState('');
  const [building, setBuilding] = useState('');
  const [freq, setFreq] = useState('');

  useEffect(() => {
    Promise.all([ppmService.plans(), ppmService.jobs(), hierarchyService.loadAll()]).then(([p, j, hier]) => {
      setPlans(p);
      setJobs(j);
      setH(hier);
    });
  }, []);

  const rows = useMemo(() => {
    if (!plans || !h) return [];
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const q = query.trim().toLowerCase();
    return plans
      .filter((p) => p.is_active !== false || jobs.some((j) => j.ppm_plan_id === p.id && j.ppm_due_date?.startsWith(String(year))))
      .filter((p) => !freq || p.frequency === freq)
      .filter((p) => {
        const asset = h.assets.find((a) => a.id === p.asset_id);
        const bId = p.building_id || asset?.building_id;
        if (building && bId !== building) return false;
        return !q || `${p.ppm_code} ${p.title} ${asset?.asset_number || ''}`.toLowerCase().includes(q);
      })
      .map((p) => {
        const created = (p.created_at || p.start_date).slice(0, 10);
        const planned = visitsBetween(p, from, to);
        const actual = jobs.filter((j) => j.ppm_plan_id === p.id && j.ppm_due_date && j.ppm_due_date >= from && j.ppm_due_date <= to);
        // Jobs whose due date is off the plan's rhythm (plan edited later) still show.
        const dates = [...new Set([...planned, ...actual.map((j) => j.ppm_due_date!)])].sort();
        const visits: Visit[] = dates
          // Visits before the plan existed were never expected.
          .filter((d) => d >= created || actual.some((j) => j.ppm_due_date === d))
          .map((d) => {
            const job = actual.find((j) => j.ppm_due_date === d);
            return { date: d, job, state: visitState(d, job) };
          });
        return { plan: p, visits };
      });
  }, [plans, jobs, h, year, query, building, freq]);

  const totals = useMemo(() => {
    const t = MONTHS.map(() => 0);
    const states: Record<VisitState, number> = { planned: 0, open: 0, overdue: 0, on_time: 0, late: 0, cancelled: 0 };
    rows.forEach((r) =>
      r.visits.forEach((v) => {
        t[Number(v.date.slice(5, 7)) - 1]++;
        states[v.state]++;
      })
    );
    return { perMonth: t, states };
  }, [rows]);

  const exportExcel = () => {
    const header = ['PPM code', 'Title', 'Frequency', ...MONTHS, 'Visits'];
    const data = rows.map((r) => {
      const perMonth = MONTHS.map((_, m) =>
        r.visits.filter((v) => Number(v.date.slice(5, 7)) - 1 === m).map((v) => `${Number(v.date.slice(8))} ${VISIT_META[v.state].label}`).join('; ')
      );
      return [r.plan.ppm_code, r.plan.title, r.plan.frequency, ...perMonth, r.visits.length];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 12 }, ...MONTHS.map(() => ({ wch: 16 })), { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `PPM ${year}`);
    XLSX.writeFile(wb, `OCS_PPM_Planner_${year}.xlsx`);
  };

  if (!plans || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading planner…
      </div>
    );
  }

  const thisMonth = new Date().getFullYear() === year ? new Date().getMonth() : -1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">PPM Planner</h1>
          <p className="text-xs text-slate-500">Every planned visit for the year, coloured by what actually happened.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button onClick={() => setYear((y) => y - 1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-2 text-sm font-bold text-ocs-blue dark:text-white">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} className="p-2 text-slate-500 hover:text-slate-800"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={exportExcel} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <FileSpreadsheet className="h-4 w-4" /> Export
          </button>
          <Link to="/ppm/plans" className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">Manage plans</Link>
        </div>
      </div>

      {/* Legend + counts */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(VISIT_META) as VisitState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
            <span className={`inline-block h-3 w-3 rounded ${VISIT_META[s].cls}`} /> {VISIT_META[s].label} · {totals.states[s]}
          </span>
        ))}
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plan or asset…" className="enterprise-input pl-8" />
          </div>
          <select value={building} onChange={(e) => setBuilding(e.target.value)} className="enterprise-input w-auto">
            <option value="">All buildings</option>
            {h.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className="enterprise-input w-auto">
            <option value="">All frequencies</option>
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No PPM plans for {year}. <Link to="/ppm/plans" className="font-semibold text-teal-600">Create a plan</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                  <th className="sticky left-0 z-10 w-64 bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">Plan</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} className={`px-1 py-2 text-center ${i === thisMonth ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10' : ''}`}>
                      {m}
                      <div className="font-normal normal-case text-slate-400">{totals.perMonth[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map(({ plan, visits }) => (
                  <tr key={plan.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-900">
                      <div className="font-mono text-[10px] text-slate-500">{plan.ppm_code} · {plan.frequency}</div>
                      <div className="truncate font-semibold text-slate-800 dark:text-slate-100" title={plan.title}>{plan.title}</div>
                    </td>
                    {MONTHS.map((_, m) => {
                      const vs = visits.filter((v) => Number(v.date.slice(5, 7)) - 1 === m);
                      return (
                        <td key={m} className={`px-1 py-2 text-center align-middle ${m === thisMonth ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''}`}>
                          <div className="flex flex-wrap justify-center gap-0.5">
                            {vs.map((v) => {
                              const chip = (
                                <span
                                  title={`${new Date(`${v.date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${VISIT_META[v.state].label}${v.job ? ` (${v.job.wo_number})` : ''}`}
                                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded px-1 text-[10px] font-bold ${VISIT_META[v.state].cls}`}
                                >
                                  {Number(v.date.slice(8))}
                                </span>
                              );
                              return v.job ? <Link key={v.date} to={`/work-orders/${v.job.id}`}>{chip}</Link> : <span key={v.date}>{chip}</span>;
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
