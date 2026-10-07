import React, { useEffect, useState } from 'react';
import { Building, Check, FileSignature, Loader2, Plus, Trash2, X } from 'lucide-react';
import { billingService } from '../../api/billing';
import { newId } from '../../api/supabase';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { Client, Contract } from '../../types';

/**
 * Clients and their contracts. A contract says which facilities it covers;
 * jobs at those facilities are billed to that client, using the contract's
 * material markup and call-out fee.
 */

const CONTRACT_TYPES = ['Comprehensive', 'Semi-comprehensive', 'Labour only', 'Ad-hoc'];

const blankClient = (): Client => ({ id: newId(), code: '', name: '', is_active: true });
const blankContract = (client_id: string): Contract => ({
  id: newId(), client_id, code: '', name: '', contract_type: 'Comprehensive', default_markup_pct: 15, callout_fee: 0, status: 'Active',
});

export const ClientsList: React.FC = () => {
  const { isAdmin, isManager, isSupervisor } = useAuth();
  const manager = isAdmin || isManager;

  const [clients, setClients] = useState<Client[] | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [selId, setSelId] = useState('');
  const [form, setForm] = useState<Client | null>(null);
  const [cForm, setCForm] = useState<(Contract & { facilityIds: string[] }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [c, ct, hier] = await Promise.all([billingService.clients(), billingService.contracts(), hierarchyService.loadAll()]);
    setClients(c);
    setContracts(ct);
    setH(hier);
    return c;
  };
  useEffect(() => {
    load().then((c) => c[0] && setSelId(c[0].id));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      return true;
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!(manager || isSupervisor)) return <div className="py-20 text-center text-sm text-slate-500">Clients are managed by supervisors and managers.</div>;
  if (!clients || !h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading clients…
      </div>
    );
  }

  const sel = clients.find((c) => c.id === selId);
  const selContracts = contracts.filter((c) => c.client_id === selId);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Clients & Contracts</h1>
          <p className="text-xs text-slate-500">Who OCS bills, and which facilities each contract covers.</p>
        </div>
        {manager && (
          <button onClick={() => setForm(blankClient())} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">
            <Plus className="h-4 w-4" /> New client
          </button>
        )}
      </div>
      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="enterprise-card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
          {clients.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No clients yet.</p>}
          {clients.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)} className={`block w-full px-4 py-3 text-left text-xs ${c.id === selId ? 'bg-orange-50/70 dark:bg-orange-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{c.name}</div>
              <div className="text-[10px] text-slate-500">{c.code} · {contracts.filter((x) => x.client_id === c.id).length} contract(s)</div>
            </button>
          ))}
        </div>

        {sel ? (
          <div className="space-y-4">
            <div className="enterprise-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[11px] text-slate-500">{sel.code}</div>
                  <h2 className="text-base font-bold text-ocs-blue dark:text-white">{sel.name}</h2>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {sel.billing_address && <div className="whitespace-pre-line">{sel.billing_address}</div>}
                    <div>{sel.trn ? `TRN ${sel.trn}` : <span className="text-slate-400">No TRN</span>}</div>
                    {(sel.contact_name || sel.contact_email || sel.contact_phone) && <div>{[sel.contact_name, sel.contact_email, sel.contact_phone].filter(Boolean).join(' · ')}</div>}
                  </div>
                </div>
                {manager && <button onClick={() => setForm(sel)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Edit</button>}
              </div>
            </div>

            <div className="enterprise-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><FileSignature className="h-4 w-4 text-orange-500" /> Contracts</h3>
                {manager && <button onClick={() => setCForm({ ...blankContract(sel.id), facilityIds: [] })} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600"><Plus className="h-3.5 w-3.5" /> Add contract</button>}
              </div>
              {selContracts.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No contracts. Add one to link facilities to this client.</p>}
              <div className="space-y-2">
                {selContracts.map((c) => {
                  const fac = h.facilities.filter((f) => f.contract_id === c.id);
                  return (
                    <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{c.code} · {c.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {c.contract_type} · {c.start_date || '—'} → {c.end_date || 'open'} · markup {Number(c.default_markup_pct ?? 0)}% · call-out AED {Number(c.callout_fee ?? 0)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {fac.length === 0 && <span className="text-[11px] text-orange-600">No facilities linked</span>}
                            {fac.map((f) => <span key={f.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800"><Building className="h-3 w-3" /> {f.name}</span>)}
                          </div>
                        </div>
                        {manager && <button onClick={() => setCForm({ ...c, facilityIds: fac.map((f) => f.id) })} className="text-xs font-semibold text-teal-600">Edit</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="enterprise-card p-10 text-center text-xs text-slate-500">Add your first client to start billing.</div>
        )}
      </div>

      {/* Client form */}
      {form && (
        <Modal title={clients.some((c) => c.id === form.id) ? 'Edit client' : 'New client'} onClose={() => setForm(null)}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Code *"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="enterprise-input" placeholder="ADNOC" /></Field>
            <div className="col-span-2"><Field label="Name *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="enterprise-input" /></Field></div>
          </div>
          <Field label="TRN (VAT registration)"><input value={form.trn || ''} onChange={(e) => setForm({ ...form, trn: e.target.value })} className="enterprise-input" /></Field>
          <Field label="Billing address"><textarea rows={3} value={form.billing_address || ''} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} className="enterprise-input" /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Contact"><input value={form.contact_name || ''} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="enterprise-input" /></Field>
            <Field label="Email"><input value={form.contact_email || ''} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="enterprise-input" /></Field>
            <Field label="Phone"><input value={form.contact_phone || ''} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="enterprise-input" /></Field>
          </div>
          <div className="flex justify-between pt-1">
            {isAdmin && clients.some((c) => c.id === form.id) ? (
              <button onClick={async () => { if (await run(() => billingService.deleteClient(form.id))) { setForm(null); setSelId(''); } }} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            ) : <span />}
            <SaveBtn busy={busy} disabled={!form.code.trim() || !form.name.trim()} onClick={async () => { if (await run(() => billingService.saveClient({ ...form, code: form.code.trim(), name: form.name.trim() }))) { setSelId(form.id); setForm(null); } }} />
          </div>
        </Modal>
      )}

      {/* Contract form */}
      {cForm && (
        <Modal title={contracts.some((c) => c.id === cForm.id) ? 'Edit contract' : 'New contract'} onClose={() => setCForm(null)}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Code *"><input value={cForm.code} onChange={(e) => setCForm({ ...cForm, code: e.target.value.toUpperCase() })} className="enterprise-input" /></Field>
            <div className="col-span-2"><Field label="Name *"><input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} className="enterprise-input" placeholder="Annual FM contract 2026" /></Field></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Type">
              <select value={cForm.contract_type} onChange={(e) => setCForm({ ...cForm, contract_type: e.target.value })} className="enterprise-input">
                {CONTRACT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Start"><input type="date" value={cForm.start_date || ''} onChange={(e) => setCForm({ ...cForm, start_date: e.target.value || null })} className="enterprise-input" /></Field>
            <Field label="End"><input type="date" value={cForm.end_date || ''} onChange={(e) => setCForm({ ...cForm, end_date: e.target.value || null })} className="enterprise-input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Material markup %"><input type="number" step="0.5" value={cForm.default_markup_pct ?? ''} onChange={(e) => setCForm({ ...cForm, default_markup_pct: e.target.value === '' ? null : Number(e.target.value) })} className="enterprise-input" /></Field>
            <Field label="Call-out fee AED (chargeable jobs)"><input type="number" step="1" value={cForm.callout_fee ?? ''} onChange={(e) => setCForm({ ...cForm, callout_fee: Number(e.target.value) || 0 })} className="enterprise-input" /></Field>
          </div>
          <Field label="Facilities covered">
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              {h.facilities.length === 0 && <p className="text-[11px] text-slate-500">No facilities yet.</p>}
              {h.facilities.map((f) => {
                const other = f.contract_id && f.contract_id !== cForm.id ? contracts.find((c) => c.id === f.contract_id) : null;
                return (
                  <label key={f.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={cForm.facilityIds.includes(f.id)}
                      onChange={(e) => setCForm({ ...cForm, facilityIds: e.target.checked ? [...cForm.facilityIds, f.id] : cForm.facilityIds.filter((x) => x !== f.id) })}
                      className="h-4 w-4 accent-teal-600"
                    />
                    {f.name}
                    {other && <span className="text-[10px] text-orange-600">(now on {other.code} — will move)</span>}
                  </label>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-between pt-1">
            {isAdmin && contracts.some((c) => c.id === cForm.id) ? (
              <button onClick={async () => { if (await run(async () => { await billingService.setContractFacilities(cForm.id, [], h); await billingService.deleteContract(cForm.id); })) setCForm(null); }} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
            ) : <span />}
            <SaveBtn
              busy={busy}
              disabled={!cForm.code.trim() || !cForm.name.trim()}
              onClick={async () => {
                const { facilityIds, ...c } = cForm;
                if (await run(async () => {
                  await billingService.saveContract({ ...c, code: c.code.trim(), name: c.name.trim() });
                  await billingService.setContractFacilities(c.id, facilityIds, h);
                })) setCForm(null);
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ocs-blue dark:text-white">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const SaveBtn: React.FC<{ busy: boolean; disabled?: boolean; onClick: () => void }> = ({ busy, disabled, onClick }) => (
  <button onClick={onClick} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
  </button>
);
