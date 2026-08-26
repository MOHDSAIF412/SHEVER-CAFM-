import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkOrder } from '../types';

interface LoadedImage {
  dataUrl: string;
  format: 'JPEG' | 'PNG';
  width: number;
  height: number;
}

/**
 * Fetches an image and returns it as a data URL with its natural size.
 *
 * jsPDF cannot embed a remote URL directly, which is why photos never appeared
 * in the report: the old code only accepted `data:image` strings, and once
 * photos moved to Supabase Storage every URL became `https://…` and silently
 * fell through to placeholder text.
 *
 * Returns null rather than throwing - a report missing one photo is still worth
 * producing.
 */
const loadImage = async (url?: string | null): Promise<LoadedImage | null> => {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const { width, height } = await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
      }
    );

    return {
      dataUrl,
      format: blob.type.includes('png') ? 'PNG' : 'JPEG',
      width,
      height,
    };
  } catch {
    return null;
  }
};

/** Fits an image inside a box without distorting it, and centres it. */
const fit = (
  img: LoadedImage,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
) => {
  const scale = Math.min(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: boxX + (boxW - w) / 2, y: boxY + (boxH - h) / 2, w, h };
};

/** Latest photo of a given type, falling back to the column on the work order. */
const photoUrlFor = (wo: WorkOrder, type: 'before' | 'after'): string | undefined => {
  const fromList = (wo.photos || [])
    .filter((p) => p.photo_type === type)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.photo_url;
  return fromList || (type === 'before' ? wo.before_photo_url : wo.after_photo_url);
};

const NOT_RECORDED = 'Not recorded';

export const generateWorkOrderPDF = async (wo: WorkOrder) => {
  const doc = new jsPDF();

  // Fetch everything up front so the layout below stays synchronous.
  const [logo, beforeImg, afterImg] = await Promise.all([
    loadImage('/shever-logo.png'),
    loadImage(photoUrlFor(wo, 'before')),
    loadImage(photoUrlFor(wo, 'after')),
  ]);

  // ---------------------------------------------------------------- header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  let textX = 14;
  if (logo) {
    doc.addImage(logo.dataUrl, logo.format, 14, 6, 20, 20);
    textX = 39;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('SHEVER TECHNICAL SERVICES', textX, 14);

  doc.setFontSize(8.5);
  doc.setTextColor(45, 212, 191); // teal
  doc.text('FACILITIES MANAGEMENT & CAFM CLIENT SERVICE REPORT', textX, 20);

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Dubai, UAE | support@shevertechnical.com | +971 4 388 9900', textX, 26);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('WORK ORDER REPORT', 142, 14);
  doc.setFontSize(8.5);
  doc.text(`WO #: ${wo.wo_number}`, 142, 21);
  doc.text(`Status: ${wo.status.toUpperCase()}`, 142, 27);

  // ------------------------------------------------------------- metadata
  //
  // Every value below is what the system holds, or "Not recorded". These
  // fields previously fell back to invented content - a named technician who
  // was never assigned, and "15 mins (SLA Met)" whether or not it was.
  const slaText = (() => {
    if (!wo.resolution_due_at) return NOT_RECORDED;
    const due = new Date(wo.resolution_due_at);
    const finished = wo.closed_at || wo.completed_at;
    if (!finished) return `Target ${due.toLocaleString()}`;
    const met = new Date(finished) <= due;
    return `${due.toLocaleString()} (${met ? 'met' : 'missed'})`;
  })();

  doc.setTextColor(15, 23, 42);
  autoTable(doc, {
    startY: 36,
    head: [['Property / Field', 'Details', 'Property / Field', 'Details']],
    body: [
      ['Work Order #', wo.wo_number, 'Date & Time Logged', new Date(wo.created_at).toLocaleString()],
      ['Priority / SLA', `${wo.priority} Priority`, 'Current Status', wo.status],
      ['Building', wo.building?.name || NOT_RECORDED, 'Floor / Location',
        [wo.floor?.name, wo.location?.name].filter(Boolean).join(' - ') || NOT_RECORDED],
      ['Trade / Category', wo.category?.name || NOT_RECORDED, 'Equipment Asset',
        wo.asset?.asset_number ? `${wo.asset.asset_number} (${wo.asset.name})` : 'General area'],
      ['Reported By',
        `${wo.reported_by_name || NOT_RECORDED}${wo.reported_by_phone ? ` (${wo.reported_by_phone})` : ''}`,
        'Assigned Technician', wo.assigned_technician?.full_name || 'Unassigned'],
      ['Resolution Target', slaText, 'Response Time',
        wo.response_time_minutes ? `${wo.response_time_minutes} mins` : NOT_RECORDED],
    ],
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  // ------------------------------------------------------- problem section
  const currentY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. REPORTED PROBLEM & FAULT DESCRIPTION:', 14, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const splitProblem = doc.splitTextToSize(
    wo.problem_description || 'No description provided.',
    180
  );
  doc.text(splitProblem, 14, currentY + 4.5);

  // ----------------------------------------------------- corrective action
  //
  // These four rows used to invent a full maintenance narrative when the
  // technician had entered nothing - describing component alignment, load
  // testing and parts replaced that may never have happened. On a document
  // sent to a client that is not a placeholder, it is a false record.
  const nextY = currentY + 6 + splitProblem.length * 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('2. CORRECTIVE ACTION TAKEN & RESOLUTION SUMMARY:', 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    body: [
      ['Work Performed', wo.work_performed || NOT_RECORDED],
      ['Root Cause Analysis', wo.root_cause || NOT_RECORDED],
      ['Action Taken', wo.action_taken || NOT_RECORDED],
      ['Technician Remarks', wo.remarks || NOT_RECORDED],
    ],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42, textColor: [15, 23, 42] } },
  });

  // ------------------------------------------------------ photographic evidence
  let photoY = (doc as any).lastAutoTable.finalY + 6;
  if (photoY > 205) {
    doc.addPage();
    photoY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. PHOTOGRAPHIC EVIDENCE:', 14, photoY);

  const drawPhotoBox = (
    img: LoadedImage | null,
    x: number,
    label: string,
    labelColor: [number, number, number]
  ) => {
    const boxY = photoY + 4;
    const boxW = 88;
    const boxH = 56;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, boxY, boxW, boxH, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...labelColor);
    doc.text(label, x + 4, boxY + 6);

    if (img) {
      const box = fit(img, x + 3, boxY + 9, boxW - 6, boxH - 13);
      try {
        doc.addImage(img.dataUrl, img.format, box.x, box.y, box.w, box.h);
        return;
      } catch {
        // fall through to the "no photo" state below
      }
    }

    // No photo. Say so plainly - this used to claim the photo had been
    // captured and the handover verified, with no photo behind either claim.
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('No photograph on record', x + 4, boxY + boxH / 2 + 1);
  };

  drawPhotoBox(beforeImg, 14, 'BEFORE MAINTENANCE', [220, 38, 38]);
  drawPhotoBox(afterImg, 108, 'AFTER MAINTENANCE', [16, 185, 129]);

  // ---------------------------------------------------------------- footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated ${new Date().toLocaleString()} by the Shever Technical Services CAFM platform.`,
    14,
    288
  );

  doc.save(`${wo.wo_number}_Client_Report.pdf`);
};
