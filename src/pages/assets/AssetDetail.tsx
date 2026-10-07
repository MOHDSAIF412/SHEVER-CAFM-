import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, CalendarCheck2, Coins, Loader2, MapPin, Pencil, PlusCircle, QrCode, ShieldAlert } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { PpmPlan, ppmService, visitState, VISIT_META } from '../../api/ppm';
import { aed, costingService } from '../../api/costing';
import { AssetQRCodeModal } from '../../components/AssetQRCodeModal';
import { AssetFormModal } from '../../components/AssetFormModal';
import { useAuth } from '../../context/AuthContext';
import { isOpen, priorityOf, PRIORITY_META, statusMeta } from '../../utils/woFlow';
import { Asset, JobCosting, WorkOrder } from '../../types';

/**
 * Asset 360: where it is, its warranty / AMC, PPM plans and visits,
 * breakdown history (repeat faults stand out) and, for supervisors and
 * managers, what it has cost to maintain.
 */
export const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { canEdit, isAdmin, isManager, isSupervisor } = useAuth();
  const lead = isAdmin || isManager || isSupervisor;
  const [asset, setAsset] = useState<Asset | null | undefined>(undefined);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);
  const [plans, setPlans] = useState<PpmPlan[]>([]);
  const [costs, setCosts] = useState<Map<string, JobCosting>>(new Map());
  const [qr, setQr] = useState(false);
  const [edit, setEdit] = useState(false);

  const load = async () => {
    if (!id) return;
    const [a, hier, w, p] = await Promise.all([cafmDataService.getAssetById(id), hierarchyService.loadAll(), cafmDataService.getWorkOrders(), ppmService.plans()]);
    setAsset(a || null);
    setH(hier);
    const mine = w.filter((x) => x.asset_id === id).sort((x, y) => y.created_at.localeCompare(x.created_at));
    setJobs(mine);
    setPlans(p.filter((x) => x.asset_id === id));
    if (lead && mine.length) setCosts(await costingService.allTotals(mine));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const stats = useMemo(() => {
    const breakdowns = jobs.filter((w) => w.wo_type !== 'PPM' && w.status !== 'Cancelled');
    const yearAgo = Date.now() - 365 * 86_400_000;
    const ppm = jobs.filter((w) => w.wo_type === 'PPM' && w.ppm_due_date);
    let cost = 0;
    costs.forEach((c) => (cost += c.total_cost));
    return {
      breakdowns,
      last12: breakdowns.filter((w) => new Date(w.created_at).getTime() >= yearAgo).length,
      open: jobs.filter((w) => isOpen(w.status)),
      ppm,
      cost,
    };
  }, [jobs, costs]);

  if (asset === undefined || !h) {
    return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading asset…</div>;
  }
  if (asset === null) {
    return <div className="py-20 text-center text-sm text-slate-500">Asset not found. <Link to="/assets" className="font-semibold text-teal-600">Back to assets</Link></div>;
  }

  const today = new Date().toISOString().slice(0, 10);
  const expiry = (d?: string) => (!d ? null : d < today ? 'expired' : d <= new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10) ? 'soon' : 'ok');
  const fmt = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
  const path = roomPath(h, asset.location_id);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/assets" className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500">{asset.asset_number}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${asset.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : asset.status === 'Under Maintenance' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{asset.status}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{asset.criticality} criticality</span>
            </div>
            <h1 className="text-xl font-bold text-ocs-blue dark:text-white">{asset.name}</h1>
            <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5 text-orange-500" /> {path.join(' / ') || '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setQr(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><QrCode className="h-4 w-4" /> QR label</button>
          {canEdit && <button onClick={() => setEdit(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><Pencil className="h-4 w-4" /> Edit</button>}
          <Link to={`/work-orders/new?asset=${asset.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"><PlusCircle className="h-4 w-4" /> Report a fault</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open jobs" value={stats.open.length} tone={stats.open.length ? 'text-orange-600' : 'text-slate-500'} />
        <Stat label="Breakdowns (12 months)" value={stats.last12} tone={stats.last12 >= 3 ? 'text-ocs-red' : 'text-ocs-blue dark:text-white'} sub={stats.last12 >= 3 ? 'Repeat faults — review' : undefined} />
        <Stat label="PPM plans" value={plans.filter((p) => p.is_active !== false).length} tone="text-ocs-blue dark:text-white" />
        {lead ? <Stat label="Maintenance cost" value={aed(stats.cost, 0)} tone="text-ocs-blue dark:text-white" sub="all recorded jobs" /> : <Stat label="Jobs recorded" value={jobs.length} tone="text-ocs-blue dark:text-white" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Equipment">
            <Row k="Manufacturer" v={asset.manufacturer} />
            <Row k="Model" v={asset.model} />
            <Row k="Serial no." v={asset.serial_number} />
            <Row k="Trade" v={asset.category?.name} />
            <Row k="Installed" v={fmt(asset.installation_date)} />
            {asset.expected_life_years ? <Row k="Expected life" v={`${asset.expected_life_years} years`} /> : null}
            {lead && asset.purchase_cost ? <Row k="Purchase cost" v={aed(asset.purchase_cost, 0)} /> : null}
          </Card>
          <Card title="Warranty & AMC">
            <Row k="Warranty until" v={<Expiry d={asset.warranty_expiry} state={expiry(asset.warranty_expiry)} fmt={fmt} />} />
            <Row k="AMC" v={asset.amc_start || asset.amc_expiry ? `${fmt(asset.amc_start)} → ${fmt(asset.amc_expiry)}` : '—'} />
            {asset.amc_expiry && <Row k="AMC status" v={<Expiry d={asset.amc_expiry} state={expiry(asset.amc_expiry)} fmt={fmt} />} />}
            {expiry(asset.warranty_expiry) === 'ok' && <p className="flex items-center gap-1 pt-1 text-[11px] text-emerald-700"><ShieldAlert className="h-3.5 w-3.5" /> Under warranty — check with the supplier before paying for repairs.</p>}
          </Card>
          <Card title="PPM plans" icon={CalendarCheck2}>
            {plans.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">No PPM plan. <Link to="/ppm/plans" className="font-semibold text-teal-600">Create one</Link></p>
            ) : plans.map((p) => (
              <div key={p.id} className="py-1.5 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-100">{p.ppm_code} · {p.frequency}{p.is_active === false ? ' (paused)' : ''}</div>
                <div className="text-[10px] text-slate-500">Next due {fmt(p.next_due_date)}</div>
              </div>
            ))}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={`Job history (${jobs.length})`} icon={Activity}>
            {jobs.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No jobs recorded on this asset.</p>}
            {jobs.slice(0, 40).map((w) => {
              const p = priorityOf(w);
              const c = costs.get(w.id);
              const visit = w.wo_type === 'PPM' && w.ppm_due_date ? VISIT_META[visitState(w.ppm_due_date, w)] : null;
              return (
                <Link key={w.id} to={`/work-orders/${w.id}`} className="flex items-center gap-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <span className={`w-8 shrink-0 rounded py-0.5 text-center text-[10px] font-bold ${PRIORITY_META[p].chip}`}>{p}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-slate-800 dark:text-slate-100">{w.problem_description?.split('\n')[0]}</span>
                    <span className="text-[10px] text-slate-500">{w.wo_number} · {w.wo_type || 'Reactive'} · {fmt(w.created_at)}{w.root_cause ? ` · cause: ${w.root_cause}` : ''}</span>
                  </span>
                  {visit && <span className={`hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${visit.cls}`}>{visit.label}</span>}
                  {lead && c ? <span className="shrink-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{aed(c.total_cost, 0)}</span> : null}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta(w.status).pill}`}>{statusMeta(w.status).label}</span>
                </Link>
              );
            })}
          </Card>
          {lead && stats.cost > 0 && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><Coins className="h-3.5 w-3.5" /> Cost is labour, materials and subcontract recorded on the jobs (cost to OCS).</p>
          )}
        </div>
      </div>

      {qr && <AssetQRCodeModal asset={asset} onClose={() => setQr(false)} />}
      {edit && <AssetFormModal hierarchy={h} asset={asset} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
    </div>
  );
};

