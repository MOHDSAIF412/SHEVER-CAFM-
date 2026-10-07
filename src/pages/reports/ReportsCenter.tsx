import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Boxes, FileSpreadsheet, FileText, Loader2, ShieldCheck, Users } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { ServiceMatrix, workOrderService } from '../../api/workOrders';
import { formatDuration } from '../../utils/sla';
import { FLOW, PRIORITY_META, WO_TYPES, normaliseStatus, priorityOf, statusMeta } from '../../utils/woFlow';
import { SlaPriority, UserProfile, WorkOrder } from '../../types';

/**
 * Reports & KPIs over a chosen period:
 *   Register      every job with its SLA outcome, exportable (Excel / PDF)
 *   SLA           response and fix performance by priority and building
 *   Technicians   jobs done, on-time rate, average fix time, client rating
 *   Assets        repeat faults: equipment with the most reactive jobs
 */

type Tab = 'register' | 'sla' | 'techs' | 'assets';
type Period = '7d' | '30d' | 'month' | 'last_month' | 'quarter' | 'ytd' | 'custom';

const PERIODS: [Period, string][] = [
  ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['last_month', 'Last month'], ['quarter', 'This quarter'], ['ytd', 'Year to date'], ['custom', 'Custom'],
];
const DAY = 86_400_000;
const PRIORITIES: SlaPriority[] = ['P1', 'P2', 'P3', 'P4'];

const range = (p: Period, from: string, to: string): [Date, Date] => {
  const n = new Date();
  const end = new Date(n.getTime() + DAY);
  if (p === '7d') return [new Date(n.getTime() - 7 * DAY), end];
  if (p === '30d') return [new Date(n.getTime() - 30 * DAY), end];
  if (p === 'month') return [new Date(n.getFullYear(), n.getMonth(), 1), end];
  if (p === 'last_month') return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 1)];
  if (p === 'quarter') return [new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1), end];
  if (p === 'ytd') return [new Date(n.getFullYear(), 0, 1), end];
  return [from ? new Date(`${from}T00:00:00`) : new Date(0), to ? new Date(new Date(`${to}T00:00:00`).getTime() + DAY) : end];
};

