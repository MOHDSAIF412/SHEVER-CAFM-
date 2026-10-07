import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarDays, Loader2, Pencil, Play, Plus, Search, Trash2, X, Zap } from 'lucide-react';
import { FREQUENCIES, Frequency, PpmPlan, ppmService, visitsPerYear } from '../../api/ppm';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { Template, checklistService } from '../../api/checklists';
import { cafmDataService } from '../../api/supabase';
import { useAuth } from '../../context/AuthContext';
import { PRIORITY_META, statusMeta } from '../../utils/woFlow';
import { Category, SlaPriority, UserProfile, WorkOrder } from '../../types';

/**
 * PPM plans: what gets maintained, how often, with which checklist and by
 * whom. Jobs are generated from these automatically every morning.
 */

const fmtDate = (d?: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const daysFromToday = (d: string) => Math.round((new Date(`${d}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);

export const PPMPlansList: React.FC = () => {
  const { canEdit, canDelete, isSupervisor, isAdmin, isManager } = useAuth();
  const canGenerate = isAdmin || isManager || isSupervisor;

  const [plans, setPlans] = useState<PpmPlan[] | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [checklists, setChecklists] = useState<Template[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [techs, setTechs] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState('');
  const [freq, setFreq] = useState('');
  const [editing, setEditing] = useState<PpmPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);

  const notify = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 4500);
  };

  const load = async () => {
    const [p, j, hier, cl, cats, t] = await Promise.all([
      ppmService.plans(),
      ppmService.jobs(),
      hierarchyService.loadAll(),
      checklistService.templates(),
      cafmDataService.getCategories(),
      cafmDataService.getTechnicians(),
    ]);
    setPlans(p);
    setJobs(j);
    setH(hier);
    setChecklists(cl.filter((c) => !c.applies_to || c.applies_to === 'PPM'));
    setCategories(cats);
    setTechs(t);
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async (planId?: string) => {
    if (!h) return;
    setBusy(planId || 'all');
    try {
      const n = await ppmService.generate(h, planId);
      notify(n ? `${n} PPM job(s) created.` : 'Nothing new due — all upcoming PPM jobs already exist.');
      await load();
    } catch (e: any) {
      notify(e?.message || 'Could not generate jobs.', true);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: PpmPlan) => {
    if (!confirm(`Delete plan ${p.ppm_code}? Jobs already created stay; no new ones will be made. To pause it instead, untick "Active".`)) return;
    try {
      await ppmService.remove(p.id);
      await load();
    } catch (e: any) {
      notify(e?.message || 'Could not delete.', true);
    }
  };

  const toggleActive = async (p: PpmPlan) => {
    try {
      await ppmService.save([{ ...p, is_active: p.is_active === false }]);
      await load();
    } catch (e: any) {
      notify(e?.message || 'Could not update.', true);
    }
  };

  const assetOf = (p: PpmPlan) => h?.assets.find((a) => a.id === p.asset_id);
  const placeOf = (p: PpmPlan) => (h ? roomPath(h, p.location_id || assetOf(p)?.location_id || '').join(' / ') : '');
  const lastJob = (p: PpmPlan) => jobs.filter((j) => j.ppm_plan_id === p.id).sort((a, b) => (b.ppm_due_date || '').localeCompare(a.ppm_due_date || ''))[0];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (plans || []).filter((p) => {
      if (freq && p.frequency !== freq) return false;
      if (!q) return true;
      return `${p.ppm_code} ${p.title} ${assetOf(p)?.asset_number || ''} ${placeOf(p)}`.toLowerCase().includes(q);
    });
  }, [plans, query, freq, h]);

  const kpi = useMemo(() => {
    const active = (plans || []).filter((p) => p.is_active !== false);
    const visits = active.reduce((n, p) => n + (visitsPerYear[p.frequency] ?? Math.round(365 / Math.max(p.custom_interval_days || 30, 1))), 0);
    const in7 = active.filter((p) => daysFromToday(p.next_due_date) <= 7).length;
    const overdue = jobs.filter((j) => j.ppm_due_date && daysFromToday(j.ppm_due_date) < 0 && !j.work_done_at && !['Work Done', 'Completed', 'Closed', 'Cancelled'].includes(j.status)).length;
    return { active: active.length, visits, in7, overdue };
  }, [plans, jobs]);

  if (!plans || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading PPM plans…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">PPM Plans</h1>
          <p className="text-xs text-slate-500">Jobs are created automatically every morning, up to each plan's lead time before the due date.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/ppm/planner" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <CalendarDays className="h-4 w-4" /> Yearly planner
          </Link>
          {canGenerate && (
            <button onClick={() => generate()} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-orange-500" />} Generate due jobs now
            </button>
          )}
          {canEdit && (
            <button onClick={() => setEditing(ppmService.blank())} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
              <Plus className="h-4 w-4" /> New plan
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Active plans" value={kpi.active} />
        <Kpi label="Visits per year" value={kpi.visits} />
        <Kpi label="Due in 7 days" value={kpi.in7} tone="text-orange-500" />
        <Kpi label="Overdue PPM jobs" value={kpi.overdue} tone="text-ocs-red" />
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, title, asset, place…" className="enterprise-input pl-8" />
          </div>
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className="enterprise-input w-auto">
            <option value="">All frequencies</option>
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>

        {shown.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            {plans.length === 0 ? 'No PPM plans yet. Create one to start scheduling planned maintenance.' : 'No plans match.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2">Asset / place</th>
                  <th className="px-4 py-2">Frequency</th>
                  <th className="px-4 py-2">Checklist</th>
                  <th className="px-4 py-2">Technician</th>
                  <th className="px-4 py-2">Next due</th>
                  <th className="px-4 py-2">Last job</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.map((p) => {
                  const a = assetOf(p);
                  const last = lastJob(p);
                  const dd = daysFromToday(p.next_due_date);
                  const off = p.is_active === false;
                  return (
                    <tr key={p.id} className={off ? 'opacity-50' : ''}>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-[11px] text-slate-500">{p.ppm_code}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{p.title}</div>
                      </td>
                      <td className="max-w-[260px] px-4 py-2.5">
                        {a && <div className="font-mono text-[11px]">{a.asset_number} · {a.name}</div>}
                        <div className="truncate text-[11px] text-slate-500">{placeOf(p) || <span className="text-ocs-red">No place — jobs can't be created</span>}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-ocs-blue/10 px-1.5 py-0.5 font-semibold text-ocs-blue dark:bg-white/10 dark:text-white">{p.frequency === 'Custom' ? `Every ${p.custom_interval_days} days` : p.frequency}</span>
                      </td>
                      <td className="px-4 py-2.5">{checklists.find((c) => c.id === p.checklist_id)?.title || <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-2.5">{techs.find((t) => t.id === p.assigned_technician_id)?.full_name || <span className="text-slate-400">Unassigned</span>}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold">{fmtDate(p.next_due_date)}</div>
                        {!off && <div className={`text-[10px] ${dd <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>{dd === 0 ? 'today' : dd > 0 ? `in ${dd} days` : `${-dd} days ago`}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        {last ? (
                          <Link to={`/work-orders/${last.id}`} className="inline-flex flex-col">
                            <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta(last.status).pill}`}>{statusMeta(last.status).label}</span>
                            <span className="text-[10px] text-slate-500">due {fmtDate(last.ppm_due_date)}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">None yet</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canGenerate && !off && (
                            <button onClick={() => generate(p.id)} title="Create due jobs for this plan now" className="rounded p-1.5 text-slate-400 hover:text-orange-500">
                              {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                            </button>
                          )}
                          {canEdit && (
                            <>
                              <label title="Active" className="flex cursor-pointer items-center px-1">
                                <input type="checkbox" checked={!off} onChange={() => toggleActive(p)} />
                              </label>
                              <button onClick={() => setEditing({ ...p })} title="Edit" className="rounded p-1.5 text-slate-400 hover:text-teal-600"><Pencil className="h-4 w-4" /></button>
                            </>
                          )}
                          {canDelete && <button onClick={() => remove(p)} title="Delete" className="rounded p-1.5 text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <PlanForm
          plan={editing}
          isNew={!plans.some((p) => p.id === editing.id)}
          plans={plans}
          h={h}
          checklists={checklists}
          categories={categories}
          techs={techs}
          hasJobs={jobs.some((j) => j.ppm_plan_id === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={async (n) => {
            setEditing(null);
            notify(n > 1 ? `${n} PPM plans created.` : 'PPM plan saved.');
            await load();
          }}
        />
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 rounded-lg px-4 py-3 text-xs font-semibold text-white shadow-lg ${toast.error ? 'bg-ocs-red' : 'bg-ocs-blue'}`}>{toast.msg}</div>
      )}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number; tone?: string }> = ({ label, value, tone = 'text-ocs-blue dark:text-white' }) => (
  <div className="enterprise-card p-3">
    <div className={`text-xl font-bold ${tone}`}>{value}</div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
  </div>
);

// --------------------------------------------------------------------------
// Plan form: one asset, a room, or the same plan on many assets at once
// --------------------------------------------------------------------------
const PlanForm: React.FC<{
  plan: PpmPlan;
  isNew: boolean;
  plans: PpmPlan[];
  h: Hierarchy;
  checklists: Template[];
  categories: Category[];
  techs: UserProfile[];
  hasJobs: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
}> = ({ plan, isNew, plans, h, checklists, categories, techs, hasJobs, onClose, onSaved }) => {
  const [p, setP] = useState<PpmPlan>(plan);
  const [target, setTarget] = useState<'assets' | 'room'>(plan.asset_id || isNew ? 'assets' : 'room');
  const [picked, setPicked] = useState<Set<string>>(new Set(plan.asset_id ? [plan.asset_id] : []));
  const [assetQuery, setAssetQuery] = useState('');
  const [assetCat, setAssetCat] = useState('');
  const [assetBld, setAssetBld] = useState('');
  const [roomId, setRoomId] = useState(plan.location_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof PpmPlan>(k: K, v: PpmPlan[K]) => setP((x) => ({ ...x, [k]: v }));

  const assetList = useMemo(() => {
    const q = assetQuery.trim().toLowerCase();
    return h.assets.filter(
      (a) =>
        (!assetCat || a.category_id === assetCat) &&
        (!assetBld || a.building_id === assetBld) &&
        (!q || `${a.asset_number} ${a.name} ${a.type || ''}`.toLowerCase().includes(q))
    );
  }, [h.assets, assetQuery, assetCat, assetBld]);

  const togglePick = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (!isNew) n.clear();
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    setError('');
    if (!p.checklist_id) return setError('Choose the checklist the technician will fill.');
    if (p.frequency === 'Custom' && !(Number(p.custom_interval_days) > 0)) return setError('Enter how many days between visits.');
    if (p.end_date && p.end_date < p.start_date) return setError('End date is before the start date.');
    const ids = [...picked];
    if (target === 'assets' && ids.length === 0) return setError('Pick at least one asset.');
    if (target === 'room' && !roomId) return setError('Choose the room.');
    if (target === 'room' && !p.title.trim()) return setError('Give the plan a title.');

    // A new plan, or one whose start moved before any job exists, starts at its start date.
    const nextDue = isNew || !hasJobs ? p.start_date : p.next_due_date;
    const base: PpmPlan = {
      ...p,
      next_due_date: nextDue,
      custom_interval_days: p.frequency === 'Custom' ? Number(p.custom_interval_days) : null,
      lead_days: Number(p.lead_days ?? 7),
      est_hours: p.est_hours ? Number(p.est_hours) : null,
    };

    let rows: PpmPlan[];
    if (target === 'room') {
      const room = h.rooms.find((r) => r.id === roomId)!;
      const floor = h.floors.find((f) => f.id === room.floor_id);
      const bld = floor && h.buildings.find((b) => b.id === floor.building_id);
      rows = [{ ...base, asset_id: null, location_id: room.id, floor_id: floor?.id || null, building_id: bld?.id || null, facility_id: bld?.facility_id || null, ppm_code: p.ppm_code || ppmService.nextCode(plans) }];
    } else {
      rows = ids.map((assetId, n) => {
        const a = h.assets.find((x) => x.id === assetId)!;
        return {
          ...base,
          id: n === 0 ? base.id : crypto.randomUUID(),
          ppm_code: n === 0 && p.ppm_code ? p.ppm_code : ppmService.nextCode(plans, n),
          title: ids.length > 1 || !p.title.trim() ? `${a.name} — ${p.frequency} PPM` : p.title.trim(),
          asset_id: a.id,
          location_id: a.location_id,
          floor_id: a.floor_id,
          building_id: a.building_id,
          facility_id: a.facility_id || null,
          category_id: p.category_id || a.category_id,
        };
      });
    }
    setSaving(true);
    try {
      await ppmService.save(rows);
      onSaved(rows.length);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
      setSaving(false);
    }
  };

  const cl = checklists.find((c) => c.id === p.checklist_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => !saving && onClose()}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ocs-blue dark:text-white">
            <CalendarClock className="h-4 w-4 text-orange-500" /> {isNew ? 'New PPM plan' : `Edit ${p.ppm_code}`}
          </h3>
          <button onClick={onClose} className="text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

        {/* What */}
        <Section title="What is maintained">
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
            {(['assets', 'room'] as const).map((t) => (
              <button key={t} onClick={() => setTarget(t)} className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${target === t ? 'bg-ocs-blue text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                {t === 'assets' ? (isNew ? 'Asset(s)' : 'Asset') : 'A room / area (no asset)'}
              </button>
            ))}
          </div>
          {target === 'assets' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} placeholder="Search assets…" className="enterprise-input min-w-[180px] flex-1" />
                <select value={assetCat} onChange={(e) => setAssetCat(e.target.value)} className="enterprise-input w-auto">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={assetBld} onChange={(e) => setAssetBld(e.target.value)} className="enterprise-input w-auto">
                  <option value="">All buildings</option>
                  {h.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {isNew && assetList.length > 1 && (
                  <label className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold dark:border-slate-800 dark:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={assetList.every((a) => picked.has(a.id))}
                      onChange={(e) => setPicked((s) => { const n = new Set(s); assetList.forEach((a) => (e.target.checked ? n.add(a.id) : n.delete(a.id))); return n; })}
                    />
                    Select all {assetList.length} shown
                  </label>
                )}
                {assetList.length === 0 && <p className="p-3 text-xs text-slate-500">No assets found. Register assets in the Facility Hierarchy first.</p>}
                {assetList.slice(0, 300).map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type={isNew ? 'checkbox' : 'radio'} checked={picked.has(a.id)} onChange={() => togglePick(a.id)} />
                    <span className="font-mono text-[11px]">{a.asset_number}</span> {a.name}
                    <span className="ml-auto truncate text-[10px] text-slate-500">{roomPath(h, a.location_id).slice(1).join(' / ')}</span>
                  </label>
                ))}
              </div>
              {picked.size > 1 && <p className="text-[11px] text-teal-700 dark:text-teal-300">{picked.size} assets selected — one plan will be created for each, with the settings below.</p>}
            </div>
          ) : (
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="enterprise-input">
              <option value="">Choose room…</option>
              {h.rooms.map((r) => <option key={r.id} value={r.id}>{roomPath(h, r.id).join(' / ')}</option>)}
            </select>
          )}
          {(target === 'room' || picked.size <= 1) && (
            <F label={target === 'room' ? 'Title *' : 'Title (blank = asset name + frequency)'}>
              <input value={p.title} onChange={(e) => set('title', e.target.value)} className="enterprise-input" placeholder="e.g. Fire pump room — monthly inspection" />
            </F>
          )}
        </Section>

        {/* How */}
        <Section title="Checklist and schedule">
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Checklist *">
              <select value={p.checklist_id || ''} onChange={(e) => set('checklist_id', e.target.value)} className="enterprise-input">
                <option value="">Choose…</option>
                {checklists.filter((c) => c.is_active || c.id === p.checklist_id).map((c) => <option key={c.id} value={c.id}>{c.title} ({c.items.length})</option>)}
              </select>
            </F>
            <F label="Frequency">
              <div className="flex gap-2">
                <select value={p.frequency} onChange={(e) => set('frequency', e.target.value as Frequency)} className="enterprise-input">
                  {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                </select>
                {p.frequency === 'Custom' && (
                  <input type="number" min={1} value={p.custom_interval_days ?? ''} onChange={(e) => set('custom_interval_days', Number(e.target.value))} placeholder="days" className="enterprise-input w-24" />
                )}
              </div>
            </F>
            <F label={hasJobs ? 'Start date (jobs already exist — next due stays as is)' : 'First visit (start date)'}>
              <input type="date" value={p.start_date} onChange={(e) => set('start_date', e.target.value)} className="enterprise-input" />
            </F>
            <F label="End date (optional)">
              <input type="date" value={p.end_date || ''} onChange={(e) => set('end_date', e.target.value || null)} className="enterprise-input" />
            </F>
            <F label="Create the job how many days before it is due?">
              <input type="number" min={0} max={60} value={p.lead_days ?? 7} onChange={(e) => set('lead_days', Number(e.target.value))} className="enterprise-input" />
            </F>
            <F label="Priority">
              <div className="flex gap-1">
                {(['P1', 'P2', 'P3', 'P4'] as SlaPriority[]).map((x) => (
                  <button key={x} onClick={() => set('sla_priority', x)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold ${p.sla_priority === x ? `${PRIORITY_META[x].chip} border-transparent` : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}>{x}</button>
                ))}
              </div>
            </F>
          </div>
          {cl && <p className="text-[11px] text-slate-500">Each visit uses "{cl.title}" — {cl.items.length} checks.</p>}
        </Section>

        {/* Who */}
        <Section title="Who">
          <div className="grid gap-3 sm:grid-cols-3">
            <F label="Technician (jobs are assigned automatically)">
              <select value={p.assigned_technician_id || ''} onChange={(e) => set('assigned_technician_id', e.target.value || null)} className="enterprise-input">
                <option value="">Leave unassigned</option>
                {techs.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </F>
            <F label="Estimated hours per visit">
              <input type="number" step="0.25" min={0} value={p.est_hours ?? ''} onChange={(e) => set('est_hours', e.target.value === '' ? null : Number(e.target.value))} className="enterprise-input" />
            </F>
            <F label="Notes">
              <input value={p.notes || ''} onChange={(e) => set('notes', e.target.value)} className="enterprise-input" />
            </F>
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isNew && picked.size > 1 && target === 'assets' ? `Create ${picked.size} plans` : 'Save plan'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset className="space-y-2">
    <legend className="mb-1 text-[10px] font-bold uppercase tracking-wider text-orange-500">{title}</legend>
    {children}
  </fieldset>
);

const F: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);
