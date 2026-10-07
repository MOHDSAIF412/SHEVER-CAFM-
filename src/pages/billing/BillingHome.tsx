import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FilePlus2, FileText, Loader2, Receipt, Search, Wallet } from 'lucide-react';
import { INVOICE_META, QUOTE_META, billingService, clientOf, invoiceState, jobBillAmount } from '../../api/billing';
import { aed, costingService } from '../../api/costing';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';
import { Client, Contract, Invoice, JobCosting, Quote, WorkOrder } from '../../types';

/**
 * Billing: jobs waiting to be invoiced, invoices and quotes.
 * Chargeable jobs: Completed -> To Bill -> Invoiced -> Paid (= Closed).
 */

type Tab = 'tobill' | 'invoices' | 'quotes';

export const BillingHome: React.FC = () => {
  const { isAdmin, isManager, isSupervisor } = useAuth();
  if (!(isAdmin || isManager || isSupervisor)) {
    return <div className="py-20 text-center text-sm text-slate-500">Billing is available to supervisors and managers.</div>;
  }
  return <BillingView />;
};

const BillingView: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'tobill';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  const [jobs, setJobs] = useState<WorkOrder[] | null>(null);
  const [totals, setTotals] = useState<Map<string, JobCosting>>(new Map());
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [h, setH] = useState<Hierarchy | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [clientFor, setClientFor] = useState('');
  const [detailed, setDetailed] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [j, inv, qs, cl, ct, hier] = await Promise.all([
          billingService.toBill(), billingService.invoices(), billingService.quotes(), billingService.clients(), billingService.contracts(), hierarchyService.loadAll(),
        ]);
        setTotals(await costingService.allTotals(j));
        setJobs(j);
        setInvoices(inv);
        setQuotes(qs);
        setClients(cl);
        setContracts(ct);
        setH(hier);
      } catch (e: any) {
        setError(e?.message || 'Could not load billing.');
        setJobs([]);
      }
    })();
  }, []);

  const clientName = (id?: string | null) => clients.find((c) => c.id === id)?.name || '—';

  const jobRows = useMemo(
    () =>
      (jobs || [])
        .map((w) => ({ wo: w, client: clientOf(w, h, contracts), amount: jobBillAmount(w, totals, quotes) }))
        .filter(({ wo }) => !q.trim() || `${wo.wo_number} ${wo.problem_description}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => (a.wo.completed_at || a.wo.created_at || '').localeCompare(b.wo.completed_at || b.wo.created_at || '')),
    [jobs, h, contracts, totals, quotes, q]
  );

  const pickedRows = jobRows.filter((r) => picked.has(r.wo.id));
  const pickedClients = [...new Set(pickedRows.map((r) => r.client).filter(Boolean))] as string[];
  const effectiveClient = clientFor || (pickedClients.length === 1 ? pickedClients[0] : '');

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const createInvoice = async () => {
    setError('');
    if (!effectiveClient) return setError('Choose which client to invoice.');
    if (pickedClients.length > 1) return setError('The selected jobs belong to different clients. Invoice one client at a time.');
    setBusy(true);
    try {
      const id = await billingService.createInvoice({ client_id: effectiveClient, jobs: pickedRows.map((r) => r.wo), detailed, createdBy: user?.id });
      navigate(`/billing/invoices/${id}`);
    } catch (e: any) {
      setError(e?.message || 'Could not create the invoice.');
      setBusy(false);
    }
  };

  const newQuote = async () => {
    setBusy(true);
    try {
      const id = await billingService.createQuote({ title: 'New quotation' }, user?.id);
      navigate(`/billing/quotes/${id}`);
    } catch (e: any) {
      setError(e?.message || 'Could not create the quote.');
      setBusy(false);
    }
  };

  if (!jobs) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading billing…
      </div>
    );
  }

  const outstanding = invoices.filter((i) => i.status === 'Issued');
  const overdue = outstanding.filter((i) => invoiceState(i) === 'Overdue');
  const month = new Date().toISOString().slice(0, 7);
  const paidMonth = invoices.filter((i) => i.status === 'Paid' && (i.paid_at || '').startsWith(month));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">Billing</h1>
          <p className="text-xs text-slate-500">Chargeable jobs: Completed → To bill → Invoiced → Paid. A job closes when its invoice is paid.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/clients" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Clients & contracts</Link>
          <button onClick={newQuote} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            <FilePlus2 className="h-4 w-4" /> New quote
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Receipt} label="To bill" value={aed(jobRows.reduce((a, r) => a + r.amount, 0), 0)} sub={`${jobRows.length} job(s) waiting`} tone="text-orange-600" />
        <Kpi icon={FileText} label="Outstanding" value={aed(outstanding.reduce((a, i) => a + i.total, 0), 0)} sub={`${outstanding.length} invoice(s) issued`} tone="text-ocs-blue dark:text-white" />
        <Kpi icon={FileText} label="Overdue" value={aed(overdue.reduce((a, i) => a + i.total, 0), 0)} sub={`${overdue.length} invoice(s) past due`} tone={overdue.length ? 'text-ocs-red' : 'text-slate-500'} />
        <Kpi icon={Wallet} label="Paid this month" value={aed(paidMonth.reduce((a, i) => a + i.total, 0), 0)} sub={`${paidMonth.length} invoice(s)`} tone="text-emerald-600" />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div>}

      <div className="enterprise-card overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 px-3 dark:border-slate-800">
          {([
            ['tobill', `To bill (${jobRows.length})`],
            ['invoices', `Invoices (${invoices.length})`],
            ['quotes', `Quotes (${quotes.length})`],
          ] as [Tab, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-3 py-2.5 text-xs font-semibold ${tab === k ? 'border-orange-500 text-ocs-blue dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'tobill' && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job…" className="enterprise-input pl-8" />
              </div>
              {picked.size > 0 && (
                <>
                  <select value={effectiveClient} onChange={(e) => setClientFor(e.target.value)} className="enterprise-input w-auto">
                    <option value="">Invoice to client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={detailed} onChange={(e) => setDetailed(e.target.checked)} className="h-4 w-4 accent-teal-600" /> Show breakdown
                  </label>
                  <button onClick={createInvoice} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                    Create invoice · {picked.size} job(s) · {aed(pickedRows.reduce((a, r) => a + r.amount, 0))}
                  </button>
                </>
              )}
            </div>
            {clients.length === 0 && (
              <p className="border-b border-slate-100 bg-orange-50/60 px-4 py-2 text-[11px] text-orange-800 dark:border-slate-800 dark:bg-orange-500/10 dark:text-orange-200">
                No clients yet. <Link to="/clients" className="font-semibold underline">Add your clients</Link> before invoicing.
              </p>
            )}
            <Table head={['', 'Job', 'Client', 'Completed', 'Amount']}>
              {jobRows.length === 0 && <Empty cols={5} text="Nothing to bill. Chargeable jobs appear here once they are completed." />}
              {jobRows.map(({ wo, client, amount }) => (
                <tr key={wo.id} className={picked.has(wo.id) ? 'bg-orange-50/50 dark:bg-orange-500/5' : ''}>
                  <td className="w-8 px-3 py-2"><input type="checkbox" checked={picked.has(wo.id)} onChange={() => toggle(wo.id)} className="h-4 w-4 accent-orange-500" /></td>
                  <td className="px-3 py-2">
                    <Link to={`/work-orders/${wo.id}`} className="font-mono font-semibold text-teal-700 hover:underline dark:text-teal-300">{wo.wo_number}</Link>
                    <div className="max-w-md truncate text-[11px] text-slate-500">{wo.wo_type} · {wo.problem_description}</div>
                  </td>
                  <td className="px-3 py-2">{client ? clientName(client) : <span className="text-[11px] italic text-slate-400">not set</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{(wo.completed_at || '').slice(0, 10) || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">{amount ? aed(amount) : <span className="text-ocs-red">AED 0 — check costs</span>}</td>
                </tr>
              ))}
            </Table>
          </>
        )}

        {tab === 'invoices' && (
          <Table head={['Invoice', 'Client', 'Issued', 'Due', 'Status', 'Total']}>
            {invoices.length === 0 && <Empty cols={6} text="No invoices yet. Pick jobs on the To bill tab to create one." />}
            {invoices.map((i) => {
              const st = invoiceState(i);
              return (
                <tr key={i.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30" onClick={() => navigate(`/billing/invoices/${i.id}`)}>
                  <td className="px-3 py-2 font-mono font-semibold text-teal-700 dark:text-teal-300">{i.invoice_number}</td>
                  <td className="px-3 py-2">{clientName(i.client_id)}</td>
                  <td className="px-3 py-2 text-slate-500">{i.issue_date || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{i.due_date || '—'}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INVOICE_META[st].pill}`}>{INVOICE_META[st].label}</span></td>
                  <td className="px-3 py-2 text-right font-semibold">{aed(i.total)}</td>
                </tr>
              );
            })}
          </Table>
        )}

        {tab === 'quotes' && (
          <Table head={['Quote', 'Title', 'Client', 'Valid until', 'Status', 'Total']}>
            {quotes.length === 0 && <Empty cols={6} text="No quotes yet." />}
            {quotes.map((x) => (
              <tr key={x.id} className="cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30" onClick={() => navigate(`/billing/quotes/${x.id}`)}>
                <td className="px-3 py-2 font-mono font-semibold text-teal-700 dark:text-teal-300">{x.quote_number}</td>
                <td className="max-w-xs truncate px-3 py-2">{x.title}</td>
                <td className="px-3 py-2">{clientName(x.client_id)}</td>
                <td className="px-3 py-2 text-slate-500">{x.valid_until || '—'}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${QUOTE_META[x.status].pill}`}>{QUOTE_META[x.status].label}</span>{x.work_order_id && <span className="ml-1 text-[10px] text-slate-500">· job created</span>}</td>
                <td className="px-3 py-2 text-right font-semibold">{aed(x.total)}</td>
              </tr>
            ))}
          </Table>
        )}
      </div>
    </div>
  );
};

const Kpi: React.FC<{ icon: React.ElementType; label: string; value: string; sub: string; tone: string }> = ({ icon: Icon, label, value, sub, tone }) => (
  <div className="enterprise-card p-4">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</div>
    <div className={`text-xl font-bold ${tone}`}>{value}</div>
    <div className="text-[10px] text-slate-500">{sub}</div>
  </div>
);

const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-left text-xs">
      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
        <tr>{head.map((x, i) => <th key={i} className={`px-3 py-2 ${i === head.length - 1 ? 'text-right' : ''}`}>{x}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
    </table>
  </div>
);

const Empty: React.FC<{ cols: number; text: string }> = ({ cols, text }) => (
  <tr><td colSpan={cols} className="px-3 py-12 text-center text-slate-500">{text}</td></tr>
);
