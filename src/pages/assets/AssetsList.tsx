import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  QrCode,
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Asset } from '../../types';
import { exportAssetsToExcel } from '../../utils/excelExporter';
import { AssetQRCodeModal } from '../../components/AssetQRCodeModal';
import { AssetFormModal } from '../../components/AssetFormModal';
import { Hierarchy, hierarchyService } from '../../api/hierarchy';
import { useAuth } from '../../context/AuthContext';

export const AssetsList: React.FC = () => {
  const { isAdmin, isManager } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [filtered, setFiltered] = useState<Asset[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [criticalityFilter, setCriticalityFilter] = useState('ALL');
  const [selectedAssetForQR, setSelectedAssetForQR] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Create Modal state
  const [assetModal, setAssetModal] = useState<{ asset?: Asset } | null>(null);
  const [hierarchy, setHierarchy] = useState<Hierarchy | null>(null);

  // Delete Confirmation state
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = async () => {
    const [astList, h] = await Promise.all([cafmDataService.getAssets(), hierarchyService.loadAll()]);
    setAssets(astList);
    setFiltered(astList);
    setHierarchy(h);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let list = [...assets];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.asset_number.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.manufacturer?.toLowerCase().includes(q) ||
          a.building?.name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (criticalityFilter !== 'ALL') {
      list = list.filter((a) => a.criticality === criticalityFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, criticalityFilter, assets]);

  const handleDeleteConfirm = async () => {
    if (!deletingAsset) return;
    try {
      await cafmDataService.deleteAsset(deletingAsset.id);
      showToast(`🗑️ Asset ${deletingAsset.asset_number} deleted successfully.`);
      setDeletingAsset(null);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 relative w-full">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white border border-teal-500 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <div className="text-xs font-semibold">{toastMsg}</div>
          <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white text-xs font-bold pl-2">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Equipment Asset Registry</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              {filtered.length} Assets
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lifecycle tracking, specifications, location mapping, and QR code asset tags
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportAssetsToExcel(filtered)}
            className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          {(isAdmin || isManager) && (
            <button
              onClick={() => setAssetModal({})}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Asset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by asset tag, name, manufacturer, or building..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Inactive">Inactive</option>
              <option value="Disposed">Disposed</option>
            </select>

            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Criticality</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Asset Tag</th>
                <th className="px-5 py-3.5">Equipment Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Criticality</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white">
                    <Link to={`/assets/${a.id}`} className="text-teal-600 dark:text-teal-400 hover:underline">
                      {a.asset_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{a.name}</div>
                    <div className="text-[11px] text-slate-400">{a.manufacturer} {a.model ? `- ${a.model}` : ''}</div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{a.category?.name}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{a.building?.name}</div>
                    <div className="text-[11px] text-slate-400">{a.floor?.name} - {a.location?.name}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        a.criticality === 'Critical'
                          ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          : a.criticality === 'High'
                          ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400'
                          : a.criticality === 'Medium'
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {a.criticality}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        a.status === 'Active'
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                          : a.status === 'Under Maintenance'
                          ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                          : a.status === 'Inactive'
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    {/* QR Code */}
                    <button
                      onClick={() => setSelectedAssetForQR(a)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-teal-600 rounded-lg transition-colors inline-flex items-center"
                      title="Print QR Badge"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {/* View */}
                    <Link
                      to={`/assets/${a.id}`}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 text-slate-700 dark:text-slate-200 rounded text-[11px] font-semibold transition-colors inline-block"
                    >
                      View
                    </Link>

                    {/* Admin: Edit Asset */}
                    {isAdmin && (
                      <button
                        onClick={() => setAssetModal({ asset: a })}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-blue-600 rounded-lg transition-colors inline-flex items-center"
                        title="Edit Equipment Details (Admin Only)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Admin: Delete Asset */}
                    {isAdmin && (
                      <button
                        onClick={() => setDeletingAsset(a)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center"
                        title="Delete Asset (Admin Only)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Modal */}
      {selectedAssetForQR && (
        <AssetQRCodeModal
          asset={selectedAssetForQR}
          onClose={() => setSelectedAssetForQR(null)}
        />
      )}

      {/* Create / Edit Asset (shared form) */}
      {assetModal && hierarchy && (
        <AssetFormModal
          hierarchy={hierarchy}
          asset={assetModal.asset}
          onClose={() => setAssetModal(null)}
          onSaved={async (saved) => {
            setAssetModal(null);
            await loadData();
            showToast(`✅ Equipment asset ${saved.asset_number} ${assetModal.asset ? 'updated' : 'registered'} successfully.`);
          }}
        />
      )}

      {/* Delete Confirmation Modal (Admin) */}
      {deletingAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete Equipment Asset
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently remove asset <strong className="text-slate-900 dark:text-white">{deletingAsset.asset_number} ({deletingAsset.name})</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingAsset(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