const Card: React.FC<{ title: string; icon?: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
  <div className="enterprise-card p-4">
    <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-500">{Icon && <Icon className="h-3.5 w-3.5" />} {title}</h3>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
  </div>
);

const Row: React.FC<{ k: string; v?: React.ReactNode }> = ({ k, v }) => (
  <div className="flex justify-between gap-3 py-1.5 text-xs"><span className="text-slate-500">{k}</span><span className="text-right font-semibold text-slate-800 dark:text-slate-100">{v || '—'}</span></div>
);

const Stat: React.FC<{ label: string; value: React.ReactNode; tone: string; sub?: string }> = ({ label, value, tone, sub }) => (
  <div className="enterprise-card p-3">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-xl font-bold ${tone}`}>{value}</div>
    {sub && <div className="text-[10px] font-semibold text-ocs-red">{sub}</div>}
  </div>
);

const Expiry: React.FC<{ d?: string; state: string | null; fmt: (d?: string) => string }> = ({ d, state, fmt }) =>
  !d ? <>—</> : <span className={state === 'expired' ? 'text-ocs-red' : state === 'soon' ? 'text-orange-600' : 'text-emerald-600'}>{fmt(d)}{state === 'expired' ? ' (expired)' : state === 'soon' ? ' (expires soon)' : ''}</span>;
