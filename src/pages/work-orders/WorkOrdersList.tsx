import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Columns,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Check,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { WorkOrder, Building as BuildingType, Category, UserProfile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { exportWorkOrdersToExcel } from '../../utils/excelExporter';

export const WorkOrdersList: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || 'ALL';
  const initialPriority = searchParams.get('priority') || 'ALL';

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [filteredWos, setFilteredWos] = useState<WorkOrder[]>([]);
  const [buildings, setBuildings] = useState<BuildingType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkToast, setBulkToast] = useState<string | null>(null);

  // Deletion modal states
  const [deletingWo, setDeletingWo] = useState<WorkOrder | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Filters
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const [wos, blds, cats, techs] = await Promise.all([
          cafmDataService.getWorkOrders(),
          cafmDataService.getBuildings(),
          cafmDataService.getCategories(),
          cafmDataService.getTechnicians(),
        ]);
        setWorkOrders(wos);
        setBuildings(blds);
        setCategories(cats);
        setTechnicians(techs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    let list = [...workOrders];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (w) =>
          w.wo_number.toLowerCase().includes(q) ||
          w.problem_description.toLowerCase().includes(q) ||
          w.building?.name?.toLowerCase().includes(q) ||
          w.location?.name?.toLowerCase().includes(q) ||
          w.asset?.name?.toLowerCase().includes(q) ||
          w.assigned_technician?.full_name?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      if (statusFilter === 'Overdue') {
        list = list.filter((w) => w.is_overdue);
      } else {
        list = list.filter((w) => w.status === statusFilter);
      }
    }

    if (priorityFilter !== 'ALL') {
      list = list.filter((w) => w.priority === priorityFilter);
    }

    if (buildingFilter !== 'ALL') {
      list = list.filter((w) => w.building_id === buildingFilter);
    }

    if (categoryFilter !== 'ALL') {
      list = list.filter((w) => w.category_id === categoryFilter);
    }

    setFilteredWos(list);
    setCurrentPage(1);
  }, [search, statusFilter, priorityFilter, buildingFilter, categoryFilter, workOrders]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedIds.length === filteredWos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredWos.map((w) => w.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = async (newStatus: WorkOrder['status']) => {
    const count = selectedIds.length;
    for (const id of selectedIds) {
      await cafmDataService.updateWorkOrderStatus(id, newStatus, {
        work_performed: newStatus === 'Closed' ? 'Bulk closed and approved by Administrator.' : undefined,
      });
    }
    const fresh = await cafmDataService.getWorkOrders();
    setWorkOrders(fresh);
    setSelectedIds([]);
    setBulkToast(`✅ Admin Action: ${count} work orders successfully changed to status "${newStatus}".`);
    setTimeout(() => setBulkToast(null), 4500);
  };

  const handleDeleteSingle = async () => {
    if (!deletingWo) return;
    await cafmDataService.deleteWorkOrder(deletingWo.id);
    const fresh = await cafmDataService.getWorkOrders();
    setWorkOrders(fresh);
    setBulkToast(`🗑️ Work order ${deletingWo.wo_number} deleted successfully.`);
    setDeletingWo(null);
    setTimeout(() => setBulkToast(null), 4500);
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    for (const id of selectedIds) {
      await cafmDataService.deleteWorkOrder(id);
    }
    const fresh = await cafmDataService.getWorkOrders();
    setWorkOrders(fresh);
    setSelectedIds([]);
    setShowBulkDeleteConfirm(false);
    setBulkToast(`🗑️ Admin Action: ${count} work orders deleted successfully.`);
    setTimeout(() => setBulkToast(null), 4500);
  };

  // Pagination
  const totalPages = Math.ceil(filteredWos.length / itemsPerPage) || 1;
  const paginatedWos = filteredWos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification Banner */}
      {bulkToast && (
        <div className="fixed top-6 right-6 z-50 p-4 bg-slate-900 text-white border border-teal-500 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0" />
          <div className="text-xs font-semibold">{bulkToast}</div>
          <button onClick={() => setBulkToast(null)} className="text-slate-400 hover:text-white text-xs font-bold pl-2">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Reactive Work Orders Ledger
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
              {filteredWos.length} Requests
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time ticket dispatch, SLA deadline countdowns, and corrective job lifecycle
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportWorkOrdersToExcel(filteredWos)}
            className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <Link
            to="/work-orders/new"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </Link>
        </div>
      </div>

      {/* Multi-Parameter Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by WO #, description, building, asset or technician..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="New">New</option>
            <option value="Assigned">Assigned</option>
            <option value="Accepted">Accepted</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Completed">Completed</option>
            <option value="Closed">Closed</option>
            <option value="Overdue">⚠️ Overdue / SLA Breached</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="Emergency">🔴 Emergency</option>
            <option value="High">🟠 High</option>
            <option value="Medium">🟡 Medium</option>
            <option value="Low">🟢 Low</option>
          </select>

          {/* Building Filter */}
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Trade Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Trade Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Bulk Action Bar (when rows are selected) */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-100 flex-wrap gap-2">
            <span className="font-bold text-teal-900 dark:text-teal-200 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping"></span>
              <span>{selectedIds.length} work orders selected for bulk action</span>
            </span>
            <div className="flex items-center space-x-2 flex-wrap">
              <button
                onClick={() => handleBulkStatusChange('In Progress')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-2xs"
              >
                Mark In Progress
              </button>
              <button
                onClick={() => handleBulkStatusChange('Completed')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs"
              >
                Mark Completed
              </button>
              {/* Admin Option to Close Bulk Work Orders */}
              {isAdmin && (
                <button
                  onClick={() => handleBulkStatusChange('Closed')}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-2xs flex items-center space-x-1 border border-teal-500/40"
                >
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                  <span>Bulk Close (Admin)</span>
                </button>
              )}
              {/* Admin Option to Bulk Delete Work Orders */}
              {isAdmin && (
                <button
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-2xs flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Bulk Delete (Admin)</span>
                </button>
              )}
              <button
                onClick={() => setSelectedIds([])}
                className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main DataTable */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 w-8">
                  <button onClick={handleSelectAll} className="flex items-center text-slate-400 hover:text-teal-600">
                    {selectedIds.length === filteredWos.length && filteredWos.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-teal-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">WO Number & Logged Time</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Trade / Category</th>
                <th className="px-4 py-3">Facility Location & Asset</th>
                <th className="px-4 py-3">Problem Description</th>
                <th className="px-4 py-3">Assigned Tech</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedWos.map((wo) => {
                const isSelected = selectedIds.includes(wo.id);
                const isEmergency = wo.priority === 'Emergency';
                const isHigh = wo.priority === 'High';
                return (
                  <tr
                    key={wo.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-teal-50/40 dark:bg-teal-950/20' : ''
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <button onClick={() => handleToggleSelect(wo.id)} className="text-slate-400 hover:text-teal-600">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-teal-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="font-extrabold text-teal-700 dark:text-teal-400 hover:underline block"
                      >
                        {wo.wo_number}
                      </Link>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">
                        🕒 {new Date(wo.created_at).toLocaleDateString()} {new Date(wo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isEmergency
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            : isHigh
                            ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
                            : wo.priority === 'Medium'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {isEmergency && <Flame className="w-3 h-3 mr-1 text-red-600" />}
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {wo.category?.name || 'General'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {wo.building?.name || 'Main Tower'}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">
                        {wo.floor?.name} - {wo.asset?.name || wo.location?.name || 'General Area'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 max-w-xs">
                      <p className="line-clamp-2 leading-relaxed">{wo.problem_description}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                      {wo.assigned_technician?.full_name || (
                        <span className="text-slate-400 dark:text-slate-600 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          wo.status === 'Completed' || wo.status === 'Closed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : wo.status === 'In Progress'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                            : wo.status === 'Pending Approval'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 rounded-lg text-[11px] font-bold transition-colors inline-block"
                      >
                        Manage
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => setDeletingWo(wo)}
                          className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center"
                          title="Delete Work Order (Admin Only)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, filteredWos.length)} of {filteredWos.length} work orders
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 py-1 font-bold text-slate-900 dark:text-slate-100">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Single Delete Confirmation Modal */}
      {deletingWo && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete Work Order
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">{deletingWo.wo_number}</strong>? All associated maintenance history and records for this ticket will be removed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingWo(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSingle}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete Multiple Work Orders
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete all <strong className="text-rose-600">{selectedIds.length}</strong> selected work orders? This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow transition-colors"
              >
                Confirm Bulk Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
