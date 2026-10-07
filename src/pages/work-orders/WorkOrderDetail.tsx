import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Boxes, Camera, Car, Check, CheckCircle2, Clock, Download, History, Loader2, MapPin, PauseCircle,
  Phone, Plus, ShieldCheck, Star, Trash2, User, Wrench, X, XCircle,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { ServiceMatrix, workOrderService } from '../../api/workOrders';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { PhotoUploader } from '../../components/PhotoUploader';
import { generateWorkOrderPDF } from '../../utils/pdfGenerator';
import { ClockResult, formatDuration, slaClock } from '../../utils/sla';
import {
  ActionId, FLOW, FlowAction, HOLD_REASONS, PRIORITY_META, actionsFor, normaliseStatus, priorityOf, statusMeta,
} from '../../utils/woFlow';
import { SlaPolicy, StatusHistoryEntry, TimeLogEntry, UserProfile, WorkOrder } from '../../types';

type Tab = 'overview' | 'sla' | 'time' | 'photos' | 'history';
type Dialog = null | 'assign' | 'hold' | 'work_done' | 'complete' | 'cancel' | 'send_back' | 'manual_time' | 'delete';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

const STEP_TIME: Record<string, keyof WorkOrder> = {
  New: 'created_at',
  Assigned: 'assigned_at',
  'In Progress': 'started_at',
  'Work Done': 'work_done_at',
  Completed: 'completed_at',
  Closed: 'closed_at',
};

const TONE: Record<FlowAction['tone'], string> = {
  brand: 'bg-ocs-blue text-white hover:bg-teal-700',
  accent: 'bg-orange-500 text-white hover:bg-orange-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  neutral: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900',
};

