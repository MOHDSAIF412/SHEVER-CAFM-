import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  QrCode,
  Building2,
  Calendar,
  Shield,
  Activity,
  PlusCircle,
  Clock,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Asset, WorkOrder, PPMSchedule } from '../../types';
import { AssetQRCodeModal } from '../../components/AssetQRCodeModal';

export const AssetDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [a, w, p] = await Promise.all([
          cafmDataService.getAssetById(id),
          cafmDataService.getWorkOrders(),
          cafmDataService.getPPMSchedules(),
        ]);
        if (a) setAsset(a);
        setWorkOrders(w.filter((item) => item.asset_id === a?.id || item.asset_id === id));
        setPpmSchedules(p.filter((item) => item.plan?.asset_id === a?.id || item.plan?.asset_id === id));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading || !asset) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            to="/assets"
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{asset.name}</h1>
              <span className="text-xs font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                {asset.asset_number}
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {asset.manufacturer} | Model: {asset.model} | Serial: {asset.serial_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQRModal(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <QrCode className="w-4 h-4 text-teal-600" />
            <span>Print QR Badge</span>
          </button>
          <Link
            to={`/work-orders/new`}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Breakdown</span>
          </Link>
        </div>
      </div>

      {/* Asset 360 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Specifications Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3 md:col-span-1">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Asset Specifications
          </h3>

          <div className="space-y-2 text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">Category:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.category?.name}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">Location:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {asset.building?.name} - {asset.location?.name}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">Criticality:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{asset.criticality}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">Current Status:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{asset.status}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">Installation Date:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{asset.installation_date || '2024-01-15'}</span>
            </div>
          </div>
        </div>

        {/* Maintenance History & PPM Schedules */}
        <div className="md:col-span-2 space-y-6">
          {/* Work Orders on this asset */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Corrective Maintenance History ({workOrders.length})</span>
            </h3>

            {workOrders.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No corrective work orders recorded for this asset.</p>
            ) : (
              <div className="space-y-2">
                {workOrders.map((w) => (
                  <Link
                    key={w.id}
                    to={`/work-orders/${w.id}`}
                    className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200/60 dark:border-slate-800/80 hover:border-teal-500 flex items-center justify-between transition-all"
                  >
                    <div>
                      <div className="font-bold text-xs text-teal-700 dark:text-teal-400">{w.wo_number}</div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-1">{w.problem_description}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{w.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showQRModal && (
        <AssetQRCodeModal asset={asset} onClose={() => setShowQRModal(false)} />
      )}
    </div>
  );
};
