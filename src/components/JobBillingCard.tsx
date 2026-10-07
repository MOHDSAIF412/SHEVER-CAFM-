import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Receipt } from 'lucide-react';
import { BILLING_STATUS_META, billingService, clientOf } from '../api/billing';
import { Hierarchy } from '../api/hierarchy';
import { cafmDataService } from '../api/supabase';
import { Client, Contract, Invoice, WorkOrder } from '../types';

/**
 * Billing on a chargeable job: who pays, where it is in
 * To Bill -> Invoiced -> Paid (= Closed), and a manager write-off for jobs
 * that will not be charged after all.
 */
export const JobBillingCard: React.FC<{ wo: WorkOrder; h: Hierarchy; manager: boolean; onChange: (w: WorkOrder) => void }> = ({ wo, h, manager, onChange }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [writeOff, setWriteOff] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([billingService.clients(), billingService.contracts()]).then(([c, ct]) => {
      setClients(c);
      setContracts(ct);
    });
    if (wo.invoice_id) billingService.invoice(wo.invoice_id).then(setInvoice);
  }, [wo.invoice_id]);

  const save = async (patch: Partial<WorkOrder>) => {
    setBusy(true);
    setError('');
    try {
      const u = await cafmDataService.updateWorkOrder(wo.id, patch);
      if (u) onChange(u);
      setWriteOff(null);
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const bs = wo.billing_status || 'Not Billable';
  const meta = BILLING_STATUS_META[bs] || BILLING_STATUS_META['Not Billable'];
  const derived = clientOf({ ...wo, client_id: null }, h, contracts);
  const clientId = wo.client_id || derived;

  return (
    <div className="enterprise-card space-y-2.5 p-4 text-xs">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><Receipt className="h-3.5 w-3.5 text-orange-500" /> Billing</h3>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Status</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.pill}`}>{meta.label}</span>
      </div>
      <label className="block space-y-1">
        <span className="text-slate-500">Client</span>
        {manager && !['Invoiced', 'Paid'].includes(bs) ? (
          <select value={wo.client_id || ''} disabled={busy} onChange={(e) => save({ client_id: e.target.value || null })} className="enterprise-input py-1.5 text-xs">
            <option value="">{derived ? `From contract: ${clients.find((c) => c.id === derived)?.name || '…'}` : 'Not set'}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <div className="font-semibold">{clients.find((c) => c.id === clientId)?.name || '—'}</div>
        )}
      </label>
      {invoice && (
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Invoice</span>
          <Link to={`/billing/invoices/${invoice.id}`} className="font-mono font-semibold text-teal-600">{invoice.invoice_number}</Link>
        </div>
      )}
      <p className="rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        {bs === 'Not Billable' && 'Goes to "To bill" when the job is completed.'}
        {bs === 'To Bill' && <>Waiting for an invoice. <Link to="/billing" className="font-semibold text-teal-600">Bill it</Link></>}
        {bs === 'Invoiced' && 'Closes automatically when the invoice is paid.'}
        {bs === 'Paid' && 'Paid — job closed.'}
        {bs === 'Written Off' && (wo.remarks || 'Written off — no charge.')}
      </p>
      {manager && ['Not Billable', 'To Bill'].includes(bs) && (
        writeOff === null ? (
          <button onClick={() => setWriteOff('')} className="text-[11px] font-semibold text-slate-500 hover:text-rose-600">Write off (no charge)…</button>
        ) : (
          <div className="space-y-1.5">
            <input autoFocus value={writeOff} onChange={(e) => setWriteOff(e.target.value)} placeholder="Why is this not charged?" className="enterprise-input py-1.5 text-xs" />
            <div className="flex gap-2">
              <button disabled={busy || !writeOff.trim()} onClick={() => billingService.writeOff(wo, writeOff.trim()).then(() => cafmDataService.getWorkOrderById(wo.id)).then((u) => { if (u) onChange(u); setWriteOff(null); }).catch((e) => setError(e?.message))} className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />} Write off
              </button>
              <button onClick={() => setWriteOff(null)} className="text-[11px] text-slate-500">Back</button>
            </div>
          </div>
        )
      )}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
};