export const WorkOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isAdmin, isManager, isSupervisor, canEdit } = useAuth();
  const lead = isAdmin || isManager || isSupervisor;

  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [matrix, setMatrix] = useState<ServiceMatrix | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [techs, setTechs] = useState<UserProfile[]>([]);
  const [timeLog, setTimeLog] = useState<TimeLogEntry[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [pdfBusy, setPdfBusy] = useState(false);

  // Dialog form fields
  const [f, setF] = useState<Record<string, any>>({});
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const refreshSide = async (woId: string) => {
    const [log, hist, photos] = await Promise.all([
      workOrderService.timeLog(woId).catch(() => []),
      workOrderService.history(woId),
      workOrderService.photos(woId),
    ]);
    setTimeLog(log);
    setHistory(hist);
    if (photos) setWo((w) => (w ? { ...w, photos } : w));
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [w, hier, m, pol, t] = await Promise.all([
        cafmDataService.getWorkOrderById(id),
        hierarchyService.loadAll(),
        workOrderService.serviceMatrix(),
        workOrderService.slaPolicies(),
        cafmDataService.getTechnicians(),
      ]);
      if (!w) return setNotFound(true);
      setWo(w);
      setH(hier);
      setMatrix(m);
      setPolicies(pol);
      setTechs(t);
      refreshSide(w.id);
    })();
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, [id]);

  const actions = useMemo(() => (wo ? actionsFor(wo, role, user?.id) : []), [wo, role, user]);

  if (notFound) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Work order not found. <Link to="/work-orders" className="font-semibold text-teal-600">Back to list</Link>
      </div>
    );
  }
  if (!wo || !h || !matrix) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading work order…
      </div>
    );
  }

  const status = normaliseStatus(wo.status);
  const sm = statusMeta(wo.status);
  const p = priorityOf(wo);
  const job = matrix.jobs.find((j) => j.id === wo.job_type_id);
  const serviceType = job && matrix.types.find((t) => t.id === job.service_type_id);
  const policy = policies.find((x) => x.id === wo.sla_policy_id) || workOrderService.policyFor(policies, p);
  const path = roomPath(h, wo.location_id);
  const asset = h.assets.find((a) => a.id === wo.asset_id);
  const tech = techs.find((t) => t.id === wo.assigned_technician_id);
  const paused = status === 'On Hold';
  const running = timeLog.find((e) => e.started_at && !e.ended_at);

  // -------------------------------------------------------------- actions
  const run = async (action: ActionId, extra: Partial<WorkOrder> = {}) => {
    setBusy(true);
    setError('');
    try {
      const updated = await workOrderService.act(wo, action, extra, user ? { id: user.id, full_name: user.full_name } : undefined);
      setWo({ ...updated, photos: wo.photos });
      setDialog(null);
      setF({});
      await refreshSide(wo.id);
    } catch (e: any) {
      setError(e?.message || 'Could not update the job.');
    } finally {
      setBusy(false);
    }
  };

  const onAction = (a: FlowAction) => {
    setError('');
    switch (a.id) {
      case 'assign':
        setF({ tech: wo.assigned_technician_id || '' });
        return setDialog('assign');
      case 'hold':
        setF({ reason: HOLD_REASONS[0], note: '' });
        return setDialog('hold');
      case 'work_done':
        setF({ work: wo.work_performed || '', cause: wo.root_cause || '', action: wo.action_taken || '' });
        return setDialog('work_done');
      case 'complete':
        setF({ name: wo.client_signoff_name || '', rating: 5, comment: '' });
        return setDialog('complete');
      case 'cancel':
        setF({ reason: '' });
        return setDialog('cancel');
      case 'send_back':
        setF({ reason: '' });
        return setDialog('send_back');
      default:
        return run(a.id);
    }
  };

  const markRestored = () =>
    cafmDataService.updateWorkOrder(wo.id, { restored_at: new Date().toISOString() }).then((u) => u && setWo({ ...u, photos: wo.photos }));

  const pdf = async () => {
    setPdfBusy(true);
    try {
      await generateWorkOrderPDF(wo);
    } catch (e: any) {
      setError(e?.message || 'Could not build the report.');
    } finally {
      setPdfBusy(false);
    }
  };

  // ------------------------------------------------------------ SLA clocks
  const clocks: { key: string; title: string; hint: string; clock: ClockResult }[] = [
    { key: 'response', title: 'Response', hint: 'Technician on site', clock: slaClock(wo.created_at, wo.response_due_at, wo.arrived_at, paused, now) },
    ...(wo.restoration_due_at
      ? [{ key: 'restoration', title: 'Restoration', hint: 'Made safe / temporary fix', clock: slaClock(wo.created_at, wo.restoration_due_at, wo.restored_at || wo.work_done_at, paused, now) }]
      : []),
    { key: 'resolution', title: 'Resolution', hint: 'Permanent fix (work done)', clock: slaClock(wo.created_at, wo.resolution_due_at, wo.work_done_at, paused, now) },
  ];
  const sum = (type: 'Travel' | 'Labour') =>
    timeLog.filter((e) => e.record_type === type).reduce((acc, e) => acc + (e.ended_at || !e.started_at ? Number(e.hours) || 0 : (now.getTime() - new Date(e.started_at).getTime()) / 3_600_000), 0);

  const primary = actions.filter((a) => a.primary);
  const secondary = actions.filter((a) => !a.primary);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to="/work-orders" className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-semibold text-slate-500">{wo.wo_number}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[p].chip}`}>{p} · {policy?.name || PRIORITY_META[p].name}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{wo.wo_type || 'Reactive'}</span>
              {wo.is_chargeable && <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">Chargeable · {wo.billing_status}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${sm.pill}`}>{sm.label}</span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-ocs-blue dark:text-white">{job?.name || wo.problem_description?.split('\n')[0]}</h1>
            {job?.name_ar && <div dir="rtl" className="text-xs text-slate-500">{job.name_ar}</div>}
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-orange-500" /> {path.join(' / ') || '—'}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={pdf} disabled={pdfBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Report
          </button>
          {isAdmin && (
            <button onClick={() => setDialog('delete')} title="Delete work order" className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600 dark:border-slate-700">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="enterprise-card p-4">
        <ol className="grid grid-cols-6 gap-1">
          {FLOW.map((step, i) => {
            const idx = FLOW.indexOf(status === 'On Hold' ? 'In Progress' : status);
            const done = status !== 'Cancelled' && i <= idx;
            const current = i === idx && status !== 'Cancelled';
            const t = fmt(wo[STEP_TIME[step]] as string | undefined);
            return (
              <li key={step} className="min-w-0">
                <div className={`h-1.5 rounded-full ${done ? (current && paused ? 'bg-sky-400' : 'bg-orange-500') : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`mt-2 truncate text-[11px] font-semibold ${current ? 'text-ocs-blue dark:text-white' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400'}`}>
                  {current && paused ? 'On Hold' : step}
                </div>
                <div className="truncate text-[10px] text-slate-500">{done ? t || '' : ''}</div>
              </li>
            );
          })}
        </ol>

        {paused && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
            <PauseCircle className="h-4 w-4" /> On hold since {fmt(wo.on_hold_since)} — <b>{wo.hold_reason || 'no reason given'}</b>. SLA clock is paused.
          </div>
        )}
        {status === 'Cancelled' && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
            <XCircle className="h-4 w-4" /> Cancelled{wo.cancel_reason ? ` — ${wo.cancel_reason}` : ''}.
          </div>
        )}

        {/* Actions */}
        {(primary.length > 0 || secondary.length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {primary.map((a) => (
              <button key={a.id} onClick={() => onAction(a)} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-60 ${TONE[a.tone]}`}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {a.id === 'start' && <Car className="h-4 w-4" />}
                {a.id === 'arrive' && <MapPin className="h-4 w-4" />}
                {a.id === 'work_done' && <Wrench className="h-4 w-4" />}
                {a.id === 'complete' && <ShieldCheck className="h-4 w-4" />}
                {a.label}
              </button>
            ))}
            {secondary.map((a) => (
              <button key={a.id + a.label} onClick={() => onAction(a)} disabled={busy} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${TONE[a.tone]}`}>
                {a.label}
              </button>
            ))}
            {running && (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                {running.record_type === 'Travel' ? 'Travelling' : 'Working'} · {formatDuration(now.getTime() - new Date(running.started_at!).getTime())}
              </span>
            )}
          </div>
        )}
        {error && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Tabs */}
        <div className="enterprise-card overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 dark:border-slate-800">
            {([
              ['overview', 'Overview', Boxes],
              ['sla', 'SLA', Clock],
              ['time', 'Time log', Car],
              ['photos', `Photos${wo.photos?.length ? ` (${wo.photos.length})` : ''}`, Camera],
              ['history', 'History', History],
            ] as [Tab, string, React.ElementType][]).map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === k ? 'border-orange-500 text-ocs-blue dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'overview' && (
              <div className="space-y-5">
                <Block title="Problem">
                  <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{wo.problem_description}</p>
                  {wo.symptoms && <p className="mt-2 text-xs text-slate-500"><b>Symptoms:</b> {wo.symptoms}</p>}
                  {serviceType && <p className="mt-2 text-xs text-slate-500"><b>Trade:</b> {serviceType.name}{job?.est_hours ? ` · usually about ${job.est_hours}h` : ''}</p>}
                </Block>

                {asset && (
                  <Link to={`/assets/${asset.id}`} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-teal-300 dark:border-slate-700">
                    <Boxes className="mt-0.5 h-5 w-5 text-orange-500" />
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{asset.asset_number} · {asset.name}</div>
                      <div className="text-slate-500">{[asset.manufacturer, asset.model, asset.serial_number && `SN ${asset.serial_number}`].filter(Boolean).join(' · ') || 'No equipment details'} · {asset.status}</div>
                    </div>
                  </Link>
                )}

                {(wo.work_performed || wo.root_cause || wo.action_taken) && (
                  <Block title="Work carried out">
                    <dl className="grid gap-3 text-xs sm:grid-cols-2">
                      {wo.work_performed && <Def k="Work performed" v={wo.work_performed} wide />}
                      {wo.root_cause && <Def k="Root cause" v={wo.root_cause} />}
                      {wo.action_taken && <Def k="Action / recommendation" v={wo.action_taken} />}
                    </dl>
                  </Block>
                )}

                {wo.client_signoff_at && (
                  <Block title="Sign-off">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-semibold">{wo.client_signoff_name || 'Client'}</span>
                      {wo.client_rating ? (
                        <span className="flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-4 w-4 ${n <= wo.client_rating! ? 'fill-orange-400 text-orange-400' : 'text-slate-300'}`} />)}</span>
                      ) : null}
                      <span className="text-slate-500">{fmt(wo.client_signoff_at)}</span>
                    </div>
                    {wo.client_comment && <p className="mt-1 text-xs italic text-slate-600 dark:text-slate-300">“{wo.client_comment}”</p>}
                  </Block>
                )}

                {wo.remarks && <Block title="Remarks"><p className="text-xs text-slate-700 dark:text-slate-300">{wo.remarks}</p></Block>}
              </div>
            )}

            {tab === 'sla' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {clocks.map(({ key, title, hint, clock }) => (
                    <ClockCard key={key} title={title} hint={hint} c={clock} />
                  ))}
                </div>
                {wo.restoration_due_at && !wo.restored_at && status === 'In Progress' && (canEdit || wo.assigned_technician_id === user?.id) && (
                  <button onClick={markRestored} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Mark as made safe (temporary fix done)
                  </button>
                )}
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  Policy <b>{policy?.name || p}</b>: respond {policy ? formatDuration(policy.response_minutes * 60000) : '—'}
                  {policy?.restoration_minutes ? `, make safe ${formatDuration(policy.restoration_minutes * 60000)}` : ''}, fix {policy ? formatDuration(policy.resolution_minutes * 60000) : '—'}.
                  {wo.sla_paused_minutes ? <> Time on hold so far: <b>{formatDuration(wo.sla_paused_minutes * 60000)}</b> (not counted against the SLA).</> : null}
                </div>
              </div>
            )}

            {tab === 'time' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Travel" value={`${sum('Travel').toFixed(2)} h`} />
                  <Stat label="Labour" value={`${sum('Labour').toFixed(2)} h`} />
                  {job?.est_hours ? <Stat label="Estimate" value={`${job.est_hours} h`} /> : null}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                      <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2 text-right">Hours</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {timeLog.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No time recorded yet. Timers start automatically when the job is started.</td></tr>}
                      {timeLog.map((e) => (
                        <tr key={e.id}>
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${e.record_type === 'Travel' ? 'bg-sky-50 text-sky-700' : 'bg-orange-50 text-orange-700'}`}>{e.record_type}{e.is_manual ? ' · manual' : ''}</span></td>
                          <td className="px-3 py-2">{e.technician_name || '—'}</td>
                          <td className="px-3 py-2">{fmt(e.started_at) || '—'}</td>
                          <td className="px-3 py-2">{e.ended_at ? fmt(e.ended_at) : e.started_at ? <span className="font-semibold text-orange-600">running</span> : '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{e.ended_at || !e.started_at ? Number(e.hours).toFixed(2) : '…'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lead && (
                  <button onClick={() => { setF({ type: 'Labour', hours: '', who: tech?.full_name || '', note: '' }); setDialog('manual_time'); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600">
                    <Plus className="h-3.5 w-3.5" /> Add time manually
                  </button>
                )}
              </div>
            )}

            {tab === 'photos' && (
              <div className="grid gap-4 sm:grid-cols-3">
                <PhotoUploader workOrder={wo} photoType="before" label="Before" canEdit={canEdit || wo.assigned_technician_id === user?.id} onChange={setWo} />
                <PhotoUploader workOrder={wo} photoType="progress" label="During" canEdit={canEdit || wo.assigned_technician_id === user?.id} onChange={setWo} />
                <PhotoUploader workOrder={wo} photoType="after" label="After" canEdit={canEdit || wo.assigned_technician_id === user?.id} onChange={setWo} />
              </div>
            )}

            {tab === 'history' && (
              <ol className="relative space-y-4 border-l border-slate-200 pl-5 dark:border-slate-700">
                <li>
                  <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-slate-400" />
                  <div className="text-xs font-semibold">Logged via {wo.source || 'Helpdesk'}</div>
                  <div className="text-[11px] text-slate-500">{fmt(wo.created_at)} · {wo.reported_by_name || '—'}</div>
                </li>
                {history.map((e) => (
                  <li key={e.id}>
                    <span className={`absolute -left-1.5 mt-1 h-3 w-3 rounded-full ${statusMeta(e.to_status as any).dot}`} />
                    <div className="text-xs font-semibold">{e.from_status ? `${e.from_status} → ` : ''}{e.to_status}</div>
                    <div className="text-[11px] text-slate-500">{fmt(e.created_at)}{e.comments ? ` · ${e.comments}` : ''}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Side panel */}
        <aside className="space-y-4">
          <div className="enterprise-card space-y-3 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Technician</h3>
            {tech ? (
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocs-blue text-xs font-bold text-white">{tech.full_name.slice(0, 1)}</span>
                <div className="text-xs">
                  <div className="font-semibold">{tech.full_name}</div>
                  <div className="text-slate-500">{tech.phone || tech.email}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs italic text-slate-500">Not assigned yet</p>
            )}
            {lead && !['Closed', 'Cancelled'].includes(status) && (
              <button onClick={() => onAction({ id: 'assign', label: '', primary: true, tone: 'brand' })} className="text-xs font-semibold text-teal-600">
                {tech ? 'Reassign' : 'Assign'}
              </button>
            )}
          </div>

          <div className="enterprise-card space-y-2 p-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Reported</h3>
            <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-slate-400" /> {wo.reported_by_name || '—'}</div>
            {wo.reported_by_phone && <a href={`tel:${wo.reported_by_phone}`} className="flex items-center gap-1.5 text-teal-600"><Phone className="h-3.5 w-3.5" /> {wo.reported_by_phone}</a>}
            <div className="text-slate-500">{fmt(wo.created_at)} · via {wo.source || 'Helpdesk'}</div>
          </div>

          <div className="enterprise-card space-y-2 p-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Deadlines</h3>
            {clocks.map(({ key, title, clock }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-500">{title}</span>
                <span className={`font-semibold ${clock.state === 'overdue' || clock.state === 'late' ? 'text-ocs-red' : clock.state === 'met' ? 'text-emerald-600' : clock.state === 'warning' ? 'text-orange-600' : ''}`}>
                  {clock.state === 'met' ? 'Met' : clock.state === 'late' ? 'Late' : fmt(clock.dueAt?.toISOString())}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ---------------------------------------------------------- dialogs */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => !busy && setDialog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            {dialog === 'assign' && (
              <>
                <DlgTitle title={tech ? 'Reassign technician' : 'Assign technician'} onClose={() => setDialog(null)} />
                <select value={f.tech} onChange={(e) => set('tech', e.target.value)} className="enterprise-input">
                  <option value="">Choose…</option>
                  {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}{(t as any).trade_code ? ` · ${(t as any).trade_code}` : ''}</option>)}
                </select>
                <DlgButtons busy={busy} disabled={!f.tech} label="Assign" onCancel={() => setDialog(null)} onOk={() => run('assign', { assigned_technician_id: f.tech, ...(status === 'New' ? {} : {}) })} />
              </>
            )}
            {dialog === 'hold' && (
              <>
                <DlgTitle title="Put job on hold" onClose={() => setDialog(null)} />
                <p className="text-xs text-slate-500">The SLA clock stops until the job is resumed.</p>
                <div className="grid grid-cols-2 gap-2">
                  {HOLD_REASONS.map((r) => (
                    <button key={r} onClick={() => set('reason', r)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${f.reason === r ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-500/10' : 'border-slate-200 dark:border-slate-700'}`}>{r}</button>
                  ))}
                </div>
                <textarea rows={2} value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Details (e.g. compressor ordered, ETA Thursday)" className="enterprise-input" />
                <DlgButtons busy={busy} label="Put on hold" onCancel={() => setDialog(null)} onOk={() => run('hold', { hold_reason: f.note ? `${f.reason} — ${f.note}` : f.reason })} />
              </>
            )}
            {dialog === 'work_done' && (
              <>
                <DlgTitle title="Mark work done" onClose={() => setDialog(null)} />
                <Field label="What did you do? *"><textarea rows={3} value={f.work} onChange={(e) => set('work', e.target.value)} className="enterprise-input" placeholder="e.g. Replaced fan motor capacitor, tested for 15 min" /></Field>
                <Field label="Root cause"><input value={f.cause} onChange={(e) => set('cause', e.target.value)} className="enterprise-input" placeholder="e.g. Capacitor failed (age)" /></Field>
                <Field label="Recommendation"><input value={f.action} onChange={(e) => set('action', e.target.value)} className="enterprise-input" placeholder="e.g. Replace unit within 6 months" /></Field>
                {!(wo.photos || []).some((ph) => ph.photo_type === 'after') && <p className="text-[11px] text-orange-600">Tip: add an "After" photo before finishing.</p>}
                <DlgButtons busy={busy} disabled={!String(f.work || '').trim()} label="Work done" onCancel={() => setDialog(null)} onOk={() => run('work_done', { work_performed: f.work.trim(), root_cause: f.cause?.trim() || null, action_taken: f.action?.trim() || null } as any)} />
              </>
            )}
            {dialog === 'complete' && (
              <>
                <DlgTitle title="Verify and complete" onClose={() => setDialog(null)} />
                <p className="text-xs text-slate-500">Confirm the work is done to standard and record the client's sign-off.</p>
                <Field label="Signed off by (client / tenant)"><input value={f.name} onChange={(e) => set('name', e.target.value)} className="enterprise-input" /></Field>
                <Field label="Client rating">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => set('rating', n)}><Star className={`h-6 w-6 ${n <= f.rating ? 'fill-orange-400 text-orange-400' : 'text-slate-300'}`} /></button>
                    ))}
                  </div>
                </Field>
                <Field label="Client comment"><input value={f.comment} onChange={(e) => set('comment', e.target.value)} className="enterprise-input" /></Field>
                <DlgButtons busy={busy} label="Complete job" onCancel={() => setDialog(null)} onOk={() => run('complete', { client_signoff_name: f.name || null, client_rating: f.rating || null, client_comment: f.comment || null })} />
              </>
            )}
            {(dialog === 'cancel' || dialog === 'send_back') && (
              <>
                <DlgTitle title={dialog === 'cancel' ? 'Cancel job' : 'Send back to technician'} onClose={() => setDialog(null)} />
                <textarea rows={3} value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder={dialog === 'cancel' ? 'Why is this job cancelled? (e.g. duplicate of WO-…)' : 'What still needs doing?'} className="enterprise-input" />
                <DlgButtons
                  busy={busy}
                  disabled={!String(f.reason || '').trim()}
                  label={dialog === 'cancel' ? 'Cancel job' : 'Send back'}
                  danger={dialog === 'cancel'}
                  onCancel={() => setDialog(null)}
                  onOk={() => (dialog === 'cancel' ? run('cancel', { cancel_reason: f.reason.trim() }) : run('send_back', { remarks: `Sent back: ${f.reason.trim()}`, work_done_at: null } as any))}
                />
              </>
            )}
            {dialog === 'manual_time' && (
              <>
                <DlgTitle title="Add time manually" onClose={() => setDialog(null)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select value={f.type} onChange={(e) => set('type', e.target.value)} className="enterprise-input"><option>Labour</option><option>Travel</option></select>
                  </Field>
                  <Field label="Hours"><input type="number" step="0.25" min="0" value={f.hours} onChange={(e) => set('hours', e.target.value)} className="enterprise-input" /></Field>
                </div>
                <Field label="Who"><input value={f.who} onChange={(e) => set('who', e.target.value)} className="enterprise-input" /></Field>
                <Field label="Note"><input value={f.note} onChange={(e) => set('note', e.target.value)} className="enterprise-input" /></Field>
                <DlgButtons
                  busy={busy}
                  disabled={!(Number(f.hours) > 0)}
                  label="Add"
                  onCancel={() => setDialog(null)}
                  onOk={async () => {
                    setBusy(true);
                    try {
                      await workOrderService.addManualTime(wo.id, { record_type: f.type, hours: Number(f.hours), technician_name: f.who || undefined, note: f.note || undefined, started_at: new Date().toISOString() });
                      setDialog(null);
                      await refreshSide(wo.id);
                    } catch (e: any) {
                      setError(e?.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </>
            )}
            {dialog === 'delete' && (
              <>
                <DlgTitle title="Delete work order" onClose={() => setDialog(null)} />
                <p className="text-xs text-slate-600 dark:text-slate-300">Permanently delete <b>{wo.wo_number}</b> with its history and photos? Cancelling keeps a record — prefer that for real jobs.</p>
                <DlgButtons busy={busy} danger label="Delete" onCancel={() => setDialog(null)} onOk={async () => { setBusy(true); await cafmDataService.deleteWorkOrder(wo.id); navigate('/work-orders'); }} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- pieces
const Block: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500">{title}</h3>
    {children}
  </section>
);

const Def: React.FC<{ k: string; v: string; wide?: boolean }> = ({ k, v, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-slate-500">{k}</dt>
    <dd className="mt-0.5 whitespace-pre-wrap text-slate-800 dark:text-slate-100">{v}</dd>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="text-lg font-bold text-ocs-blue dark:text-white">{value}</div>
  </div>
);

const CLOCK_STYLE: Record<ClockResult['state'], { ring: string; text: string; icon: React.ElementType }> = {
  none: { ring: 'border-slate-200 dark:border-slate-700', text: 'text-slate-400', icon: Clock },
  met: { ring: 'border-emerald-200 dark:border-emerald-900', text: 'text-emerald-600', icon: CheckCircle2 },
  late: { ring: 'border-rose-200 dark:border-rose-900', text: 'text-ocs-red', icon: XCircle },
  running: { ring: 'border-slate-200 dark:border-slate-700', text: 'text-ocs-blue dark:text-white', icon: Clock },
  warning: { ring: 'border-orange-200 dark:border-orange-900', text: 'text-orange-600', icon: Clock },
  overdue: { ring: 'border-rose-300 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/30', text: 'text-ocs-red', icon: XCircle },
  paused: { ring: 'border-sky-200 dark:border-sky-900', text: 'text-sky-600', icon: PauseCircle },
};

const ClockCard: React.FC<{ title: string; hint: string; c: ClockResult }> = ({ title, hint, c }) => {
  const st = CLOCK_STYLE[c.state];
  const Icon = st.icon;
  const pct = c.targetMs && c.actualMs != null ? Math.min(100, Math.round((c.actualMs / c.targetMs) * 100)) : 0;
  return (
    <div className={`rounded-lg border p-3 ${st.ring}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</span>
        <Icon className={`h-4 w-4 ${st.text}`} />
      </div>
      <div className="text-[10px] text-slate-500">{hint}</div>
      <div className={`mt-2 text-sm font-bold ${st.text}`}>{c.label}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full ${c.state === 'overdue' || c.state === 'late' ? 'bg-ocs-red' : c.state === 'warning' ? 'bg-orange-500' : c.state === 'met' ? 'bg-emerald-500' : c.state === 'paused' ? 'bg-sky-400' : 'bg-teal-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
        <span>Target {c.targetMs != null ? formatDuration(c.targetMs) : '—'}</span>
        <span>Actual {c.actualMs != null ? formatDuration(c.actualMs) : '—'}</span>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const DlgTitle: React.FC<{ title: string; onClose: () => void }> = ({ title, onClose }) => (
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-bold text-ocs-blue dark:text-white">{title}</h3>
    <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
  </div>
);

const DlgButtons: React.FC<{ busy: boolean; label: string; onOk: () => void; onCancel: () => void; disabled?: boolean; danger?: boolean }> = ({ busy, label, onOk, onCancel, disabled, danger }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Back</button>
    <button onClick={onOk} disabled={busy || disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} <Check className="h-3.5 w-3.5" /> {label}
    </button>
  </div>
);
