import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Hierarchy, hierarchyService, roomPath, roomQrValue } from '../../api/hierarchy';

/**
 * Printable QR label sheets for rooms and assets.
 * Rooms encode the QR-portal link (/r/<token>); assets encode their asset
 * number, which is what the technician app's scanner looks up.
 */
type Mode = 'rooms' | 'assets';
type Size = 'small' | 'large';

interface Label {
  id: string;
  qr: string;
  title: string;
  code: string;
  path: string;
}

export const QRLabels: React.FC = () => {
  const [params] = useSearchParams();
  const preselectedRooms = params.get('rooms')?.split(',').filter(Boolean) || [];
  const preselectedAssets = params.get('assets')?.split(',').filter(Boolean) || [];

  const [h, setH] = useState<Hierarchy | null>(null);
  const [mode, setMode] = useState<Mode>(preselectedAssets.length ? 'assets' : 'rooms');
  const [size, setSize] = useState<Size>('small');
  const [buildingId, setBuildingId] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set([...preselectedRooms, ...preselectedAssets]));

  useEffect(() => {
    hierarchyService.loadAll().then(setH);
  }, []);

  const labels: Label[] = useMemo(() => {
    if (!h) return [];
    const floorBuilding = (floorId: string) => h.floors.find((f) => f.id === floorId)?.building_id;
    if (mode === 'rooms') {
      return h.rooms
        .filter((r) => r.qr_token && (!buildingId || floorBuilding(r.floor_id) === buildingId))
        .map((r) => ({
          id: r.id,
          qr: roomQrValue(r.qr_token!),
          title: r.name,
          code: r.code,
          path: roomPath(h, r.id).slice(0, -1).join(' / '),
        }));
    }
    return h.assets
      .filter((a) => !buildingId || a.building_id === buildingId)
      .map((a) => ({
        id: a.id,
        qr: a.asset_number,
        title: a.name,
        code: a.asset_number,
        path: roomPath(h, a.location_id).join(' / '),
      }));
  }, [h, mode, buildingId]);

  const missingTokens = h ? h.rooms.filter((r) => !r.qr_token).length : 0;
  const chosen = labels.filter((l) => picked.has(l.id));
  const allPicked = labels.length > 0 && labels.every((l) => picked.has(l.id));

  const togglePick = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const toggleAll = () =>
    setPicked((p) => {
      const n = new Set(p);
      labels.forEach((l) => (allPicked ? n.delete(l.id) : n.add(l.id)));
      return n;
    });

  const sheet = (
    <div className={`label-grid ${size}`}>
      {chosen.map((l) => (
        <div key={l.id} className="label">
          <QRCodeSVG value={l.qr} size={size === 'small' ? 92 : 150} level="M" />
          <div className="label-text">
            <img src="/ocs-logo.png" alt="OCS" className="label-logo" />
            <div className="label-code">{l.code}</div>
            <div className="label-title">{l.title}</div>
            <div className="label-path">{l.path}</div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!h) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{LABEL_CSS}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/facilities" className="mb-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-600">
            <ArrowLeft className="h-3.5 w-3.5" /> Facility Hierarchy
          </Link>
          <h1 className="text-lg font-bold text-ocs-blue dark:text-white">QR labels</h1>
          <p className="text-xs text-slate-500">Pick rooms or assets, then print on A4. Each label shows the OCS logo, code, name and location.</p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={chosen.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" /> Print {chosen.length || ''} label{chosen.length === 1 ? '' : 's'}
        </button>
      </div>

      <div className="enterprise-card flex flex-wrap items-center gap-3 p-3 text-xs">
        <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(['rooms', 'assets'] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 font-semibold capitalize ${mode === m ? 'bg-teal-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {m}
            </button>
          ))}
        </div>
        <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="enterprise-input w-auto">
          <option value="">All buildings</option>
          {h.buildings.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value as Size)} className="enterprise-input w-auto">
          <option value="small">Small (3 per row)</option>
          <option value="large">Large (2 per row)</option>
        </select>
        {mode === 'rooms' && missingTokens > 0 && (
          <span className="text-slate-500">{missingTokens} room(s) have no QR yet — open them in the hierarchy and click "Generate QR".</span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="enterprise-card max-h-[60vh] overflow-y-auto p-3">
          {labels.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">Nothing to label here.</p>
          ) : (
            <>
              <label className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-semibold dark:border-slate-800">
                <input type="checkbox" checked={allPicked} onChange={toggleAll} /> Select all ({labels.length})
              </label>
              {labels.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={picked.has(l.id)} onChange={() => togglePick(l.id)} className="mt-0.5" />
                  <span>
                    <span className="font-mono font-semibold">{l.code}</span> {l.title}
                    <span className="block text-[10px] text-slate-500">{l.path}</span>
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
        <div className="enterprise-card overflow-x-auto bg-slate-100 p-4 dark:bg-slate-800">
          {chosen.length === 0 ? (
            <p className="py-16 text-center text-xs text-slate-500">Preview appears here.</p>
          ) : (
            <div className="mx-auto w-[210mm] max-w-full bg-white p-[8mm] shadow">{sheet}</div>
          )}
        </div>
      </div>

      {chosen.length > 0 && createPortal(<div className="qr-print-root">{sheet}</div>, document.body)}
    </div>
  );
};

const LABEL_CSS = `
.label-grid { display: grid; gap: 4mm; }
.label-grid.small { grid-template-columns: repeat(3, 1fr); }
.label-grid.large { grid-template-columns: repeat(2, 1fr); }
.label { display: flex; align-items: center; gap: 3mm; border: 0.3mm solid #C2C4C6; border-radius: 2mm;
  padding: 3mm; break-inside: avoid; color: #293771; font-family: 'Open Sans', sans-serif; background: #fff; }
.label-text { min-width: 0; }
.label-logo { height: 6mm; margin-bottom: 1mm; }
.label-code { font-family: ui-monospace, monospace; font-weight: 700; font-size: 10pt; color: #F15F22; }
.label-title { font-weight: 700; font-size: 9pt; line-height: 1.2; }
.label-path { font-size: 7pt; color: #4D4D4F; line-height: 1.2; margin-top: 1mm; }
.label-grid.large .label-code { font-size: 13pt; }
.label-grid.large .label-title { font-size: 11pt; }
.qr-print-root { display: none; }
@media print {
  @page { size: A4; margin: 8mm; }
  body > *:not(.qr-print-root) { display: none !important; }
  .qr-print-root { display: block !important; }
}
`;