const met = (done?: string | null, due?: string | null) => (done && due ? new Date(done) <= new Date(due) : null);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export const ReportsCenter: React.FC = () => {
  const [wos, setWos] = useState<WorkOrder[] | null>(null);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [matrix, setMatrix] = useState<ServiceMatrix | null>(null);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [tab, setTab] = useState<Tab>('register');
  const [period, setPeriod] = useState<Period>('30d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [building, setBuilding] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [tech, setTech] = useState('');

  useEffect(() => {
    Promise.all([cafmDataService.getWorkOrders(), hierarchyService.loadAll(), workOrderService.serviceMatrix(), cafmDataService.getUsers()]).then(([w, hier, m, u]) => {
      setWos(w);
      setH(hier);
      setMatrix(m);
      setPeople(u);
    });
  }, []);

  const [start, end] = range(period, from, to);

  const rows = useMemo(() => {
    if (!wos) return [];
    return wos
      .filter((w) => {
        const c = new Date(w.created_at);
        return c >= start && c < end;
      })
      .filter((w) => !building || w.building_id === building)
      .filter((w) => !type || (w.wo_type || 'Reactive') === type)
      .filter((w) => !status || normaliseStatus(w.status) === status)
      .filter((w) => !priority || priorityOf(w) === priority)
      .filter((w) => !tech || w.assigned_technician_id === tech)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wos, start.getTime(), end.getTime(), building, type, status, priority, tech]);

  if (!wos || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading reports…
      </div>
    );
  }

  const jobName = (w: WorkOrder) => matrix?.jobs.find((j) => j.id === w.job_type_id)?.name || w.problem_description?.split('\n')[0] || '';
  const tradeOf = (w: WorkOrder) => {
    const j = matrix?.jobs.find((x) => x.id === w.job_type_id);
    return matrix?.types.find((t) => t.id === j?.service_type_id)?.name || w.category?.name || '';
  };
  const techName = (id?: string | null) => people.find((p) => p.id === id)?.full_name || '';
  const bName = (id?: string | null) => h.buildings.find((b) => b.id === id)?.name || '';
  const yn = (v: boolean | null) => (v == null ? '' : v ? 'Yes' : 'No');

  const registerRows = rows.map((w) => ({
    'WO number': w.wo_number,
    Raised: fmtDate(w.created_at),
    Type: w.wo_type || 'Reactive',
    Priority: priorityOf(w),
    Status: statusMeta(w.status).label,
    Job: jobName(w),
    Trade: tradeOf(w),
    Building: bName(w.building_id),
    Location: roomPath(h, w.location_id).join(' / '),
    Asset: w.asset_id ? h.assets.find((a) => a.id === w.asset_id)?.asset_number || '' : '',
    Technician: techName(w.assigned_technician_id),
    'Respond due': fmtDate(w.response_due_at),
    'Arrived': fmtDate(w.arrived_at),
    'Responded on time': yn(met(w.arrived_at, w.response_due_at)),
    'Fix due': fmtDate(w.resolution_due_at),
    'Work done': fmtDate(w.work_done_at),
    'Fixed on time': yn(met(w.work_done_at, w.resolution_due_at)),
    'Closed': fmtDate(w.closed_at),
    'Client rating': w.client_rating || '',
  }));

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registerRows), 'Work orders');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(slaRows(rows).map(slaExport)), 'SLA by priority');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(techRows(rows, people).map((t) => ({
      Technician: t.name, 'Jobs done': t.done, 'Fixed on time %': t.onTime ?? '', 'Avg fix time': t.avgFix ? formatDuration(t.avgFix) : '', 'Avg rating': t.rating ?? '', 'Open now': t.open,
    }))), 'Technicians');
    XLSX.writeFile(wb, `OCS_CAFM_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(41, 55, 113);
    doc.rect(0, 0, 297, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OCS FACILITIES SERVICES — WORK ORDER REPORT', 10, 11.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${start.toLocaleDateString('en-GB')} – ${new Date(end.getTime() - DAY).toLocaleDateString('en-GB')} · ${rows.length} jobs`, 287, 11.5, { align: 'right' });
    const s = slaRows(rows);
    autoTable(doc, {
      startY: 24,
      head: [['Priority', 'Jobs', 'Responded on time', 'Fixed on time', 'Avg response', 'Avg fix']],
      body: s.map((r) => [r.p, r.n, r.respPct == null ? '—' : `${r.respPct}%`, r.fixPct == null ? '—' : `${r.fixPct}%`, r.avgResp ? formatDuration(r.avgResp) : '—', r.avgFix ? formatDuration(r.avgFix) : '—']),
      theme: 'grid', headStyles: { fillColor: [241, 95, 34] }, styles: { fontSize: 8 },
    });
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
      head: [['WO', 'Raised', 'Type', 'P', 'Status', 'Job', 'Building', 'Technician', 'Resp. on time', 'Fix on time']],
      body: registerRows.map((r) => [r['WO number'], r.Raised, r.Type, r.Priority, r.Status, r.Job.slice(0, 40), r.Building, r.Technician, r['Responded on time'], r['Fixed on time']]),
      theme: 'striped', headStyles: { fillColor: [41, 55, 113] }, styles: { fontSize: 7 },
    });
    doc.save(`OCS_CAFM_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const sla = slaRows(rows);
  const techs = techRows(rows, people);
  const assets = assetRows(rows, h);
  const allMet = rows.filter((w) => met(w.work_done_at, w.resolution_due_at) != null);
  const fixPctAll = pct(allMet.filter((w) => met(w.work_done_at, w.resolution_due_at)).length, allMet.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Reports & KPIs</h1>
          <p className="text-xs text-slate-500">Jobs raised in the period. {rows.length} job(s){fixPctAll != null ? ` · ${fixPctAll}% fixed on time` : ''}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          <button onClick={exportPdf} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FileText className="h-4 w-4" /> PDF</button>
          <Link to="/costing" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Job costing</Link>
          <Link to="/ppm/dashboard" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">PPM compliance</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="enterprise-card flex flex-wrap items-center gap-2 p-3">
        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="enterprise-input w-auto">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {period === 'custom' && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="enterprise-input w-auto" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="enterprise-input w-auto" />
          </>
        )}
        <select value={building} onChange={(e) => setBuilding(e.target.value)} className="enterprise-input w-auto max-w-[180px]">
          <option value="">All buildings</option>
          {h.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="enterprise-input w-auto">
          <option value="">All types</option>
          {WO_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="enterprise-input w-auto">
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p} · {PRIORITY_META[p].name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="enterprise-input w-auto">
          <option value="">All statuses</option>
          {[...FLOW, 'On Hold', 'Cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={tech} onChange={(e) => setTech(e.target.value)} className="enterprise-input w-auto max-w-[180px]">
          <option value="">All technicians</option>
          {people.filter((p) => p.role_id === 'technician' || p.role_id === 'supervisor').map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 dark:border-slate-800">
          {([['register', 'Job register', FileText], ['sla', 'SLA performance', ShieldCheck], ['techs', 'Technicians', Users], ['assets', 'Repeat faults', Boxes]] as [Tab, string, React.ElementType][]).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === k ? 'border-orange-500 text-ocs-blue dark:text-white' : 'border-transparent text-slate-500'}`}>
              <Icon className="h-3.5 w-3.5" /> {l}
            </button>
          ))}
        </div>

        {tab === 'register' && (
          <Table head={['Job', 'Raised', 'Type', 'Status', 'Building', 'Technician', 'Respond', 'Fix']}>
            {rows.length === 0 && <Empty cols={8} />}
            {rows.slice(0, 300).map((w) => (
              <tr key={w.id}>
                <td className="px-3 py-2">
                  <Link to={`/work-orders/${w.id}`} className="font-mono font-semibold text-teal-700 hover:underline dark:text-teal-300">{w.wo_number}</Link>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500"><span className={`rounded px-1 font-bold ${PRIORITY_META[priorityOf(w)].chip}`}>{priorityOf(w)}</span> <span className="max-w-[220px] truncate">{jobName(w)}</span></div>
                </td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(w.created_at)}</td>
                <td className="px-3 py-2">{w.wo_type || 'Reactive'}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta(w.status).pill}`}>{statusMeta(w.status).label}</span></td>
                <td className="px-3 py-2">{bName(w.building_id)}</td>
                <td className="px-3 py-2">{techName(w.assigned_technician_id) || '—'}</td>
                <td className="px-3 py-2"><Outcome v={met(w.arrived_at, w.response_due_at)} /></td>
                <td className="px-3 py-2"><Outcome v={met(w.work_done_at, w.resolution_due_at)} /></td>
              </tr>
            ))}
            {rows.length > 300 && <tr><td colSpan={8} className="px-3 py-2 text-center text-[11px] text-slate-500">Showing 300 of {rows.length}. Export to Excel for all.</td></tr>}
          </Table>
        )}

        {tab === 'sla' && (
          <div className="space-y-4 p-4">
            <Table head={['Priority', 'Jobs', 'Responded on time', 'Fixed on time', 'Avg response', 'Avg fix', 'Still open & late']}>
              {sla.map((r) => (
                <tr key={r.p}>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[r.p].chip}`}>{r.p} · {PRIORITY_META[r.p].name}</span></td>
                  <td className="px-3 py-2 font-semibold">{r.n}</td>
                  <td className="px-3 py-2"><Pct v={r.respPct} n={r.respN} /></td>
                  <td className="px-3 py-2"><Pct v={r.fixPct} n={r.fixN} /></td>
                  <td className="px-3 py-2">{r.avgResp ? formatDuration(r.avgResp) : '—'}</td>
                  <td className="px-3 py-2">{r.avgFix ? formatDuration(r.avgFix) : '—'}</td>
                  <td className={`px-3 py-2 font-semibold ${r.lateOpen ? 'text-ocs-red' : 'text-slate-400'}`}>{r.lateOpen}</td>
                </tr>
              ))}
            </Table>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">By building</h3>
            <Table head={['Building', 'Jobs', 'Fixed on time', 'Responded on time']}>
              {h.buildings.map((b) => {
                const bw = rows.filter((w) => w.building_id === b.id);
                if (!bw.length) return null;
                const f = bw.filter((w) => met(w.work_done_at, w.resolution_due_at) != null);
                const r = bw.filter((w) => met(w.arrived_at, w.response_due_at) != null);
                return (
                  <tr key={b.id}>
                    <td className="px-3 py-2 font-semibold">{b.name}</td>
                    <td className="px-3 py-2">{bw.length}</td>
                    <td className="px-3 py-2"><Pct v={pct(f.filter((w) => met(w.work_done_at, w.resolution_due_at)).length, f.length)} n={f.length} /></td>
                    <td className="px-3 py-2"><Pct v={pct(r.filter((w) => met(w.arrived_at, w.response_due_at)).length, r.length)} n={r.length} /></td>
                  </tr>
                );
              })}
            </Table>
          </div>
        )}

        {tab === 'techs' && (
          <Table head={['Technician', 'Jobs done', 'Fixed on time', 'Avg fix time', 'Client rating', 'Open now']}>
            {techs.length === 0 && <Empty cols={6} />}
            {techs.map((t) => (
              <tr key={t.id}>
                <td className="px-3 py-2 font-semibold">{t.name}</td>
                <td className="px-3 py-2">{t.done}</td>
                <td className="px-3 py-2"><Pct v={t.onTime} n={t.done} /></td>
                <td className="px-3 py-2">{t.avgFix ? formatDuration(t.avgFix) : '—'}</td>
                <td className="px-3 py-2">{t.rating == null ? '—' : `${t.rating} ★`}</td>
                <td className="px-3 py-2">{t.open}</td>
              </tr>
            ))}
          </Table>
        )}

        {tab === 'assets' && (
          <Table head={['Asset', 'Location', 'Breakdowns', 'Last fault', 'Open now']}>
            {assets.length === 0 && <Empty cols={5} text="No breakdowns logged against equipment in this period." />}
            {assets.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2"><Link to={`/assets/${a.id}`} className="font-semibold text-teal-700 hover:underline dark:text-teal-300">{a.number}</Link><div className="text-[10px] text-slate-500">{a.name}</div></td>
                <td className="px-3 py-2 text-slate-500">{a.path}</td>
                <td className={`px-3 py-2 font-bold ${a.n >= 3 ? 'text-ocs-red' : ''}`}>{a.n}{a.n >= 3 && <span className="ml-1 text-[10px] font-semibold">repeat</span>}</td>
                <td className="px-3 py-2 text-slate-500">{fmtDate(a.last)}</td>
                <td className="px-3 py-2">{a.open}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- figures
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const slaRows = (rows: WorkOrder[]) =>
  PRIORITIES.map((p) => {
    const ws = rows.filter((w) => priorityOf(w) === p);
    const resp = ws.filter((w) => met(w.arrived_at, w.response_due_at) != null);
    const fix = ws.filter((w) => met(w.work_done_at, w.resolution_due_at) != null);
    return {
      p,
      n: ws.length,
      respN: resp.length,
      fixN: fix.length,
      respPct: pct(resp.filter((w) => met(w.arrived_at, w.response_due_at)).length, resp.length),
      fixPct: pct(fix.filter((w) => met(w.work_done_at, w.resolution_due_at)).length, fix.length),
      avgResp: avg(resp.map((w) => new Date(w.arrived_at!).getTime() - new Date(w.created_at).getTime() - (w.sla_paused_minutes || 0) * 60000)),
      avgFix: avg(fix.map((w) => new Date(w.work_done_at!).getTime() - new Date(w.created_at).getTime() - (w.sla_paused_minutes || 0) * 60000)),
      lateOpen: ws.filter((w) => !w.work_done_at && ['New', 'Assigned', 'In Progress'].includes(normaliseStatus(w.status)) && w.resolution_due_at && new Date(w.resolution_due_at) < new Date()).length,
    };
  });

const slaExport = (r: ReturnType<typeof slaRows>[number]) => ({
  Priority: r.p, Jobs: r.n, 'Responded on time %': r.respPct ?? '', 'Fixed on time %': r.fixPct ?? '',
  'Avg response': r.avgResp ? formatDuration(r.avgResp) : '', 'Avg fix': r.avgFix ? formatDuration(r.avgFix) : '', 'Open & late': r.lateOpen,
});

const techRows = (rows: WorkOrder[], people: UserProfile[]) =>
  people
    .map((p) => {
      const mine = rows.filter((w) => w.assigned_technician_id === p.id);
      const done = mine.filter((w) => w.work_done_at);
      const judged = done.filter((w) => w.resolution_due_at);
      const rated = mine.filter((w) => w.client_rating);
      return {
        id: p.id,
        name: p.full_name,
        done: done.length,
        onTime: pct(judged.filter((w) => met(w.work_done_at, w.resolution_due_at)).length, judged.length),
        avgFix: avg(done.filter((w) => w.started_at).map((w) => new Date(w.work_done_at!).getTime() - new Date(w.started_at!).getTime())),
        rating: rated.length ? Math.round(avg(rated.map((w) => Number(w.client_rating))) * 10) / 10 : null,
        open: mine.filter((w) => ['New', 'Assigned', 'In Progress', 'On Hold'].includes(normaliseStatus(w.status))).length,
      };
    })
    .filter((t) => t.done || t.open)
    .sort((a, b) => b.done - a.done);

const assetRows = (rows: WorkOrder[], h: Hierarchy) => {
  const m = new Map<string, WorkOrder[]>();
  rows.filter((w) => w.asset_id && w.wo_type !== 'PPM' && w.status !== 'Cancelled').forEach((w) => m.set(w.asset_id!, [...(m.get(w.asset_id!) || []), w]));
  return [...m.entries()]
    .map(([id, ws]) => {
      const a = h.assets.find((x) => x.id === id);
      return {
        id, number: a?.asset_number || id, name: a?.name || '', path: a ? roomPath(h, a.location_id).slice(-2).join(' / ') : '',
        n: ws.length, last: ws.map((w) => w.created_at).sort().pop(), open: ws.filter((w) => ['New', 'Assigned', 'In Progress', 'On Hold'].includes(normaliseStatus(w.status))).length,
      };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, 50);
};

// ---------------------------------------------------------------- pieces
const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-left text-xs">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
        <tr>{head.map((x) => <th key={x} className="px-3 py-2">{x}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
    </table>
  </div>
);

const Empty: React.FC<{ cols: number; text?: string }> = ({ cols, text = 'No jobs match these filters.' }) => (
  <tr><td colSpan={cols} className="px-3 py-12 text-center text-slate-500">{text}</td></tr>
);

const Outcome: React.FC<{ v: boolean | null }> = ({ v }) =>
  v == null ? <span className="text-slate-400">—</span> : v ? <span className="font-semibold text-emerald-600">On time</span> : <span className="font-semibold text-ocs-red">Late</span>;

const Pct: React.FC<{ v: number | null; n: number }> = ({ v, n }) =>
  v == null ? <span className="text-slate-400">—</span> : (
    <span className={`font-bold ${v >= 95 ? 'text-emerald-600' : v >= 85 ? 'text-orange-500' : 'text-ocs-red'}`}>{v}% <span className="font-normal text-slate-400">of {n}</span></span>
  );
