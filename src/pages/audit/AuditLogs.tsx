import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Search } from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { AuditLog } from '../../types';

/**
 * Audit trail. Rows are written by the database itself (cafm_audit trigger,
 * database/16_notifications_audit.sql) whenever key records change, so they
 * cannot be skipped or forged from the app. Users can only read them.
 */

const MODULES: Record<string, string> = {
  work_orders: 'Work order', assets: 'Asset', profiles: 'User', invoices: 'Invoice', quotes: 'Quote', labour_rates: 'Rate card',
  sla_policies: 'SLA', system_settings: 'Settings', clients: 'Client', contracts: 'Contract', ppm_plans: 'PPM plan',
  wo_costing: 'Job charges', materials: 'Material',
};
const ACTIONS: Record<string, { label: string; cls: string }> = {
  INSERT: { label: 'Created', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  UPDATE: { label: 'Changed', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  DELETE: { label: 'Deleted', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
};
const HIDE = new Set(['id', 'created_at', 'updated_at', 'auth_user_id', 'qr_token']);

const show = (v: unknown) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v).slice(0, 60);
};
const label = (k: string) => k.replace(/_id$/, '').replace(/_/g, ' ');

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');

  useEffect(() => {
    cafmDataService.getAuditLogs().then(setLogs);
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (logs || [])
      .filter((l) => !module || l.module === module)
      .filter((l) => !q || [l.user_email, l.record_id, l.module, JSON.stringify(l.new_values || {}), JSON.stringify(l.old_values || {})].join(' ').toLowerCase().includes(q));
  }, [logs, search, module]);

  if (!logs) return <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading audit trail…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Audit Trail</h1>
          <p className="text-xs text-slate-500">Who changed what, recorded by the database. Latest 500 entries.</p>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Lock className="h-3.5 w-3.5 text-emerald-600" /> Read-only — written by the database</span>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, record, value…" className="enterprise-input pl-8" />
          </div>
          <select value={module} onChange={(e) => setModule(e.target.value)} className="enterprise-input w-auto">
            <option value="">Everything</option>
            {Object.entries(MODULES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 && <p className="px-4 py-12 text-center text-xs text-slate-500">No audit entries yet. Changes to jobs, assets, users, invoices and settings appear here.</p>}
          {rows.map((l) => {
            const a = ACTIONS[l.action] || { label: l.action, cls: 'bg-slate-100 text-slate-600' };
            const keys = Object.keys((l.action === 'DELETE' ? l.old_values : l.new_values) || {}).filter((k) => !HIDE.has(k));
            return (
              <div key={l.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[150px_1fr]">
                <div className="text-slate-500">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">{new Date(l.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="truncate">{l.user_email || 'system'}</div>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${a.cls}`}>{a.label}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{MODULES[l.module] || l.module}</span>
                    {l.record_id && <span className="font-mono text-[11px] text-slate-500">{l.record_id}</span>}
                  </div>
                  {l.action === 'UPDATE' && keys.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                      {keys.slice(0, 8).map((k) => (
                        <span key={k}><span className="text-slate-400">{label(k)}:</span> <s className="text-slate-400">{show(l.old_values?.[k])}</s> → <b>{show(l.new_values?.[k])}</b></span>
                      ))}
                    </div>
                  )}
                  {l.action !== 'UPDATE' && keys.length > 0 && (
                    <div className="mt-1 truncate text-[11px] text-slate-500">
                      {keys.filter((k) => ['name', 'title', 'status', 'full_name', 'role_id', 'grade', 'frequency', 'total', 'problem_description'].includes(k)).map((k) => `${label(k)}: ${show((l.new_values || l.old_values)?.[k])}`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
