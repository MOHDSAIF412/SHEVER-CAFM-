import React, { useEffect, useState } from 'react';
import { Building, Check, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cafmDataService, cloudWrite, isSupabaseConfigured, saveStore, supabase } from '../../api/supabase';
import { workOrderService } from '../../api/workOrders';
import { useAuth } from '../../context/AuthContext';
import { formatDuration } from '../../utils/sla';
import { PRIORITY_META } from '../../utils/woFlow';
import { SlaPolicy, SystemSettings as Settings } from '../../types';

/**
 * Company details and the SLA targets every new job is timed against.
 * (This page used to show fixed example numbers and its Save button did
 * nothing.)
 */

type Tab = 'company' | 'sla';

const toHM = (mins?: number | null) => (mins == null ? '' : String(Math.round((mins / 60) * 100) / 100));
const fromHM = (v: string) => (v.trim() === '' ? null : Math.max(1, Math.round(Number(v) * 60)));

export const SystemSettings: React.FC = () => {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>('company');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([cafmDataService.getSystemSettings(), workOrderService.slaPolicies()]).then(([s, p]) => {
      setSettings(s);
      setPolicies(p.filter((x) => !x.contract_id).sort((a, b) => a.priority.localeCompare(b.priority)));
    });
  }, []);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading settings…
      </div>
    );
  }

  const setP = (id: string, patch: Partial<SlaPolicy>) => setPolicies((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const saveSla = () =>
    run(async () => {
      for (const p of policies) {
        if (!p.response_minutes || !p.resolution_minutes) throw new Error(`${p.priority}: response and fix times are required.`);
        if (p.resolution_minutes < p.response_minutes) throw new Error(`${p.priority}: the fix time cannot be shorter than the response time.`);
      }
      if (!isSupabaseConfigured()) {
        saveStore('shever_sla_policies', policies);
        return;
      }
      for (const p of policies) {
        await cloudWrite(`Saving ${p.priority}`, () =>
          supabase.from('sla_policies').update({
            name: p.name, response_minutes: p.response_minutes, restoration_minutes: p.restoration_minutes ?? null,
            resolution_minutes: p.resolution_minutes, pause_on_hold: p.pause_on_hold ?? true, updated_at: new Date().toISOString(),
          }).eq('id', p.id)
        );
      }
    }, 'SLA targets saved. New jobs use them; existing jobs keep their deadlines.');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ocs-blue dark:text-white">System Settings</h1>
        <p className="text-xs text-slate-500">Company details and SLA targets. Rates, VAT and invoices are under <Link to="/settings/costing" className="font-semibold text-teal-600">Rates & Billing</Link>.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {([['company', 'Company', Building], ['sla', 'SLA targets', Clock]] as [Tab, string, React.ElementType][]).map(([k, label, Icon]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(null); }} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${tab === k ? 'border-orange-500 text-ocs-blue dark:text-white' : 'border-transparent text-slate-500'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {msg && <div className={`rounded-lg p-2.5 text-xs font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>{msg.text}</div>}

      {tab === 'company' && (
        <div className="enterprise-card space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name">
              <input value={settings.company_name || ''} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} className="enterprise-input" />
            </Field>
            <Field label="Currency">
              <input value="AED" disabled className="enterprise-input" />
            </Field>
            <Field label="Helpdesk email">
              <input type="email" value={settings.contact_email || ''} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })} className="enterprise-input" />
            </Field>
            <Field label="Helpdesk phone">
              <input value={settings.contact_phone || ''} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, contact_phone: e.target.value })} className="enterprise-input" placeholder="+971 …" />
            </Field>
          </div>
          <Field label="Address (printed on invoices and reports)">
            <textarea rows={3} value={settings.company_address || ''} disabled={!isAdmin} onChange={(e) => setSettings({ ...settings, company_address: e.target.value })} className="enterprise-input" />
          </Field>
          {isAdmin ? (
            <SaveButton busy={busy} label="Save company details" onClick={() => run(async () => {
              const saved = await cafmDataService.updateSystemSettings({
                company_name: settings.company_name?.trim(), contact_email: settings.contact_email?.trim() || undefined,
                contact_phone: settings.contact_phone?.trim() || undefined, company_address: settings.company_address?.trim() || null,
              });
              setSettings(saved);
            }, 'Company details saved.')} />
          ) : <p className="text-[11px] text-slate-500">Only an admin can change these.</p>}
        </div>
      )}

      {tab === 'sla' && (
        <div className="enterprise-card space-y-4 p-5">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Each new job gets three deadlines from its priority: <b>respond</b> (technician on site), <b>make safe</b> (temporary fix, optional) and <b>fix</b> (work done).
            Time on hold does not count when “pause on hold” is ticked. Hours, counted 24/7.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr><th className="px-2 py-2 text-left">Priority</th><th className="px-2 py-2 text-left">Name</th><th className="px-2 py-2">Respond (h)</th><th className="px-2 py-2">Make safe (h)</th><th className="px-2 py-2">Fix (h)</th><th className="px-2 py-2">Pause on hold</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_META[p.priority].chip}`}>{p.priority}</span></td>
                    <td className="px-2 py-2"><input value={p.name} disabled={!isAdmin} onChange={(e) => setP(p.id, { name: e.target.value })} className="enterprise-input" /></td>
                    <td className="px-2 py-2"><Hours value={p.response_minutes} disabled={!isAdmin} onChange={(m) => setP(p.id, { response_minutes: m ?? 0 })} /></td>
                    <td className="px-2 py-2"><Hours value={p.restoration_minutes} disabled={!isAdmin} placeholder="—" onChange={(m) => setP(p.id, { restoration_minutes: m })} /></td>
                    <td className="px-2 py-2"><Hours value={p.resolution_minutes} disabled={!isAdmin} onChange={(m) => setP(p.id, { resolution_minutes: m ?? 0 })} /></td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" checked={p.pause_on_hold ?? true} disabled={!isAdmin} onChange={(e) => setP(p.id, { pause_on_hold: e.target.checked })} className="h-4 w-4 accent-teal-600" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            {policies.map((p) => (
              <span key={p.id} className="rounded bg-slate-50 px-2 py-1 dark:bg-slate-800/60">
                <b>{p.priority}</b>: respond {formatDuration(p.response_minutes * 60000)}{p.restoration_minutes ? `, safe ${formatDuration(p.restoration_minutes * 60000)}` : ''}, fix {formatDuration(p.resolution_minutes * 60000)}
              </span>
            ))}
          </div>
          {isAdmin ? <SaveButton busy={busy} label="Save SLA targets" onClick={saveSla} /> : <p className="text-[11px] text-slate-500">Only an admin can change SLA targets.</p>}
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> The database checks every 10 minutes for jobs past their fix deadline and alerts supervisors and the technician.</p>
        </div>
      )}
    </div>
  );
};

const Hours: React.FC<{ value?: number | null; onChange: (mins: number | null) => void; disabled?: boolean; placeholder?: string }> = ({ value, onChange, disabled, placeholder }) => {
  const [text, setText] = useState(toHM(value));
  return (
    <input
      type="number" min="0" step="0.25" value={text} disabled={disabled} placeholder={placeholder}
      onChange={(e) => { setText(e.target.value); onChange(fromHM(e.target.value)); }}
      className="enterprise-input text-center"
    />
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const SaveButton: React.FC<{ busy: boolean; label: string; onClick: () => void }> = ({ busy, label, onClick }) => (
  <button onClick={onClick} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {label}
  </button>
);
