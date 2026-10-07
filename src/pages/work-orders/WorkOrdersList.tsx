import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCheck, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, Loader2, MapPin, PauseCircle,
  Plus, Search, Timer, User, X,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { ServiceMatrix, workOrderService } from '../../api/workOrders';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { SlaCountdown } from '../../components/SlaCountdown';
import { exportWorkOrdersToExcel } from '../../utils/excelExporter';
import { getSlaStatus } from '../../utils/sla';
import { FLOW, PRIORITY_META, STATUS_META, WO_TYPES, isOpen, normaliseStatus, priorityOf, statusMeta } from '../../utils/woFlow';
import { SlaPriority, UserProfile, WorkOrder } from '../../types';

const TABS = ['All', ...FLOW.slice(0, 3), 'On Hold', ...FLOW.slice(3), 'Cancelled'];
const PAGE = 25;

const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 0)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const WorkOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const { user, isTechnician, isAdmin, isManager } = useAuth();
  const [params, setParams] = useSearchParams();

  const [wos, setWos] = useState<WorkOrder[] | null>(null);
  const [matrix, setMatrix] = useState<ServiceMatrix | null>(null);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const status = params.get('status') || 'All';
  const query = params.get('q') || params.get('search') || '';
  const priority = (params.get('priority') || '') as SlaPriority | '';
  const type = params.get('type') || '';
  const building = params.get('building') || '';
  const mine = params.get('mine') === '1' || (isTechnician && params.get('mine') !== '0');
  const overdueOnly = params.get('overdue') === '1';
  const page = Number(params.get('page') || 1);

  const setParam = (k: string, v: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (v === null || v === '') n.delete(k);
      else n.set(k, v);
      if (k !== 'page') n.delete('page');
      return n;
    });

  const load = async () => {
    const [list, m, hier, users] = await Promise.all([
      cafmDataService.getWorkOrders(),
      workOrderService.serviceMatrix(),
      hierarchyService.loadAll(),
      cafmDataService.getUsers(),
    ]);
    setWos(list);
    setMatrix(m);
    setH(hier);
    setPeople(users);
  };

  useEffect(() => {
    load();
  }, []);

  const jobName = (wo: WorkOrder) => matrix?.jobs.find((j) => j.id === wo.job_type_id)?.name;
  const roomName = (wo: WorkOrder) => h?.rooms.find((r) => r.id === wo.location_id)?.name;
  const buildingName = (wo: WorkOrder) => h?.buildings.find((b) => b.id === wo.building_id)?.name;
  const techName = (wo: WorkOrder) => people.find((p) => p.id === wo.assigned_technician_id)?.full_name;

  // Everything except the status tab, so tab counts reflect the other filters.
  const base = useMemo(() => {
    if (!wos) return [];
    const q = query.trim().toLowerCase();
    return wos.filter((wo) => {
      if (mine && wo.assigned_technician_id !== user?.id) return false;
      if (priority && priorityOf(wo) !== priority) return false;
      if (type && (wo.wo_type || 'Reactive') !== type) return false;
      if (building && wo.building_id !== building) return false;
      if (overdueOnly && !(isOpen(wo.status) && getSlaStatus(wo).state === 'breached')) return false;
      if (q) {
        const hay = [wo.wo_number, wo.problem_description, jobName(wo), roomName(wo), buildingName(wo), techName(wo), wo.asset?.asset_number]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [wos, query, priority, type, building, mine, overdueOnly, matrix, h, people, user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: base.length };
    base.forEach((w) => {
      const s = normaliseStatus(w.status);
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [base]);

  const rows = status === 'All' ? base : base.filter((w) => normaliseStatus(w.status) === status);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  // KPI strip is always across all jobs this user can see.
  const kpi = useMemo(() => {
    const visible = (wos || []).filter((w) => !isTechnician || w.assigned_technician_id === user?.id);
    const open = visible.filter((w) => isOpen(w.status));
    const overdue = open.filter((w) => getSlaStatus(w).state === 'breached');
    const atRisk = open.filter((w) => ['warning', 'critical'].includes(getSlaStatus(w).state));
    return {
      open: open.length,
      overdue: overdue.length,
      atRisk: atRisk.length,
      hold: visible.filter((w) => normaliseStatus(w.status) === 'On Hold').length,
      verify: visible.filter((w) => normaliseStatus(w.status) === 'Work Done').length,
    };
  }, [wos, isTechnician, user]);

  const canBulkClose = isAdmin || isManager;
  const closable = shown.filter((w) => normaliseStatus(w.status) === 'Completed');
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulkClose = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      for (const id of selected) {
        const wo = wos?.find((w) => w.id === id);
        if (wo) await workOrderService.act(wo, 'close');
      }
      setToast(`${selected.size} job(s) closed.`);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      setToast(e?.message || 'Could not close the jobs.');
    } finally {
      setBusy(false);
      setTimeout(() => setToast(''), 4000);
    }
  };

  if (!wos) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading work orders…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Work Orders</h1>
          <p className="text-xs text-slate-500">New → Assigned → In Progress → Work Done → Completed → Closed</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportWorkOrdersToExcel(rows, `Work_Orders_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export
          </button>
          <Link to="/work-orders/new" className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
            <Plus className="h-4 w-4" /> New work order
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label={isTechnician ? 'My open jobs' : 'Open jobs'} value={kpi.open} icon={Clock} tone="text-ocs-blue dark:text-white" onClick={() => setParam('status', null)} />
        <Kpi label="Overdue" value={kpi.overdue} icon={AlertTriangle} tone="text-ocs-red" onClick={() => setParam('overdue', overdueOnly ? null : '1')} active={overdueOnly} />
        <Kpi label="At risk (75%+ used)" value={kpi.atRisk} icon={Timer} tone="text-orange-500" />
        <Kpi label="On hold" value={kpi.hold} icon={PauseCircle} tone="text-sky-500" onClick={() => setParam('status', 'On Hold')} />
        <Kpi label="To verify" value={kpi.verify} icon={CheckCheck} tone="text-violet-500" onClick={() => setParam('status', 'Work Done')} />
      </div>

      <div className="enterprise-card overflow-hidden">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2 dark:border-slate-800">
          {TABS.map((t) => {
            const active = status === t;
            const meta = STATUS_META[t];
            return (
              <button
                key={t}
                onClick={() => setParam('status', t === 'All' ? null : t)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
                  active ? 'border-orange-500 text-ocs-blue dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {meta && <span className={`h-2 w-2 rounded-full ${meta.dot}`} />}
                {t}
                <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-ocs-blue text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{counts[t] || 0}</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setParam('q', e.target.value)} placeholder="Search WO no., job, room, building, technician…" className="enterprise-input pl-8" />
          </div>
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(['P1', 'P2', 'P3', 'P4'] as SlaPriority[]).map((p) => (
              <button
                key={p}
                onClick={() => setParam('priority', priority === p ? null : p)}
                title={PRIORITY_META[p].name}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${priority === p ? PRIORITY_META[p].chip : 'text-slate-500'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <select value={type} onChange={(e) => setParam('type', e.target.value)} className="enterprise-input w-auto">
            <option value="">All types</option>
            {WO_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={building} onChange={(e) => setParam('building', e.target.value)} className="enterprise-input w-auto max-w-[200px]">
            <option value="">All buildings</option>
            {h?.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={mine} onChange={(e) => setParam('mine', e.target.checked ? '1' : '0')} /> My jobs
          </label>
          {(query || priority || type || building || overdueOnly) && (
            <button onClick={() => setParams(status !== 'All' ? { status } : {})} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {canBulkClose && selected.size > 0 && (
          <div className="flex items-center justify-between bg-teal-50 px-4 py-2 text-xs dark:bg-teal-500/10">
            <span className="font-semibold text-teal-800 dark:text-teal-200">{selected.size} completed job(s) selected</span>
            <button onClick={bulkClose} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-ocs-blue px-3 py-1.5 font-semibold text-white disabled:opacity-60">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Close selected
            </button>
          </div>
        )}

        {/* Rows */}
        {shown.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No work orders match.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((wo) => {
              const p = priorityOf(wo);
              const sm = statusMeta(wo.status);
              const title = jobName(wo) || wo.problem_description?.split('\n')[0];
              const where = [buildingName(wo), roomName(wo)].filter(Boolean).join(' · ');
              const tech = techName(wo);
              const canSelect = canBulkClose && normaliseStatus(wo.status) === 'Completed';
              return (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="grid cursor-pointer grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-slate-50 md:grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1.4fr)_110px_120px_minmax(0,1fr)] dark:hover:bg-slate-800/40"
                >
                  <div onClick={(e) => e.stopPropagation()} className="flex w-5 justify-center">
                    {canSelect ? (
                      <input type="checkbox" checked={selected.has(wo.id)} onChange={() => toggle(wo.id)} />
                    ) : (
                      <span className={`h-2.5 w-2.5 rounded-full ${p === 'P1' ? 'bg-ocs-red' : p === 'P2' ? 'bg-orange-500' : p === 'P3' ? 'bg-teal-500' : 'bg-slate-300'}`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[11px] font-semibold text-slate-500">{wo.wo_number}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[p].chip}`}>{p}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{wo.wo_type || 'Reactive'}</span>
                      {wo.is_chargeable && <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">Chargeable</span>}
                    </div>
                    <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</div>
                  </div>
                  <div className="col-start-2 min-w-0 text-xs text-slate-500 md:col-start-auto">
                    <div className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0 text-orange-500" /> {where || '—'}</div>
                    {wo.asset && <div className="truncate font-mono text-[10px]">{wo.asset.asset_number}</div>}
                  </div>
                  <div className="col-start-2 md:col-start-auto">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${sm.pill}`}>{sm.label}</span>
                  </div>
                  <div className="col-start-2 md:col-start-auto">
                    <SlaCountdown workOrder={wo} />
                  </div>
                  <div className="col-start-2 flex items-center justify-between gap-2 text-xs text-slate-500 md:col-start-auto">
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      <User className="h-3 w-3 shrink-0" /> {tech || <span className="italic text-slate-400">Unassigned</span>}
                    </span>
                    <span className="shrink-0 text-[11px]">{timeAgo(wo.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
          <span>
            {rows.length} job(s){canBulkClose && closable.length > 0 && selected.size === 0 && ' · tick completed jobs to close them together'}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} className="rounded p-1 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span>{page} / {pages}</span>
            <button disabled={page >= pages} onClick={() => setParam('page', String(page + 1))} className="rounded p-1 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {toast && <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-ocs-blue px-4 py-3 text-xs font-semibold text-white shadow-lg">{toast}</div>}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number; icon: React.ElementType; tone: string; onClick?: () => void; active?: boolean }> = ({ label, value, icon: Icon, tone, onClick, active }) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`enterprise-card flex items-center gap-3 p-3 text-left ${onClick ? 'hover:border-teal-300' : 'cursor-default'} ${active ? 'ring-2 ring-ocs-red' : ''}`}
  >
    <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
    <div>
      <div className={`text-xl font-bold leading-none ${tone}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  </button>
);
