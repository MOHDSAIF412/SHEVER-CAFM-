import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadImage } from './pdfGenerator';
import { BillingSettings } from '../api/billing';
import { BillingLine, Client, Invoice, Quote } from '../types';

/**
 * Invoice / quote PDF in OCS branding. With VAT on, the invoice is titled
 * "Tax Invoice" and carries both TRNs and the VAT amount in AED, as the UAE
 * FTA requires.
 */

const money = (n: number) => (Number(n) || 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export const generateBillingPdf = async (
  kind: 'invoice' | 'quote',
  doc: Invoice | Quote,
  lines: BillingLine[],
  client: Client | undefined,
  s: BillingSettings
) => {
  const pdf = new jsPDF();
  const logo = await loadImage('/ocs-logo-white.png');
  const isInvoice = kind === 'invoice';
  const vatOn = (doc.vat_rate || 0) > 0;
  const title = isInvoice ? (vatOn ? 'TAX INVOICE' : 'INVOICE') : 'QUOTATION';
  const number = isInvoice ? (doc as Invoice).invoice_number : (doc as Quote).quote_number;

  // Header band
  pdf.setFillColor(41, 55, 113);
  pdf.rect(0, 0, 210, 32, 'F');
  pdf.setFillColor(241, 95, 34);
  pdf.rect(0, 32, 210, 1.2, 'F');
  let x = 14;
  if (logo) {
    pdf.addImage(logo.dataUrl, logo.format, 14, 7, 34, 18.4);
    x = 54;
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('OCS FACILITIES SERVICES', x, 14);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(203, 213, 225);
  const addr = (s.company_address || 'United Arab Emirates').split('\n').slice(0, 2);
  addr.forEach((l, i) => pdf.text(l, x, 20 + i * 4));
  if (s.company_trn) pdf.text(`TRN: ${s.company_trn}`, x, 20 + addr.length * 4);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text(title, 196, 15, { align: 'right' });
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(number, 196, 22, { align: 'right' });

  // Bill to / details
  pdf.setTextColor(15, 23, 42);
  let y = 44;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(241, 95, 34);
  pdf.text(isInvoice ? 'BILL TO' : 'PREPARED FOR', 14, y);
  pdf.text('DETAILS', 120, y);
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(10);
  pdf.text(client?.name || '—', 14, y + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  const billLines = [
    ...(client?.billing_address || '').split('\n').filter(Boolean),
    client?.trn ? `TRN: ${client.trn}` : '',
    client?.contact_name ? `Attn: ${client.contact_name}` : '',
    client?.contact_email || '',
  ].filter(Boolean);
  billLines.slice(0, 6).forEach((l, i) => pdf.text(l, 14, y + 11 + i * 4.5));

  const details: [string, string][] = isInvoice
    ? [
        ['Invoice no.', number],
        ['Invoice date', date((doc as Invoice).issue_date || new Date().toISOString())],
        ['Due date', date((doc as Invoice).due_date)],
        ...((doc as Invoice).client_po_number ? [['Your PO', (doc as Invoice).client_po_number!] as [string, string]] : []),
        ['Currency', 'AED'],
      ]
    : [
        ['Quote no.', number],
        ['Date', date(doc.created_at)],
        ['Valid until', date((doc as Quote).valid_until)],
        ['Currency', 'AED'],
      ];
  details.forEach(([k, v], i) => {
    pdf.setTextColor(100, 116, 139);
    pdf.text(k, 120, y + 6 + i * 5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(v, 196, y + 6 + i * 5, { align: 'right' });
  });
  y = Math.max(y + 14 + billLines.length * 4.5, y + 8 + details.length * 5) + 4;

  if (!isInvoice) {
    const q = doc as Quote;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(q.title, 14, y);
    y += 5;
    if (q.description) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      const wrapped = pdf.splitTextToSize(q.description, 182);
      pdf.text(wrapped, 14, y);
      y += wrapped.length * 4 + 2;
    }
  }

  autoTable(pdf, {
    startY: y,
    head: [['#', 'Description', 'Qty', 'Unit price', 'Amount (AED)']],
    body: lines.map((l, i) => [String(i + 1), l.description, String(Number(l.quantity)), money(l.unit_price), money(l.amount ?? l.quantity * l.unit_price)]),
    theme: 'grid',
    headStyles: { fillColor: [41, 55, 113], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 8 }, 2: { halign: 'right', cellWidth: 14 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 30 } },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Totals
  const totals: [string, string][] = [
    ['Subtotal', money(doc.subtotal)],
    ...(vatOn ? [[`VAT ${doc.vat_rate}%`, money(doc.vat_amount)] as [string, string]] : []),
  ];
  pdf.setFontSize(9);
  totals.forEach(([k, v]) => {
    pdf.setTextColor(100, 116, 139);
    pdf.text(k, 150, y + 4);
    pdf.setTextColor(15, 23, 42);
    pdf.text(v, 196, y + 4, { align: 'right' });
    y += 5.5;
  });
  pdf.setFillColor(241, 95, 34);
  pdf.rect(120, y, 76, 9, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.text(`TOTAL AED`, 124, y + 6);
  pdf.text(money(doc.total), 194, y + 6, { align: 'right' });
  y += 16;

  // Footer notes
  pdf.setTextColor(15, 23, 42);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const notes: string[] = [];
  if (doc.notes) notes.push(doc.notes);
  if (isInvoice && s.bank_details) notes.push(`Payment details:\n${s.bank_details}`);
  if (isInvoice) notes.push(`Payment due within ${s.payment_terms_days} days of the invoice date.`);
  if (!isInvoice) notes.push('Prices in AED' + (vatOn ? ', VAT shown separately.' : '.') + ' This quotation is valid until the date shown above.');
  notes.forEach((n) => {
    const w = pdf.splitTextToSize(n, 182);
    if (y + w.length * 4 > 280) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(w, 14, y);
    y += w.length * 4 + 3;
  });

  pdf.setFontSize(7);
  pdf.setTextColor(148, 163, 184);
  pdf.text('OCS Facilities Services — computer-generated document', 105, 290, { align: 'center' });
  pdf.save(`${number}.pdf`);
};
