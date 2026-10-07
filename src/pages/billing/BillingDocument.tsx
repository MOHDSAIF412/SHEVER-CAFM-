import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Check, CheckCircle2, Download, Hammer, Loader2, Plus, Send, Trash2, Undo2, Wallet, X } from 'lucide-react';
import { BillingSettings, INVOICE_META, QUOTE_META, billingService, invoiceState } from '../../api/billing';
import { aed } from '../../api/costing';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { generateBillingPdf } from '../../utils/billingPdf';
import { BillingLine, BillingLineType, Client, Invoice, Quote } from '../../types';

/**
 * One invoice or quote. Drafts are editable; issued invoices are locked and
 * only move Issued -> Paid (closes the jobs) or Cancelled.
 */

const LINE_TYPES: BillingLineType[] = ['Labour', 'Material', 'Subcontract', 'Call-out', 'Minimum Charge', 'Other'];

type Kind = 'invoice' | 'quote';

export const InvoiceDetail: React.FC = () => <BillingDocument kind="invoice" />;
export const QuoteDetail: React.FC = () => <BillingDocument kind="quote" />;

const BillingDocument: React.FC<{ kind: Kind }> = ({ kind }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isManager, isSupervisor } = useAuth();
  const manager = isAdmin || isManager;
  const lead = manager || isSupervisor;

  const [doc, setDoc] = useState<Invoice | Quote | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newLine, setNewLine] = useState<{ type: BillingLineType; desc: string; qty: string; price: string } | null>(null);
  const [dialog, setDialog] = useState<null | 'paid' | 'cancel' | 'delete'>(null);
  const [f, setF] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const d = kind === 'invoice' ? await billingService.invoice(id) : await billingService.quote(id);
    if (!d) return setNotFound(true);
    setDoc(d);
    setLines(await billingService.lines(kind === 'invoice' ? { invoice_id: id } : { quote_id: id }));
  }, [id, kind]);

  useEffect(() => {
    load();
    Promise.all([billingService.clients(), billingService.settings(), hierarchyService.loadAll()]).then(([c, s, hier]) => {
      setClients(c);
      setSettings(s);
      setH(hier);
    });
  }, [load]);

  const act = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setDialog(null);
      await load();
      after?.();
    } catch (e: any) {
      setError(e?.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (!lead) return <div className="py-20 text-center text-sm text-slate-500">Billing is available to supervisors and managers.</div>;
  if (notFound) return <div className="py-20 text-center text-sm text-slate-500">Not found. <Link to="/billing" className="font-semibold text-teal-600">Back to billing</Link></div>;
  if (!doc || !settings) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  const inv = kind === 'invoice' ? (doc as Invoice) : null;
  const quote = kind === 'quote' ? (doc as Quote) : null;
  const draft = doc.status === 'Draft';
  const number = inv ? inv.invoice_number : quote!.quote_number;
  const st = inv ? invoiceState(inv) : quote!.status;
  const meta = inv ? INVOICE_META[st as keyof typeof INVOICE_META] : QUOTE_META[quote!.status];
  const client = clients.find((c) => c.id === doc.client_id);
  const save = (patch: Partial<Invoice & Quote>) =>
    act(() => (inv ? billingService.updateInvoice(doc.id, patch) : billingService.updateQuote(doc.id, patch)));
  const canEdit = draft && (manager || isSupervisor);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to={`/billing?tab=${kind === 'invoice' ? 'invoices' : 'quotes'}`} className="mt-1 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-500">{inv ? (doc.vat_rate > 0 ? 'Tax invoice' : 'Invoice') : 'Quotation'}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.pill}`}>{meta.label}</span>
            </div>
            <h1 className="font-mono text-xl font-bold text-ocs-blue dark:text-white">{number}</h1>
            <p className="text-xs text-slate-500">
              {client?.name || 'No client chosen'}
              {inv?.issue_date ? ` · issued ${inv.issue_date}` : ''}
              {inv?.due_date ? ` · due ${inv.due_date}` : ''}
              {inv?.paid_at ? ` · paid ${inv.paid_at.slice(0, 10)}${inv.payment_ref ? ` (${inv.payment_ref})` : ''}` : ''}
              {quote?.valid_until ? ` · valid until ${quote.valid_until}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn icon={Download} label="PDF" onClick={() => generateBillingPdf(kind, doc, lines, client, settings)} />
          {/* Invoice actions */}
          {inv && draft && manager && <Btn icon={Send} label="Issue invoice" tone="brand" busy={busy} onClick={() => act(() => billingService.setInvoiceStatus(inv, 'Issued'))} />}
          {inv && inv.status === 'Issued' && manager && (
            <Btn icon={Wallet} label="Mark paid" tone="success" onClick={() => { setF({ ref: '', date: new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 10) }); setDialog('paid'); }} />
          )}
          {inv && inv.status === 'Paid' && manager && <Btn icon={Undo2} label="Undo paid" busy={busy} onClick={() => act(() => billingService.setInvoiceStatus(inv, 'Issued'))} />}
          {inv && ['Draft', 'Issued'].includes(inv.status) && manager && <Btn icon={Ban} label="Cancel" tone="danger" onClick={() => { setF({ reason: '' }); setDialog('cancel'); }} />}
          {/* Quote actions */}
          {quote && draft && <Btn icon={Send} label="Mark sent" tone="brand" busy={busy} onClick={() => act(() => billingService.setQuoteStatus(quote, 'Sent'))} />}
          {quote && ['Draft', 'Sent'].includes(quote.status) && manager && <Btn icon={CheckCircle2} label="Client approved" tone="success" busy={busy} onClick={() => act(() => billingService.setQuoteStatus(quote, 'Approved'))} />}
          {quote && quote.status === 'Sent' && <Btn icon={X} label="Rejected" tone="danger" busy={busy} onClick={() => act(() => billingService.setQuoteStatus(quote, 'Rejected'))} />}
          {quote && ['Sent', 'Rejected', 'Approved'].includes(quote.status) && !quote.work_order_id && manager && <Btn icon={Undo2} label="Back to draft" busy={busy} onClick={() => act(() => billingService.setQuoteStatus(quote, 'Draft'))} />}
          {quote && quote.status === 'Approved' && !quote.work_order_id && (
            <Btn icon={Hammer} label="Create job" tone="accent" onClick={() => navigate(`/work-orders/new?quote=${quote.id}`)} />
          )}
          {quote?.work_order_id && <Link to={`/work-orders/${quote.work_order_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-teal-700 dark:border-slate-700">Open job</Link>}
          {draft && manager && <button onClick={() => setDialog('delete')} title="Delete draft" className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-rose-600 dark:border-slate-700"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}
      {inv?.status === 'Paid' && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> Paid — the jobs on this invoice are closed.
        </div>
      )}
      {inv?.status === 'Cancelled' && inv.cancel_reason && <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800">Cancelled: {inv.cancel_reason}. Its jobs went back to To bill.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Lines */}
        <div className="enterprise-card overflow-hidden">
          {quote && (
            <div className="space-y-2 border-b border-slate-100 p-4 dark:border-slate-800">
              <input defaultValue={quote.title} disabled={!canEdit} onBlur={(e) => e.target.value.trim() !== quote.title && save({ title: e.target.value.trim() || 'Quotation' })} className="enterprise-input text-sm font-semibold" placeholder="Quote title (e.g. Replace chiller pump CHP-02)" />
              <textarea defaultValue={quote.description || ''} disabled={!canEdit} rows={3} onBlur={(e) => e.target.value !== (quote.description || '') && save({ description: e.target.value })} className="enterprise-input" placeholder="Scope of work, exclusions, lead time…" />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
                <tr><th className="px-3 py-2">Description</th><th className="px-3 py-2">Type</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit price</th><th className="px-3 py-2 text-right">Amount</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No lines yet.</td></tr>}
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <div className="text-slate-800 dark:text-slate-100">{l.description}</div>
                      {l.work_order_id && <Link to={`/work-orders/${l.work_order_id}`} className="text-[10px] font-semibold text-teal-600">open job</Link>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{l.line_type}</td>
                    <td className="px-3 py-2 text-right">{Number(l.quantity)}</td>
                    <td className="px-3 py-2 text-right">{aed(l.unit_price)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{aed(l.amount ?? l.quantity * l.unit_price)}</td>
                    <td className="w-8 px-2">{canEdit && <button onClick={() => act(() => billingService.removeLine(l))} disabled={busy} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              {newLine ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_130px_70px_110px_auto]">
                  <input autoFocus value={newLine.desc} onChange={(e) => setNewLine({ ...newLine, desc: e.target.value })} placeholder="Description" className="enterprise-input" />
                  <select value={newLine.type} onChange={(e) => setNewLine({ ...newLine, type: e.target.value as BillingLineType })} className="enterprise-input">
                    {LINE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" min="0" step="any" value={newLine.qty} onChange={(e) => setNewLine({ ...newLine, qty: e.target.value })} placeholder="Qty" className="enterprise-input" />
                  <input type="number" step="0.01" value={newLine.price} onChange={(e) => setNewLine({ ...newLine, price: e.target.value })} placeholder="Unit AED" className="enterprise-input" />
                  <div className="flex gap-1">
                    <button
                      disabled={busy || !newLine.desc.trim() || newLine.price === ''}
                      onClick={() => act(() => billingService.addLine({
                        ...(inv ? { invoice_id: doc.id } : { quote_id: doc.id }),
                        line_type: newLine.type, description: newLine.desc.trim(), quantity: Number(newLine.qty) || 1, unit_price: Number(newLine.price), sort_order: lines.length,
                      }), () => setNewLine(null))}
                      className="rounded-lg bg-teal-600 px-3 text-white disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setNewLine(null)} className="rounded-lg px-2 text-slate-500"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setNewLine({ type: quote ? 'Material' : 'Other', desc: '', qty: '1', price: '' })} className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600">
                  <Plus className="h-3.5 w-3.5" /> Add line
                </button>
              )}
            </div>
          )}
          <dl className="ml-auto max-w-xs space-y-1.5 border-t border-slate-100 p-4 text-xs dark:border-slate-800">
            <Row k="Subtotal" v={aed(doc.subtotal)} />
            {doc.vat_rate > 0 && <Row k={`VAT ${doc.vat_rate}%`} v={aed(doc.vat_amount)} />}
            <Row k={<b>Total</b>} v={<b className="text-base text-ocs-blue dark:text-white">{aed(doc.total)}</b>} />
          </dl>
        </div>

        {/* Side */}
        <aside className="space-y-4">
          <div className="enterprise-card space-y-3 p-4 text-xs">
            <Field label="Client">
              <select value={doc.client_id || ''} disabled={!canEdit} onChange={(e) => save({ client_id: e.target.value || null })} className="enterprise-input">
                <option value="">Choose client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            {client && (
              <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {client.billing_address && <div className="whitespace-pre-line">{client.billing_address}</div>}
                {client.trn && <div>TRN {client.trn}</div>}
                {!client.trn && doc.vat_rate > 0 && <div className="text-orange-600">Client TRN missing — add it under Clients.</div>}
              </div>
            )}
            {quote && h && (
              <Field label="Facility">
                <select value={quote.facility_id || ''} disabled={!canEdit} onChange={(e) => save({ facility_id: e.target.value || null })} className="enterprise-input">
                  <option value="">—</option>
                  {h.facilities.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Client PO number">
              <input defaultValue={doc.client_po_number || ''} disabled={!canEdit} onBlur={(e) => e.target.value !== (doc.client_po_number || '') && save({ client_po_number: e.target.value || null })} className="enterprise-input" />
            </Field>
            {quote && (
              <Field label="Valid until">
                <input type="date" defaultValue={quote.valid_until || ''} disabled={!canEdit} onBlur={(e) => e.target.value !== (quote.valid_until || '') && save({ valid_until: e.target.value || null })} className="enterprise-input" />
              </Field>
            )}
            {inv && draft && (
              <Field label="Due date (blank = payment terms)">
                <input type="date" defaultValue={inv.due_date || ''} disabled={!canEdit} onBlur={(e) => e.target.value !== (inv.due_date || '') && save({ due_date: e.target.value || null })} className="enterprise-input" />
              </Field>
            )}
            <Field label={`VAT %${settings.vat_enabled ? '' : ' (VAT is off in settings)'}`}>
              <input type="number" step="0.5" min="0" defaultValue={doc.vat_rate} disabled={!canEdit || !manager} onBlur={(e) => Number(e.target.value) !== doc.vat_rate && save({ vat_rate: Number(e.target.value) || 0 })} className="enterprise-input" />
            </Field>
            <Field label="Notes (printed)">
              <textarea rows={3} defaultValue={doc.notes || ''} disabled={!canEdit} onBlur={(e) => e.target.value !== (doc.notes || '') && save({ notes: e.target.value || null })} className="enterprise-input" />
            </Field>
          </div>
          {inv && (
            <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <b>How it works:</b> Issue → the jobs become <i>Invoiced</i> and this invoice is locked. Mark paid → the jobs are <i>Paid</i> and <b>closed</b>. Cancel → the jobs go back to <i>To bill</i>.
            </div>
          )}
        </aside>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => !busy && setDialog(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900">
            {dialog === 'paid' && inv && (
              <>
                <h3 className="text-sm font-bold text-ocs-blue dark:text-white">Record payment — {aed(inv.total)}</h3>
                <p className="text-xs text-slate-500">The jobs on this invoice will be marked paid and closed.</p>
                <Field label="Payment reference (cheque / transfer no.)"><input value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} className="enterprise-input" /></Field>
                <Field label="Date received"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="enterprise-input" /></Field>
                <DlgButtons busy={busy} label="Mark paid & close jobs" onCancel={() => setDialog(null)} onOk={() => act(() => billingService.setInvoiceStatus(inv, 'Paid', { payment_ref: f.ref || null, paid_at: f.date ? new Date(`${f.date}T12:00:00+04:00`).toISOString() : undefined }))} />
              </>
            )}
            {dialog === 'cancel' && inv && (
              <>
                <h3 className="text-sm font-bold text-ocs-blue dark:text-white">Cancel {inv.invoice_number}</h3>
                <p className="text-xs text-slate-500">The number is kept for the record. Its jobs go back to To bill.</p>
                <textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Reason" className="enterprise-input" />
                <DlgButtons busy={busy} danger disabled={!f.reason?.trim()} label="Cancel invoice" onCancel={() => setDialog(null)} onOk={() => act(() => billingService.setInvoiceStatus(inv, 'Cancelled', { cancel_reason: f.reason.trim() }))} />
              </>
            )}
            {dialog === 'delete' && (
              <>
                <h3 className="text-sm font-bold text-ocs-blue dark:text-white">Delete draft {number}?</h3>
                <DlgButtons busy={busy} danger label="Delete" onCancel={() => setDialog(null)} onOk={() => act(() => (inv ? billingService.deleteInvoice(inv) : billingService.deleteQuote(quote!)), () => navigate('/billing'))} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TONES = {
  neutral: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  brand: 'bg-ocs-blue text-white hover:bg-teal-700',
  accent: 'bg-orange-500 text-white hover:bg-orange-600',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900',
};

const Btn: React.FC<{ icon: React.ElementType; label: string; onClick: () => void; tone?: keyof typeof TONES; busy?: boolean }> = ({ icon: Icon, label, onClick, tone = 'neutral', busy }) => (
  <button onClick={onClick} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${TONES[tone]}`}>
    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />} {label}
  </button>
);

const Row: React.FC<{ k: React.ReactNode; v: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3"><dt className="text-slate-600 dark:text-slate-300">{k}</dt><dd>{v}</dd></div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">{label}</span>
    {children}
  </label>
);

const DlgButtons: React.FC<{ busy: boolean; label: string; onOk: () => void; onCancel: () => void; disabled?: boolean; danger?: boolean }> = ({ busy, label, onOk, onCancel, disabled, danger }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button onClick={onCancel} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Back</button>
    <button onClick={onOk} disabled={busy || disabled} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-600 hover:bg-teal-700'}`}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {label}
    </button>
  </div>
);
