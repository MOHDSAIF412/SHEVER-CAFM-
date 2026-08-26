import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  Search,
  Filter,
  QrCode,
  FileSpreadsheet,
  PlusCircle,
  AlertCircle,
  Building2,
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { Asset, Building, Floor, Location, Category } from '../../types';
import { exportAssetsToExcel } from '../../utils/excelExporter';
import { AssetQRCodeModal } from '../../components/AssetQRCodeModal';
import { useAuth } from '../../context/AuthContext';

export const AssetsList: React.FC = () => {
  const { isAdmin, isManager } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [filtered, setFiltered] = useState<Asset[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [criticalityFilter, setCriticalityFilter] = useState('ALL');
  const [selectedAssetForQR, setSelectedAssetForQR] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal state
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');
  const [editManufacturer, setEditManufacturer] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editBuildingId, setEditBuildingId] = useState('');
  const [editFloorId, setEditFloorId] = useState('');
  const [editLocationId, setEditLocationId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editCriticality, setEditCriticality] = useState<Asset['criticality']>('High');
  const [editStatus, setEditStatus] = useState<Asset['status']>('Active');

  // Delete Confirmation state
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);

  // Create Form states
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedFloorId, setSelectedFloorId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [criticality, setCriticality] = useState<Asset['criticality']>('High');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = async () => {
    const [astList, bldList, catList] = await Promise.all([
      cafmDataService.getAssets(),
      cafmDataService.getBuildings(),
      cafmDataService.getCategories(),
    ]);
    setAssets(astList);
    setFiltered(astList);
    setBuildings(bldList);
    setCategories(catList);

    if (bldList.length > 0) {
      setSelectedBuildingId(bldList[0].id);
      const flrList = await cafmDataService.getFloors(bldList[0].id);
      setFloors(flrList);
      if (flrList.length > 0) {
        setSelectedFloorId(flrList[0].id);
        const locList = await cafmDataService.getLocations(flrList[0].id);
        setLocations(locList);
        if (locList.length > 0) setSelectedLocationId(locList[0].id);
      }
    }
    if (catList.length > 0) setSelectedCategoryId(catList[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleBuildingChange = async (bldId: string) => {
    setSelectedBuildingId(bldId);
    const flrList = await cafmDataService.getFloors(bldId);
    setFloors(flrList);
    if (flrList.length > 0) {
      setSelectedFloorId(flrList[0].id);
      const locList = await cafmDataService.getLocations(flrList[0].id);
      setLocations(locList);
      if (locList.length > 0) setSelectedLocationId(locList[0].id);
    }
  };

  const handleFloorChange = async (flrId: string) => {
    setSelectedFloorId(flrId);
    const locList = await cafmDataService.getLocations(flrId);
    setLocations(locList);
    if (locList.length > 0) setSelectedLocationId(locList[0].id);
  };

  const handleEditBuildingChange = async (bldId: string) => {
    setEditBuildingId(bldId);
    const flrList = await cafmDataService.getFloors(bldId);
    setFloors(flrList);
    if (flrList.length > 0) {
      setEditFloorId(flrList[0].id);
      const locList = await cafmDataService.getLocations(flrList[0].id);
      setLocations(locList);
      if (locList.length > 0) setEditLocationId(locList[0].id);
    }
  };

  const handleEditFloorChange = async (flrId: string) => {
    setEditFloorId(flrId);
    const locList = await cafmDataService.getLocations(flrId);
    setLocations(locList);
    if (locList.length > 0) setEditLocationId(locList[0].id);
  };

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

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await cafmDataService.createAsset({
        name,
        manufacturer,
        model,
        serial_number: serialNumber,
        building_id: selectedBuildingId,
        floor_id: selectedFloorId,
        location_id: selectedLocationId,
        category_id: selectedCategoryId,
        criticality,
      });
      setShowCreateModal(false);
      setName('');
      setManufacturer('');
      setModel('');
      setSerialNumber('');
      await loadData();
      showToast(`✅ Equipment asset ${created.asset_number} registered successfully.`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = async (a: Asset) => {
    setEditingAsset(a);
    setEditName(a.name);
    setEditManufacturer(a.manufacturer || '');
    setEditModel(a.model || '');
    setEditSerialNumber(a.serial_number || '');
    setEditBuildingId(a.building_id || '');
    setEditCategoryId(a.category_id || '');
    setEditCriticality(a.criticality);
    setEditStatus(a.status);

    if (a.building_id) {
      const flrs = await cafmDataService.getFloors(a.building_id);
      setFloors(flrs);
      setEditFloorId(a.floor_id || (flrs[0]?.id ?? ''));
      if (a.floor_id) {
        const locs = await cafmDataService.getLocations(a.floor_id);
        setLocations(locs);
        setEditLocationId(a.location_id || (locs[0]?.id ?? ''));
      }
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setSubmitting(true);
    try {
      await cafmDataService.updateAsset(editingAsset.id, {
        name: editName,
        manufacturer: editManufacturer,
        model: editModel,
        serial_number: editSerialNumber,
        building_id: editBuildingId,
        floor_id: editFloorId,
        location_id: editLocationId,
        category_id: editCategoryId,
        criticality: editCriticality,
        status: editStatus,
      });
      setEditingAsset(null);
      await loadData();
      showToast(`✅ Equipment asset ${editingAsset.asset_number} updated successfully.`);
    } finally {
      setSubmitting(false);
    }
  };

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
              onClick={() => setShowCreateModal(true)}
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
                        onClick={() => openEditModal(a)}
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

      {/* Create Asset Modal (Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Boxes className="w-4 h-4 text-teal-600" />
                <span>Register New Facility Asset</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Centrifugal Chiller Unit #3"
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder="e.g. Daikin / Trane"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. RTAC-200"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="e.g. SN-8899201"
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Building *</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => handleBuildingChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Floor *</label>
                  <select
                    value={selectedFloorId}
                    onChange={(e) => handleFloorChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Location *</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Criticality *</label>
                  <select
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow transition-colors"
                >
                  {submitting ? 'Registering...' : 'Register Asset & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal (Admin) */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <span>Edit Equipment Asset: {editingAsset.asset_number}</span>
              </h3>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Manufacturer</label>
                  <input
                    type="text"
                    value={editManufacturer}
                    onChange={(e) => setEditManufacturer(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Model</label>
                  <input
                    type="text"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={editSerialNumber}
                    onChange={(e) => setEditSerialNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Building *</label>
                  <select
                    value={editBuildingId}
                    onChange={(e) => handleEditBuildingChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Floor *</label>
                  <select
                    value={editFloorId}
                    onChange={(e) => handleEditFloorChange(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {floors.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Location *</label>
                  <select
                    value={editLocationId}
                    onChange={(e) => setEditLocationId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Criticality *</label>
                  <select
                    value={editCriticality}
                    onChange={(e) => setEditCriticality(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status *</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold focus:ring-1 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Disposed">Disposed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-colors"
                >
                  {submitting ? 'Saving...' : 'Save Asset Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
