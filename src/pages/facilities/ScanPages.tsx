import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Boxes, ClipboardList, Loader2, MapPin, Plus } from 'lucide-react';
import { Hierarchy, hierarchyService, roomPath } from '../../api/hierarchy';
import { cafmDataService } from '../../api/supabase';
import { isOpen, statusMeta } from '../../utils/woFlow';
import { WorkOrder } from '../../types';

/**
 * Where a scanned QR label lands.
 *   /r/:token  room label   -> the room, its equipment and open jobs, "Report a problem here"
 *   /a/:code   asset label  -> the asset page
 * Both sit behind sign-in; after signing in you come straight back here.
 */

export const RoomScan: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [h, setH] = useState<Hierarchy | null>(null);
  const [jobs, setJobs] = useState<WorkOrder[]>([]);

  useEffect(() => {
    Promise.all([hierarchyService.loadAll(), cafmDataService.getWorkOrders()]).then(([hier, w]) => {
      setH(hier);
      setJobs(w);
    });
  }, []);

  if (!h) return <Loading />;
  const room = h.rooms.find((r) => r.qr_token === token);
  if (!room) {
    return (
      <div className="mx-auto max-w-md py-16 text-center text-sm text-slate-500">
        This QR label is not linked to a room any more. <Link to="/facilities" className="font-semibold text-teal-600">Open the facility tree</Link>
      </div>
    );
  }
  const path = roomPath(h, room.id);
  const assets = h.assets.filter((a) => a.location_id === room.id);
  const open = jobs.filter((w) => w.location_id === room.id && isOpen(w.status));

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="enterprise-card p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-500"><MapPin className="h-3.5 w-3.5" /> Room</div>
        <h1 className="text-xl font-bold text-ocs-blue dark:text-white">{room.name}</h1>
        <p className="text-xs text-slate-500">{path.join(' / ')}</p>
        <Link to={`/work-orders/new?room=${room.id}`} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600">
          <Plus className="h-5 w-5" /> Report a problem here
        </Link>
      </div>

      <Section icon={ClipboardList} title={`Open jobs (${open.length})`}>
        {open.length === 0 && <p className="py-3 text-center text-xs text-slate-500">No open jobs in this room.</p>}
        {open.map((w) => (
          <Link key={w.id} to={`/work-orders/${w.id}`} className="flex items-center justify-between gap-2 py-2.5 text-xs">
            <span className="min-w-0">
              <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">{w.wo_number}</span>
              <span className="block truncate text-slate-600 dark:text-slate-300">{w.problem_description}</span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta(w.status).pill}`}>{statusMeta(w.status).label}</span>
          </Link>
        ))}
      </Section>

      <Section icon={Boxes} title={`Equipment (${assets.length})`}>
        {assets.length === 0 && <p className="py-3 text-center text-xs text-slate-500">No equipment registered in this room.</p>}
        {assets.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
            <Link to={`/assets/${a.id}`} className="min-w-0">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{a.name}</span>
              <span className="block text-[10px] text-slate-500">{a.asset_number} · {a.status}</span>
            </Link>
            <Link to={`/work-orders/new?asset=${a.id}`} className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-orange-600 dark:border-slate-700">Report fault</Link>
          </div>
        ))}
      </Section>
    </div>
  );
};

export const AssetScan: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const [target, setTarget] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    cafmDataService.getAssets().then((as) => {
      const c = decodeURIComponent(code || '').toLowerCase();
      setTarget(as.find((a) => a.asset_number.toLowerCase() === c || a.id === code)?.id || null);
    });
  }, [code]);

  if (target === undefined) return <Loading />;
  if (target) return <Navigate to={`/assets/${target}`} replace />;
  return <div className="py-16 text-center text-sm text-slate-500">No asset with code “{code}”. <Link to="/assets" className="font-semibold text-teal-600">Search assets</Link></div>;
};

const Loading = () => (
  <div className="flex h-64 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>
);

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div className="enterprise-card p-4">
    <h2 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500"><Icon className="h-4 w-4 text-orange-500" /> {title}</h2>
    <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
  </div>
);
