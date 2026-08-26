import React, { useEffect, useState } from 'react';
import {
  CalendarCheck2,
  Plus,
  Search,
  CheckCircle2,
  Boxes,
  MapPin,
  Clock,
  FileCheck2,
  Trash2,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import {
  PPMPlan,
  Asset,
  Building,
  Floor,
  Location,
  Category,
  UserProfile,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

export const PPMPlansList: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const [plans, setPlans] = useState<PPMPlan[]>([]);
  const [filtered, setFiltered] = useState<PPMPlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [supervisors, setSupervisors] = useState<UserProfile[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<PPMPlan | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [frequency, setFrequency] = useState<PPMPlan['frequency']>('Monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedTechId, setAssignedTechId] = useState('');
  const [assignedSupId, setAssignedSupId] = useState('');

  const loadData = async () => {
    try {
      const [p, a, b, c, t, s] = await Promise.all([
        cafmDataService.getPPMPlans(),
        cafmDataService.getAssets(),
        cafmDataService.getBuildings(),
        cafmDataService.getCategories(),
        cafmDataService.getTechnicians(),
        cafmDataService.getSupervisors(),
      ]);
      setPlans(p);
      setFiltered(p);
      setAssets(a);
      setBuildings(b);
      setCategories(c);
      setTechnicians(t);
      setSupervisors(s);

      if (a.length > 0) setSelectedAssetId(a[0].id);
      if (b.length > 0) setSelectedBuildingId(b[0].id);
      if (c.length > 0) setSelectedCategoryId(c[0].id);
      if (t.length > 0) setAssignedTechId(t[0].id);
      if (s.length > 0) setAssignedSupId(s[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let list = [...plans];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.ppm_code.toLowerCase().includes(q) ||
          p.frequency.toLowerCase().includes(q) ||
          p.asset?.name.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [search, plans]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await cafmDataService.createPPMPlan({
        title,
        asset_id: selectedAssetId,
        building_id: selectedBuildingId,
        category_id: selectedCategoryId,
        frequency,
        start_date: startDate,
        assigned_technician_id: assignedTechId,
        assigned_supervisor_id: assignedSupId,
      });
      setShowCreateModal(false);
      setTitle('');
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletingPlan) return;
    await cafmDataService.deletePPMPlan(deletingPlan.id);
    setPlans((prev) => prev.filter((p) => p.id !== deletingPlan.id));
    setDeletingPlan(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">PPM Preventive Maintenance Plans</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Recurring maintenance master policies, asset service intervals, and SLA checklists
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New PPM Plan</span>
          </button>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by plan code, title, frequency, or asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((plan) => (
          <div
            key={plan.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm hover:border-teal-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                  {plan.frequency}
                </span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                    {plan.ppm_code}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setDeletingPlan(plan)}
                      className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center"
                      title="Delete PPM Plan (Admin Only)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{plan.title}</h3>

              <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Boxes className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{plan.asset?.name || 'General Equipment'}</span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{plan.building?.name || 'Main Tower'}</span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Next Due: <strong className="text-teal-600 dark:text-teal-400">{plan.next_due_date}</strong></span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active Policy
              </span>
              <span className="text-slate-400 text-[11px]">
                {plan.assigned_technician?.full_name || 'Assigned Tech'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create PPM Plan Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-teal-600" />
                <span>Create New PPM Maintenance Plan</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Plan Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Quarterly Comprehensive Chiller Tube & Vibration Inspection"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Asset *</label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.asset_number} — {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Building *</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => setSelectedBuildingId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recurrence Frequency *</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Technician</label>
                  <select
                    value={assignedTechId}
                    onChange={(e) => setAssignedTechId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Supervisor</label>
                  <select
                    value={assignedSupId}
                    onChange={(e) => setAssignedSupId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl shadow transition-colors"
                >
                  {submitting ? 'Generating Plan...' : 'Save & Schedule PPM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete PPM Plan Confirmation Modal */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete PPM Plan Policy
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete PPM policy <strong className="text-slate-900 dark:text-white">{deletingPlan.ppm_code} — {deletingPlan.title}</strong>? All future recurring schedule tasks associated with this plan will also be removed.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingPlan(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePlan}
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
