import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle, CalendarCheck2, CheckCheck, ClipboardList, Clock, Gauge, Loader2, PauseCircle, Plus, Receipt, ShieldCheck, UserX,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { workOrderService, ServiceMatrix } from '../../api/workOrders';
import { visitState } from '../../api/ppm';
import { billingService, jobBillAmount } from '../../api/billing';
import { aed, costingService } from '../../api/costing';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SLA_STYLES, getSlaStatus } from '../../utils/sla';
import { PRIORITY_META, isOpen, normaliseStatus, priorityOf, statusMeta } from '../../utils/woFlow';
import { WorkOrder } from '../../types';

/**
 * Operations dashboard, built on the live work-order model:
 * what is open, what is late, what needs a decision, PPM due, and money
 * waiting to be billed. Technicians see their own jobs first.
 */

const DAY = 86_400_000;
const uaeDate = (d = new Date()) => new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 10);

export const Dashboard: React.FC = () => {
  const { user, role, isAdmin, isManager, isSupervisor } = useAuth();
  const { isDark } = useTheme();
  const lead = isAdmin || isManager || isSupervisor;
  const isTech = role === 'technician';

  const [wos, setWos] = useState<WorkOrder[] | null>(null);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [matrix, setMatrix] = useState<ServiceMatrix | null>(null);
  const [toBill, setToBill] = useState<number | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    Promise.all([cafmDataService.getWorkOrders(), hierarchyService.loadAll(), workOrderService.serviceMatrix()]).then(async ([w, hier, m]) => {
      setWos(w);
      setH(hier);
      setMatrix(m);
      if (lead) {
        const jobs = w.filter((x) => x.is_chargeable && x.billing_status === 'To Bill');
        const [totals, quotes] = await Promise.all([costingService.allTotals(jobs), billingService.quotes()]);
        setToBill(jobs.reduce((a, j) => a + jobBillAmount(j, totals, quotes), 0));
      }
    });
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [lead]);

  const d = useMemo(() => {
    if (!wos) return null;
    const scope = isTech ? wos.filter((w) => w.assigned_technician_id === user?.id) : wos;
    const s = (w: WorkOrder) => normaliseStatus(w.status);
    const open = scope.filter((w) => isOpen(w.status));
    const overdue = open.filter((w) => getSlaStatus(w, now).state === 'breached');

    // SLA met: jobs finished (work done) in the last 30 days, fixed by their deadline.
    const since = now.getTime() - 30 * DAY;
    const finished = scope.filter((w) => w.work_done_at && new Date(w.work_done_at).getTime() >= since && w.resolution_due_at);
    const met = finished.filter((w) => new Date(w.work_done_at!) <= new Date(w.resolution_due_at!));
    const respondFinished = scope.filter((w) => w.arrived_at && new Date(w.arrived_at).getTime() >= since && w.response_due_at);
    const respondMet = respondFinished.filter((w) => new Date(w.arrived_at!) <= new Date(w.response_due_at!));

    // PPM this month: visits due so far this month.
    const today = uaeDate(now);
    const monthStart = `${today.slice(0, 7)}-01`;
    const ppmDue = scope.filter((w) => w.wo_type === 'PPM' && w.ppm_due_date && w.ppm_due_date >= monthStart && w.ppm_due_date <= today);
    const ppmStates = ppmDue.map((w) => visitState(w.ppm_due_date!, w));
    const ppmCounted = ppmStates.filter((x) => x !== 'cancelled' && x !== 'open');
    const ppmOnTime = ppmStates.filter((x) => x === 'on_time').length;
    const ppmWeek = scope
      .filter((w) => w.wo_type === 'PPM' && w.ppm_due_date && w.ppm_due_date >= today && w.ppm_due_date <= uaeDate(new Date(now.getTime() + 7 * DAY)) && isOpen(w.status))
      .sort((a, b) => a.ppm_due_date!.localeCompare(b.ppm_due_date!));

    // Needs attention, most urgent first.
    const rank = (w: WorkOrder) => {
      const st = getSlaStatus(w, now);
      return (st.state === 'breached' ? 0 : st.state === 'critical' ? 1 : priorityOf(w) === 'P1' ? 2 : s(w) === 'New' ? 3 : st.state === 'warning' ? 4 : 9) * 1e13 + (st.msRemaining || 0);
    };
    const attention = [
      ...open.filter((w) => {
        const st = getSlaStatus(w, now).state;
        return st === 'breached' || st === 'critical' || st === 'warning' || priorityOf(w) === 'P1' || s(w) === 'New';
      }),
    ].sort((a, b) => rank(a) - rank(b));

    // Last 14 days: raised vs work done.
    const days = Array.from({ length: 14 }, (_, i) => {
      const dt = new Date(now.getTime() - (13 - i) * DAY);
      return { key: uaeDate(dt), label: dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), Raised: 0, Done: 0 };
    });
    scope.forEach((w) => {
      const r = days.find((x) => x.key === uaeDate(new Date(w.created_at)));
      if (r) r.Raised++;
      if (w.work_done_at) {
        const dn = days.find((x) => x.key === uaeDate(new Date(w.work_done_at!)));
        if (dn) dn.Done++;
      }
    });

    // Open jobs by trade.
    const byTrade = new Map<string, number>();
    open.forEach((w) => {
      const job = matrix?.jobs.find((j) => j.id === w.job_type_id);
      const t = matrix?.types.find((x) => x.id === job?.service_type_id)?.name || w.category?.name || (w.wo_type === 'PPM' ? 'PPM' : 'Other');
      byTrade.set(t, (byTrade.get(t) || 0) + 1);
    });

    return {
      open,
      newCount: open.filter((w) => s(w) === 'New').length,
      inProgress: open.filter((w) => s(w) === 'In Progress' || s(w) === 'Assigned').length,
      onHold: open.filter((w) => s(w) === 'On Hold').length,
      verify: scope.filter((w) => s(w) === 'Work Done').length,
      overdue,
      slaPct: finished.length ? Math.round((met.length / finished.length) * 100) : null,
      slaN: finished.length,
      respPct: respondFinished.length ? Math.round((respondMet.length / respondFinished.length) * 100) : null,
      ppmPct: ppmCounted.length ? Math.round((ppmOnTime / ppmCounted.length) * 100) : null,
      ppmN: ppmCounted.length,
      ppmWeek,
      attention,
      days,
      byTrade: [...byTrade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      mine: wos.filter((w) => w.assigned_technician_id === user?.id && isOpen(w.status)).sort((a, b) => rank(a) - rank(b)),
    };
  }, [wos, now, isTech, user, matrix]);

  if (!d || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const pctTone = (p: number | null) => (p == null ? 'text-slate-400' : p >= 95 ? 'text-emerald-600' : p >= 85 ? 'text-orange-500' : 'text-ocs-red');
  const maxTrade = Math.max(1, ...d.byTrade.map(([, n]) => n));
  const empty = wos!.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ocs-blue dark:text-white">{greet}, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-xs text-slate-500">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {isTech ? ' · your jobs' : ' · all jobs'}
          </p>
        </div>
        <Link to="/work-orders/new" className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600">
          <Plus className="h-4 w-4" /> New work order
        </Link>
      </div>

      {empty && lead && (
        <div className="enterprise-card p-5 text-sm">
          <h2 className="font-bold text-ocs-blue dark:text-white">Getting started</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            <li><Link to="/facilities" className="font-semibold text-teal-600">Set up facilities, buildings, floors and rooms</Link> (or import them from Excel).</li>
            <li><Link to="/assets" className="font-semibold text-teal-600">Register equipment</Link> in its room.</li>
            <li><Link to="/users" className="font-semibold text-teal-600">Add technicians</Link> with their trade and grade.</li>
            <li><Link to="/ppm/plans" className="font-semibold text-teal-600">Create PPM plans</Link> — the jobs then appear automatically.</li>
          </ol>
        </div>
      )}

      {isTech && (
        <div className="enterprise-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><ClipboardList className="h-4 w-4 text-orange-500" /> My open jobs ({d.mine.length})</h2>
            <Link to="/work-orders?mine=1" className="text-xs font-semibold text-teal-600">All my jobs</Link>
          </div>
          <JobList rows={d.mine.slice(0, 15)} h={h} now={now} matrix={matrix} empty="No open jobs assigned to you." />
        </div>
      )}

      {/* KPIs */}
      {isTech ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi to="/work-orders?mine=1" icon={ClipboardList} label="My open jobs" value={d.mine.length} tone="text-ocs-blue dark:text-white" />
          <Kpi to="/work-orders?mine=1&overdue=1" icon={AlertTriangle} label="Overdue" value={d.overdue.length} tone={d.overdue.length ? 'text-ocs-red' : 'text-slate-400'} />
          <Kpi to="/ppm/planner" icon={CalendarCheck2} label="PPM next 7 days" value={d.ppmWeek.length} tone="text-ocs-blue dark:text-white" />
          <Kpi to="/work-orders?mine=1" icon={ShieldCheck} label="Fixed on time (30d)" value={d.slaPct == null ? '—' : `${d.slaPct}%`} sub={d.slaN ? `${d.slaN} jobs` : 'no jobs done yet'} tone={pctTone(d.slaPct)} />
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi to="/work-orders?status=New" icon={UserX} label="New / unassigned" value={d.newCount} tone={d.newCount ? 'text-orange-600' : 'text-slate-400'} />
        <Kpi to="/work-orders?status=In%20Progress" icon={ClipboardList} label="Assigned / working" value={d.inProgress} tone="text-ocs-blue dark:text-white" />
        <Kpi to="/work-orders?status=On%20Hold" icon={PauseCircle} label="On hold" value={d.onHold} tone="text-sky-500" />
        <Kpi to="/work-orders?overdue=1" icon={AlertTriangle} label="Overdue" value={d.overdue.length} tone={d.overdue.length ? 'text-ocs-red' : 'text-slate-400'} />
        <Kpi to="/work-orders?status=Work%20Done" icon={CheckCheck} label="To verify" value={d.verify} tone="text-violet-500" />
        <Kpi to="/reports" icon={ShieldCheck} label="Fix SLA (30d)" value={d.slaPct == null ? '—' : `${d.slaPct}%`} sub={d.slaN ? `${d.slaN} jobs · respond ${d.respPct ?? '—'}%` : 'no jobs done yet'} tone={pctTone(d.slaPct)} />
        <Kpi to="/ppm/dashboard" icon={Gauge} label="PPM this month" value={d.ppmPct == null ? '—' : `${d.ppmPct}%`} sub={d.ppmN ? `${d.ppmN} visits due` : 'no visits due yet'} tone={pctTone(d.ppmPct)} />
        {lead ? (
          <Kpi to="/billing" icon={Receipt} label="To bill" value={toBill == null ? '…' : aed(toBill, 0)} tone="text-orange-600" />
        ) : (
          <Kpi to="/ppm/planner" icon={CalendarCheck2} label="PPM next 7 days" value={d.ppmWeek.length} tone="text-ocs-blue dark:text-white" />
        )}
      </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        {/* Attention (leads) */}
        {!isTech && <div className="enterprise-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              {isTech ? <><ClipboardList className="h-4 w-4 text-orange-500" /> My open jobs ({d.mine.length})</> : <><AlertTriangle className="h-4 w-4 text-orange-500" /> Needs attention ({d.attention.length})</>}
            </h2>
            <Link to={isTech ? '/work-orders?mine=1' : '/work-orders'} className="text-xs font-semibold text-teal-600">All jobs</Link>
          </div>
          <JobList rows={(isTech ? d.mine : d.attention).slice(0, 10)} h={h} now={now} matrix={matrix} empty={isTech ? 'No open jobs assigned to you.' : 'Nothing urgent. All open jobs are on track.'} />
        </div>}

        {/* PPM this week */}
        <div className="enterprise-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><CalendarCheck2 className="h-4 w-4 text-orange-500" /> PPM due this week ({d.ppmWeek.length})</h2>
            <Link to="/ppm/planner" className="text-xs font-semibold text-teal-600">Planner</Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {d.ppmWeek.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">No PPM visits due in the next 7 days.</p>}
            {d.ppmWeek.slice(0, 8).map((w) => (
              <Link key={w.id} to={`/work-orders/${w.id}`} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <span className="w-14 shrink-0 rounded bg-sky-50 py-1 text-center text-[10px] font-bold text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                  {new Date(`${w.ppm_due_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{w.problem_description?.split(' — ')[0]}</span>
                  <span className="text-[10px] text-slate-500">{w.wo_number} · {statusMeta(w.status).label}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {!empty && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="enterprise-card p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Last 14 days — raised vs work done</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.days} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, background: isDark ? '#0f172a' : '#fff', border: '1px solid #e2e8f0' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Raised" fill="#293771" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Done" fill="#00AE4D" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="enterprise-card p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Open jobs by trade</h2>
            {d.byTrade.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No open jobs.</p>}
            <div className="space-y-2.5">
              {d.byTrade.map(([name, n]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700 dark:text-slate-200">{name}</span><span className="font-bold">{n}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-ocs-blue dark:bg-orange-500" style={{ width: `${(n / maxTrade) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ to: string; icon: React.ElementType; label: string; value: React.ReactNode; tone: string; sub?: string }> = ({ to, icon: Icon, label, value, tone, sub }) => (
  <Link to={to} className="enterprise-card block p-3 transition-shadow hover:shadow-md">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
    <div className={`mt-1 text-2xl font-bold ${tone}`}>{value}</div>
    {sub && <div className="truncate text-[10px] text-slate-500">{sub}</div>}
  </Link>
);

const JobList: React.FC<{ rows: WorkOrder[]; h: Hierarchy; now: Date; matrix: ServiceMatrix | null; empty: string }> = ({ rows, h, now, matrix, empty }) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-800">
    {rows.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-500">{empty}</p>}
    {rows.map((w) => {
      const st = getSlaStatus(w, now);
      const p = priorityOf(w);
      const job = matrix?.jobs.find((j) => j.id === w.job_type_id);
      return (
        <Link key={w.id} to={`/work-orders/${w.id}`} className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <span className={`w-8 shrink-0 rounded py-1 text-center text-[10px] font-bold ${PRIORITY_META[p].chip}`}>{p}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{job?.name || w.problem_description?.split('\n')[0]}</span>
            <span className="block truncate text-[10px] text-slate-500">{w.wo_number} · {roomPath(h, w.location_id).slice(-2).join(' / ') || '—'}</span>
          </span>
          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline ${statusMeta(w.status).pill}`}>{statusMeta(w.status).label}</span>
          <span className={`w-20 shrink-0 rounded px-1.5 py-1 text-center text-[10px] font-bold ${SLA_STYLES[st.state].chip}`}>
            {st.state === 'paused' ? <><Clock className="mr-0.5 inline h-3 w-3" />paused</> : st.short}
          </span>
        </Link>
      );
    })}
  </div>
);
