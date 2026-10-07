import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { cafmDataService, cloudWrite, isSupabaseConfigured, newId, saveStore, supabase } from '../../api/supabase';
import { ServiceMatrix, workOrderService } from '../../api/workOrders';
import { useAuth } from '../../context/AuthContext';
import { PRIORITY_META } from '../../utils/woFlow';
import { Category, JobType, ServiceType, SlaPriority } from '../../types';

/**
 * The fault list the helpdesk picks from when logging a job:
 * service (HVAC, Electrical…) -> job type ("AC not cooling", default P2).
 * Each service maps to a trade (for technician matching and labour rates)
 * and a category (for reporting).
 */

const PRIORITIES: SlaPriority[] = ['P1', 'P2', 'P3', 'P4'];
const TRADES = ['HVAC', 'ELEC', 'PLMB', 'CIVIL', 'FLS', 'GEN'];

export const JobTypes: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const [m, setM] = useState<ServiceMatrix | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [sel, setSel] = useState('');
  const [form, setForm] = useState<JobType | null>(null);
  const [sForm, setSForm] = useState<ServiceType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    // Include inactive job types here (the create page only lists active ones).
    const [matrix, c] = await Promise.all([workOrderService.serviceMatrix(), cafmDataService.getCategories()]);
    let jobs = matrix.jobs;
    if (isSupabaseConfigured()) {
      const { data } = await supabase.from('job_types').select('*').order('name');
      if (data) jobs = data as JobType[];
    }
    setM({ ...matrix, jobs });
    setCats(c);
    setSel((s) => s || matrix.types[0]?.id || '');
  };
  useEffect(() => {
    load();
  }, []);

  const save = async (table: 'job_types' | 'service_types', row: JobType | ServiceType, done: () => void) => {
    setBusy(true);
    setError('');
    try {
      if (!isSupabaseConfigured()) {
        const key = table === 'job_types' ? 'shever_job_types' : 'shever_service_types';
        const list = (table === 'job_types' ? m!.jobs : m!.types) as (JobType | ServiceType)[];
        const next = list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row];
        saveStore(key, next);
      } else {
        await cloudWrite('Saving', () => supabase.from(table).upsert(row as unknown as Record<string, unknown>, { onConflict: 'id', defaultToNull: false }));
      }
      done();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!m) return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;

  const svc = m.types.find((t) => t.id === sel);
  const jobs = m.jobs.filter((j) => j.service_type_id === sel && (showInactive || j.is_active !== false));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Job Types</h1>
        <p className="text-xs text-slate-500">The fault list used when logging a job. Each job type sets the default priority (and so the SLA) and the usual time it takes.</p>
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <div className="grid gap-4 md:grid-cols-[240px_1fr]">
        <div className="enterprise-card overflow-hidden">
          {m.groups.map((g) => (
            <div key={g.id}>
              <div className="bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">{g.name}</div>
              {m.types.filter((t) => t.group_id === g.id).map((t) => (
                <button key={t.id} onClick={() => setSel(t.id)} className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${t.id === sel ? 'bg-orange-50 font-semibold text-ocs-blue dark:bg-orange-500/10 dark:text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/40'}`}>
                  {t.name}
                  <span className="text-[10px] text-slate-400">{m.jobs.filter((j) => j.service_type_id === t.id && j.is_active !== false).length}</span>
                </button>
              ))}
            </div>
          ))}
          {canEdit && (
            <button onClick={() => setSForm({ id: newId(), group_id: m.groups[0]?.id || '', code: '', name: '', trade_code: 'GEN', category_id: cats[0]?.id || null, sort_order: m.types.length })} className="flex w-full items-center gap-1 border-t border-slate-100 px-3 py-2 text-xs font-semibold text-teal-600 dark:border-slate-800">
              <Plus className="h-3.5 w-3.5" /> Add service
            </button>
          )}
        </div>

        <div className="enterprise-card overflow-hidden">
          {svc && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <div className="text-xs">
                <b className="text-sm text-ocs-blue dark:text-white">{svc.name}</b>
                <span className="ml-2 text-slate-500">trade {svc.trade_code || '—'} · category {cats.find((c) => c.id === svc.category_id)?.name || '—'}</span>
                {canEdit && <button onClick={() => setSForm(svc)} className="ml-2 font-semibold text-teal-600">Edit</button>}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-[11px] text-slate-500"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> show inactive</label>
                {canEdit && (
                  <button onClick={() => setForm({ id: newId(), service_type_id: svc.id, code: '', name: '', name_ar: '', default_priority: 'P3', est_hours: null, is_active: true })} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white">
                    <Plus className="h-3.5 w-3.5" /> Add job type
                  </button>
                )}
              </div>
            </div>
          )}
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
              <tr><th className="px-3 py-2">Job type</th><th className="px-3 py-2">Arabic</th><th className="px-3 py-2">Priority</th><th className="px-3 py-2">Usual time</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No job types for this service yet.</td></tr>}
              {jobs.map((j) => (
                <tr key={j.id} className={j.is_active === false ? 'opacity-50' : ''}>
                  <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{j.name}</td>
                  <td className="px-3 py-2" dir="rtl">{j.name_ar || ''}</td>
                  <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[j.default_priority].chip}`}>{j.default_priority}</span></td>
                  <td className="px-3 py-2">{j.est_hours ? `${j.est_hours} h` : '—'}</td>
                  <td className="px-3 py-2 text-right">{canEdit && <button onClick={() => setForm(j)} className="font-semibold text-teal-600">Edit</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal title={m.jobs.some((j) => j.id === form.id) ? 'Edit job type' : 'New job type'} onClose={() => setForm(null)}>
          <Field label="Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="enterprise-input" placeholder="e.g. AC not cooling" /></Field>
          <Field label="Arabic name"><input dir="rtl" value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} className="enterprise-input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default priority">
              <select value={form.default_priority} onChange={(e) => setForm({ ...form, default_priority: e.target.value as SlaPriority })} className="enterprise-input">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p} · {PRIORITY_META[p].name}</option>)}
              </select>
            </Field>
            <Field label="Usual time (hours)"><input type="number" min="0" step="0.25" value={form.est_hours ?? ''} onChange={(e) => setForm({ ...form, est_hours: e.target.value === '' ? null : Number(e.target.value) })} className="enterprise-input" /></Field>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 accent-teal-600" /> Active (shown when logging jobs)</label>
          <Buttons busy={busy} disabled={!form.name.trim()} onCancel={() => setForm(null)} onSave={() => save('job_types', { ...form, name: form.name.trim(), code: form.code || form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 30) }, () => setForm(null))} />
        </Modal>
      )}

      {sForm && (
        <Modal title={m.types.some((t) => t.id === sForm.id) ? 'Edit service' : 'New service'} onClose={() => setSForm(null)}>
          <Field label="Name *"><input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} className="enterprise-input" placeholder="e.g. Lifts & Escalators" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Group">
              <select value={sForm.group_id} onChange={(e) => setSForm({ ...sForm, group_id: e.target.value })} className="enterprise-input">
                {m.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Trade (labour rates, technician match)">
              <select value={sForm.trade_code || ''} onChange={(e) => setSForm({ ...sForm, trade_code: e.target.value || null })} className="enterprise-input">
                {TRADES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Category (for reports)">
            <select value={sForm.category_id || ''} onChange={(e) => setSForm({ ...sForm, category_id: e.target.value || null })} className="enterprise-input">
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Buttons busy={busy} disabled={!sForm.name.trim()} onCancel={() => setSForm(null)} onSave={() => save('service_types', { ...sForm, name: sForm.name.trim(), code: sForm.code || sForm.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10) }, () => { setSel(sForm.id); setSForm(null); })} />
        </Modal>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-ocs-blue dark:text-white">{title}</h3><button onClick={onClose} className="text-slate-400"><X className="h-4 w-4" /></button></div>
      {children}
    </div>
  </div>
);
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1"><span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>{children}</label>
);
const Buttons: React.FC<{ busy: boolean; disabled?: boolean; onCancel: () => void; onSave: () => void }> = ({ busy, disabled, onCancel, onSave }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
    <button onClick={onSave} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save</button>
  </div>
);
