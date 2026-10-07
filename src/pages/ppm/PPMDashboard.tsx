import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { PpmPlan, VISIT_META, VisitState, ppmService, visitState, visitsBetween } from '../../api/ppm';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { cafmDataService } from '../../api/supabase';
import { Category, WorkOrder } from '../../types';

/**
 * PPM compliance: of the visits that were due, how many were done on time,
 * done late, or are still outstanding. Visits are judged by their due date;
 * "done" means the technician marked the work done.
 */

type Period = 'month' | 'quarter' | 'ytd' | '12m';
const PERIODS: { id: Period; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'ytd', label: 'Year to date' },
  { id: '12m', label: 'Last 12 months' },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

const range = (p: Period): [string, string] => {
  const now = new Date();
  const today = iso(new Date(now.getTime() + 4 * 3600_000));
  const y = now.getFullYear();
  if (p === 'month') return [`${today.slice(0, 7)}-01`, today];
  if (p === 'quarter') return [iso(new Date(Date.UTC(y, Math.floor(now.getMonth() / 3) * 3, 1))), today];
  if (p === 'ytd') return [`${y}-01-01`, today];
  return [iso(new Date(Date.UTC(y - 1, now.getMonth(), now.getDate() + 1))), today];
};

interface Row {
  plan: PpmPlan;
  date: string;
  state: VisitState;
  job?: WorkOrder;
  building?: string;
  category?: string;
}

export const PPMDashboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [plans, setPlans] = useState<PpmPlan[] | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([ppmService.plans(), ppmService.jobs(), hierarchyService.loadAll(), cafmDataService.getCategories()]).then(([p, j, hier, c]) => {
      setPlans(p);
      setJobs(j);
      setH(hier);
      setCategories(c);
    });
  }, []);

  const data = useMemo(() => {
    if (!plans || !h) return null;
    const [from, to] = range(period);
    const rows: Row[] = [];
    plans.forEach((p) => {
      const created = (p.created_at || p.start_date).slice(0, 10);
      const actual = jobs.filter((j) => j.ppm_plan_id === p.id && j.ppm_due_date && j.ppm_due_date >= from && j.ppm_due_date <= to);
      const planned = p.is_active === false ? [] : visitsBetween(p, from, to).filter((d) => d >= created);
      const dates = [...new Set([...planned, ...actual.map((j) => j.ppm_due_date!)])];
      const asset = h.assets.find((a) => a.id === p.asset_id);
      const bId = p.building_id || asset?.building_id;
      dates.forEach((d) => {
        const job = actual.find((j) => j.ppm_due_date === d);
        rows.push({
          plan: p,
          date: d,
          job,
          state: visitState(d, job),
          building: h.buildings.find((b) => b.id === bId)?.name || 'No building',
          category: categories.find((c) => c.id === (p.category_id || asset?.category_id))?.name || 'Other',
        });
      });
    });
    const counted = rows.filter((r) => r.state !== 'cancelled' && r.state !== 'planned' && r.state !== 'open');
    const onTime = counted.filter((r) => r.state === 'on_time').length;
    const late = counted.filter((r) => r.state === 'late').length;
    const missed = counted.filter((r) => r.state === 'overdue').length;
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

    const group = (key: 'building' | 'category') => {
      const m = new Map<string, { due: number; onTime: number; late: number; missed: number }>();
      counted.forEach((r) => {
        const k = r[key] || '—';
        const g = m.get(k) || { due: 0, onTime: 0, late: 0, missed: 0 };
        g.due++;
        if (r.state === 'on_time') g.onTime++;
        if (r.state === 'late') g.late++;
        if (r.state === 'overdue') g.missed++;
        m.set(k, g);
      });
      return [...m.entries()].map(([name, g]) => ({ name, ...g, pct: pct(g.onTime, g.due) })).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
    };

    // Coming up regardless of period: next 14 days.
    const today = range('month')[1];
    const in14 = iso(new Date(new Date(`${today}T00:00:00Z`).getTime() + 14 * 86_400_000));
    const upcoming: Row[] = [];
    plans.filter((p) => p.is_active !== false).forEach((p) => {
      visitsBetween(p, today, in14).forEach((d) => {
        const job = jobs.find((j) => j.ppm_plan_id === p.id && j.ppm_due_date === d);
        upcoming.push({ plan: p, date: d, job, state: visitState(d, job) });
      });
    });

    return {
      due: counted.length,
      onTime,
      late,
      missed,
      compliance: pct(onTime, counted.length),
      completion: pct(onTime + late, counted.length),
      byBuilding: group('building'),
      byCategory: group('category'),
      overdue: rows.filter((r) => r.state === 'overdue').sort((a, b) => a.date.localeCompare(b.date)),
      upcoming: upcoming.filter((r) => r.state !== 'on_time' && r.state !== 'late').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12),
    };
  }, [plans, jobs, h, categories, period]);

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading compliance…
      </div>
    );
  }

  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const tone = (p: number | null) => (p == null ? 'text-slate-400' : p >= 95 ? 'text-emerald-600' : p >= 85 ? 'text-orange-500' : 'text-ocs-red');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">PPM Compliance</h1>
          <p className="text-xs text-slate-500">Of the PPM visits due so far in the period: done on time, done late, or still not done.</p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${period === p.id ? 'bg-ocs-blue text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <div className="enterprise-card p-4 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Compliance</div>
          <div className={`text-3xl font-bold ${tone(data.compliance)}`}>{data.compliance == null ? '—' : `${data.compliance}%`}</div>
          <div className="text-[11px] text-slate-500">done on time</div>
        </div>
        <Stat icon={CalendarDays} label="Visits due" value={data.due} tone="text-ocs-blue dark:text-white" />
        <Stat icon={CheckCircle2} label="On time" value={data.onTime} tone="text-emerald-600" />
        <Stat icon={Clock} label="Late" value={data.late} tone="text-orange-500" />
        <Stat icon={AlertTriangle} label="Not done (overdue)" value={data.missed} tone="text-ocs-red" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="By building" rows={data.byBuilding} tone={tone} />
        <Breakdown title="By trade" rows={data.byCategory} tone={tone} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <VisitList title={`Overdue PPM (${data.overdue.length})`} rows={data.overdue} fmt={fmt} empty="Nothing overdue." />
        <VisitList title="Next 14 days" rows={data.upcoming} fmt={fmt} empty="No PPM due in the next 14 days." />
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ElementType; label: string; value: number; tone: string }> = ({ icon: Icon, label, value, tone }) => (
  <div className="enterprise-card flex items-center gap-3 p-4">
    <Icon className={`h-5 w-5 ${tone}`} />
    <div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  </div>
);

