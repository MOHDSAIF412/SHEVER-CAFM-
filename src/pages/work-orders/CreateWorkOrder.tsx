import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Building2, Check, Droplets, Flame, Leaf, Loader2, MapPin, Paintbrush, Search, Snowflake, Sparkles, Bug, Zap, X,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { ServiceMatrix, workOrderService } from '../../api/workOrders';
import { Template, checklistService } from '../../api/checklists';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { formatDuration } from '../../utils/sla';
import { PRIORITY_META, WO_TYPES } from '../../utils/woFlow';
import { Category, SlaPolicy, SlaPriority, UserProfile, WorkOrderType } from '../../types';

/**
 * One page instead of a four-step wizard: what is wrong, where, how urgent,
 * who reported it. Picking a job type fills trade and priority, picking a room
 * fills the building / floor / facility, and the SLA deadlines are previewed
 * live before saving.
 */

const TYPE_ICON: Record<string, React.ElementType> = {
  HVAC: Snowflake, ELEC: Zap, PLMB: Droplets, CIVIL: Paintbrush, FLS: Flame, CLEAN: Sparkles, PEST: Bug, LAND: Leaf,
};

const SOURCES = ['Helpdesk', 'Phone', 'Email', 'WhatsApp', 'Mobile'];

export const CreateWorkOrder: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

  const [matrix, setMatrix] = useState<ServiceMatrix | null>(null);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [techs, setTechs] = useState<UserProfile[]>([]);
  const [checklists, setChecklists] = useState<Template[]>([]);
  const [checklistId, setChecklistId] = useState('');

  const [serviceTypeId, setServiceTypeId] = useState('');
  const [jobTypeId, setJobTypeId] = useState('');
  const [jobSearch, setJobSearch] = useState('');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState('');

  const [roomId, setRoomId] = useState(params.get('room') || '');
  const [assetId, setAssetId] = useState(params.get('asset') || '');
  const [roomSearch, setRoomSearch] = useState('');

  const [woType, setWoType] = useState<WorkOrderType>('Reactive');
  const [chargeable, setChargeable] = useState(false);
  const [priority, setPriority] = useState<SlaPriority>('P3');
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [reporter, setReporter] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('Helpdesk');
  const [techId, setTechId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      workOrderService.serviceMatrix(),
      hierarchyService.loadAll(),
      workOrderService.slaPolicies(),
      cafmDataService.getCategories(),
      cafmDataService.getTechnicians(),
      checklistService.templates(),
    ]).then(([m, hier, pol, cats, t, cl]) => {
      setChecklists(cl.filter((c) => c.is_active && (!c.applies_to || c.applies_to === 'PPM')));
      setMatrix(m);
      setH(hier);
      setPolicies(pol);
      setCategories(cats);
      setTechs(t);
      // Coming from an asset page: the room follows from the asset.
      const a = params.get('asset') && hier.assets.find((x) => x.id === params.get('asset'));
      if (a) setRoomId(a.location_id);
    });
  }, []);

  const job = matrix?.jobs.find((j) => j.id === jobTypeId);
  const serviceType = matrix?.types.find((t) => t.id === (job?.service_type_id || serviceTypeId));

  const pickJob = (id: string) => {
    setJobTypeId(id);
    const j = matrix?.jobs.find((x) => x.id === id);
    if (j) {
      setServiceTypeId(j.service_type_id);
      if (!priorityTouched) setPriority(j.default_priority);
    }
  };

  const pickType = (t: WorkOrderType) => {
    setWoType(t);
    setChargeable(!!WO_TYPES.find((x) => x.id === t)?.chargeable);
    // Planned maintenance is planned: default it to P4 unless chosen by hand.
    if (t === 'PPM' && !priorityTouched) setPriority('P4');
  };

  const jobsShown = useMemo(() => {
    if (!matrix) return [];
    const q = jobSearch.trim().toLowerCase();
    return matrix.jobs.filter(
      (j) =>
        (q ? `${j.name} ${j.name_ar || ''} ${j.code}`.toLowerCase().includes(q) : !serviceTypeId || j.service_type_id === serviceTypeId)
    );
  }, [matrix, serviceTypeId, jobSearch]);

  const roomResults = useMemo(() => {
    if (!h || !roomSearch.trim()) return [];
    const q = roomSearch.trim().toLowerCase();
    return h.rooms
      .map((r) => ({ room: r, path: roomPath(h, r.id) }))
      .filter(({ room, path }) => `${room.code} ${path.join(' ')}`.toLowerCase().includes(q))
      .slice(0, 12);
  }, [h, roomSearch]);

  const room = h?.rooms.find((r) => r.id === roomId);
  const floor = room && h?.floors.find((f) => f.id === room.floor_id);
  const building = floor && h?.buildings.find((b) => b.id === floor.building_id);
  const roomAssets = h?.assets.filter((a) => a.location_id === roomId) || [];
  const policy = workOrderService.policyFor(policies, priority);

  const techOptions = useMemo(() => {
    const trade = serviceType?.trade_code;
    const matched = techs.filter((t) => trade && (t as any).trade_code === trade);
    return { matched, others: techs.filter((t) => !matched.includes(t)) };
  }, [techs, serviceType]);

  const categoryId = useMemo(() => {
    if (!categories.length) return '';
    if (serviceType?.category_id) return serviceType.category_id;
    const n = (serviceType?.name || '').toLowerCase();
    return (
      categories.find((c) => c.code?.toUpperCase() === serviceType?.code)?.id ||
      categories.find((c) => n && (c.name.toLowerCase().includes(n.split(' ')[0]) || n.includes(c.name.toLowerCase())))?.id ||
      categories[0].id
    );
  }, [categories, serviceType]);

  const submit = async () => {
    setError('');
    if (!description.trim() && !job) return setError('Choose what is wrong, or describe the problem.');
    if (!room || !floor || !building) return setError('Choose the room where the problem is.');
    if (woType === 'PPM' && !checklistId) return setError('Choose the PPM checklist for this job.');
    if (!categoryId) return setError('No categories are set up yet. Add one under Settings → Trades & Types.');
    setSaving(true);
    try {
      const wo = await workOrderService.create(
        {
          wo_type: woType,
          job_type_id: job?.id || null,
          trade: serviceType?.trade_code || null,
          category_id: categoryId,
          sla_priority: priority,
          problem_description: description.trim() || job!.name,
          symptoms: symptoms.trim() || null,
          location_id: room.id,
          floor_id: floor.id,
          building_id: building.id,
          zone_id: room.zone_id || null,
          facility_id: building.facility_id || null,
          asset_id: assetId || undefined,
          is_chargeable: chargeable,
          checklist_id: woType === 'PPM' ? checklistId : null,
          billing_status: 'Not Billable', // moves to 'To Bill' when the job is completed (database trigger)
          reported_by_name: reporter.trim() || user?.full_name,
          reported_by_phone: phone.trim() || undefined,
          source,
          assigned_technician_id: techId || undefined,
        },
        policies
      );
      navigate(`/work-orders/${wo.id}`, { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Could not create the work order.');
      setSaving(false);
    }
  };

  if (!matrix || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const due = (mins?: number | null) =>
    mins ? new Date(Date.now() + mins * 60000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <Link to="/work-orders" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600">
          <ArrowLeft className="h-3.5 w-3.5" /> Work Orders
        </Link>
        <h1 className="text-lg font-bold text-ocs-blue dark:text-white">New work order</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* 1. What */}
          <Card n={1} title="What's wrong?">
            <div className="flex flex-wrap gap-2">
              {matrix.types.map((t) => {
                const Icon = TYPE_ICON[t.code] || Building2;
                const on = serviceTypeId === t.id && !jobSearch;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setServiceTypeId(on ? '' : t.id); setJobSearch(''); }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      on ? 'border-ocs-blue bg-ocs-blue text-white' : 'border-slate-200 text-slate-600 hover:border-teal-300 dark:border-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${on ? 'text-orange-300' : 'text-orange-500'}`} /> {t.name}
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} placeholder="Search job type (English or Arabic)…" className="enterprise-input pl-8" />
            </div>
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
              {jobsShown.map((j) => {
                const on = j.id === jobTypeId;
                return (
                  <button
                    key={j.id}
                    onClick={() => pickJob(on ? '' : j.id)}
                    className={`flex items-start justify-between gap-2 rounded-lg border p-2.5 text-left ${
                      on ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500 dark:bg-teal-500/10' : 'border-slate-200 hover:border-teal-300 dark:border-slate-700'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{j.name}</span>
                      {j.name_ar && <span dir="rtl" className="block text-[11px] text-slate-500">{j.name_ar}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[j.default_priority].chip}`}>{j.default_priority}</span>
                      {on && <Check className="h-4 w-4 text-teal-600" />}
                    </span>
                  </button>
                );
              })}
              {jobsShown.length === 0 && <p className="text-xs text-slate-500">No matching job type — just describe the problem below.</p>}
            </div>
            <Field label={job ? 'Details (optional)' : 'Describe the problem *'}>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="enterprise-input" placeholder="e.g. Meeting room AC blowing warm air since this morning" />
            </Field>
            <Field label="Symptoms seen (optional)">
              <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} className="enterprise-input" placeholder="e.g. Noise, water dripping, burning smell" />
            </Field>
          </Card>

          {/* 2. Where */}
          <Card n={2} title="Where is it?">
            {room ? (
              <div className="flex items-start justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-800 dark:bg-teal-500/10">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-orange-500" />
                  <div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{room.code} · {room.name}</div>
                    <div className="text-[11px] text-slate-500">{roomPath(h, room.id).slice(0, -1).join(' / ')}</div>
                  </div>
                </div>
                <button onClick={() => { setRoomId(''); setAssetId(''); }} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} placeholder="Search room, code, building or facility…" className="enterprise-input pl-8" autoFocus={!!jobTypeId} />
                </div>
                {roomResults.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    {roomResults.map(({ room: r, path }) => (
                      <button key={r.id} onClick={() => { setRoomId(r.id); setRoomSearch(''); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
                        <span className="text-xs font-semibold">{r.code} · {r.name}</span>
                        <span className="block text-[11px] text-slate-500">{path.slice(0, -1).join(' / ')}</span>
                      </button>
                    ))}
                  </div>
                )}
                {roomSearch && roomResults.length === 0 && <p className="text-xs text-slate-500">No room found. Add it under Facility Hierarchy.</p>}
                {h.rooms.length === 0 && <p className="text-xs text-slate-500">No rooms set up yet. <Link to="/facilities" className="font-semibold text-teal-600">Set up facilities first</Link>.</p>}
              </div>
            )}
            {room && (
              <Field label="Asset (optional)">
                <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className="enterprise-input">
                  <option value="">No specific asset</option>
                  {roomAssets.map((a) => <option key={a.id} value={a.id}>{a.asset_number} · {a.name}</option>)}
                </select>
                {roomAssets.length === 0 && <span className="text-[11px] text-slate-400">No assets registered in this room.</span>}
              </Field>
            )}
          </Card>

          {/* 3. How urgent */}
          <Card n={3} title="Type and priority">
            <div className="grid gap-2 sm:grid-cols-5">
              {WO_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => pickType(t.id)}
                  title={t.hint}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
                    woType === t.id ? 'border-ocs-blue bg-ocs-blue text-white' : 'border-slate-200 text-slate-600 hover:border-teal-300 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">{WO_TYPES.find((t) => t.id === woType)?.hint}</p>
            {woType === 'PPM' && (
              <Field label="PPM checklist *">
                <select value={checklistId} onChange={(e) => setChecklistId(e.target.value)} className="enterprise-input">
                  <option value="">Choose checklist…</option>
                  {checklists.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.items.length} items)</option>)}
                </select>
                {checklists.length === 0 && <span className="text-[11px] text-slate-400">No PPM checklists yet — create one under PPM Checklists.</span>}
              </Field>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={chargeable} onChange={(e) => setChargeable(e.target.checked)} />
              Chargeable to the client (labour + materials are billed)
            </label>
            <div className="grid gap-2 sm:grid-cols-4">
              {(['P1', 'P2', 'P3', 'P4'] as SlaPriority[]).map((p) => {
                const pol = workOrderService.policyFor(policies, p);
                const on = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => { setPriority(p); setPriorityTouched(true); }}
                    className={`rounded-lg border p-3 text-left ${on ? `ring-2 ${PRIORITY_META[p].ring} border-transparent` : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[p].chip}`}>{p}</span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{pol?.name || PRIORITY_META[p].name}</span>
                    </div>
                    {pol && (
                      <div className="mt-2 space-y-0.5 text-[10px] text-slate-500">
                        <div>Respond in <b>{formatDuration(pol.response_minutes * 60000)}</b></div>
                        {pol.restoration_minutes ? <div>Make safe in <b>{formatDuration(pol.restoration_minutes * 60000)}</b></div> : null}
                        <div>Fix in <b>{formatDuration(pol.resolution_minutes * 60000)}</b></div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 4. Who */}
          <Card n={4} title="Reported by and assignment">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Reported by"><input value={reporter} onChange={(e) => setReporter(e.target.value)} placeholder={user?.full_name} className="enterprise-input" /></Field>
              <Field label="Contact phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971…" className="enterprise-input" /></Field>
              <Field label="Received via">
                <select value={source} onChange={(e) => setSource(e.target.value)} className="enterprise-input">
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Assign technician now (optional)">
              <select value={techId} onChange={(e) => setTechId(e.target.value)} className="enterprise-input">
                <option value="">Leave unassigned</option>
                {techOptions.matched.length > 0 && (
                  <optgroup label={`${serviceType?.name} technicians`}>
                    {techOptions.matched.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </optgroup>
                )}
                <optgroup label={techOptions.matched.length ? 'Other technicians' : 'Technicians'}>
                  {techOptions.others.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </optgroup>
              </select>
            </Field>
          </Card>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="enterprise-card space-y-4 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Summary</h3>
            <Summary label="Job" value={job?.name || (description ? description.slice(0, 60) : null)} />
            <Summary label="Trade" value={serviceType?.name} />
            <Summary label="Where" value={room ? `${building?.name} · ${room.name}` : null} />
            <Summary label="Type" value={`${woType}${chargeable ? ' · chargeable' : ''}`} />
            {woType === 'PPM' && <Summary label="Checklist" value={checklists.find((c) => c.id === checklistId)?.title} />}
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="mb-2 flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[priority].chip}`}>{priority}</span>
                <span className="text-xs font-semibold">{policy?.name || PRIORITY_META[priority].name} SLA</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="flex justify-between"><span>Respond by</span><b>{due(policy?.response_minutes)}</b></div>
                {policy?.restoration_minutes ? <div className="flex justify-between"><span>Make safe by</span><b>{due(policy.restoration_minutes)}</b></div> : null}
                <div className="flex justify-between"><span>Fix by</span><b>{due(policy?.resolution_minutes)}</b></div>
              </div>
            </div>
            {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
            <button onClick={submit} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create work order
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const Card: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="enterprise-card space-y-3 p-4">
    <h2 className="flex items-center gap-2 text-sm font-bold text-ocs-blue dark:text-white">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[11px] text-white">{n}</span>
      {title}
    </h2>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const Summary: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="flex justify-between gap-3 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className={`text-right font-semibold ${value ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>{value || '—'}</span>
  </div>
);