const Breakdown: React.FC<{
  title: string;
  rows: { name: string; due: number; onTime: number; late: number; missed: number; pct: number | null }[];
  tone: (p: number | null) => string;
}> = ({ title, rows, tone }) => (
  <div className="enterprise-card p-4">
    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    {rows.length === 0 ? (
      <p className="py-6 text-center text-xs text-slate-500">No visits due in this period.</p>
    ) : (
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{r.name}</span>
              <span className={`font-bold ${tone(r.pct)}`}>{r.pct}% <span className="font-normal text-slate-400">of {r.due}</span></span>
            </div>
            <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="bg-emerald-500" style={{ width: `${(r.onTime / r.due) * 100}%` }} />
              <div className="bg-orange-500" style={{ width: `${(r.late / r.due) * 100}%` }} />
              <div className="bg-ocs-red" style={{ width: `${(r.missed / r.due) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const VisitList: React.FC<{ title: string; rows: Row[]; fmt: (d: string) => string; empty: string }> = ({ title, rows, fmt, empty }) => (
  <div className="enterprise-card p-4">
    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    {rows.length === 0 ? (
      <p className="py-6 text-center text-xs text-slate-500">{empty}</p>
    ) : (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.slice(0, 15).map((r) => {
          const body = (
            <div className="flex items-center gap-3 py-2 text-xs">
              <span className={`inline-flex h-6 w-14 shrink-0 items-center justify-center rounded text-[10px] font-bold ${VISIT_META[r.state].cls}`}>{fmt(r.date)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{r.plan.title}</span>
                <span className="text-[10px] text-slate-500">{r.plan.ppm_code} · {r.plan.frequency}{r.job ? ` · ${r.job.wo_number}` : ' · job not created yet'}</span>
              </span>
            </div>
          );
          return r.job ? <Link key={r.plan.id + r.date} to={`/work-orders/${r.job.id}`} className="block hover:bg-slate-50 dark:hover:bg-slate-800/40">{body}</Link> : <div key={r.plan.id + r.date}>{body}</div>;
        })}
      </div>
    )}
  </div>
);
