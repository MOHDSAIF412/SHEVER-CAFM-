import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Play,
  Check,
  X,
  FileCheck2,
  Gauge,
  Zap,
  Wrench,
  Shield,
  Layers,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { PPMSchedule, PPMChecklistItem } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const PPMSchedulesList: React.FC = () => {
  const { isAdmin, isManager } = useAuth();
  const [searchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<PPMSchedule[]>([]);
  const [filtered, setFiltered] = useState<PPMSchedule[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'ALL');
  const [loading, setLoading] = useState(true);
  const [deletingSched, setDeletingSched] = useState<PPMSchedule | null>(null);

  // Selected schedule for checklist inspection modal
  const [selectedSchedule, setSelectedSchedule] = useState<PPMSchedule | null>(null);
  const [checklistItems, setChecklistItems] = useState<Record<string, { status: string; value?: string }>>({});

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setStatusFilter(s);
  }, [searchParams]);

  useEffect(() => {
    cafmDataService.getPPMSchedules().then((data) => {
      setSchedules(data);
      setFiltered(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    let list = [...schedules];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.schedule_number.toLowerCase().includes(q) ||
          s.plan?.title?.toLowerCase().includes(q) ||
          s.plan?.asset?.name?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'Overdue') {
        list = list.filter((s) => s.is_overdue || s.status === 'Overdue');
      } else {
        list = list.filter((s) => s.status === statusFilter);
      }
    }
    setFiltered(list);
  }, [search, statusFilter, schedules]);

  const handleOpenInspection = (sched: PPMSchedule) => {
    setSelectedSchedule(sched);
    // Initialize standard inspection tasks
    setChecklistItems({
      item1: { status: 'Pass' },
      item2: { status: 'Pass', value: '18.5' },
      item3: { status: 'Pass', value: '24.2' },
      item4: { status: 'Pass' },
    });
  };

  const handleCompleteInspection = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: 'Completed', is_overdue: false } : s
      )
    );
    setSelectedSchedule(null);
  };

  const handleDeleteSchedule = async () => {
    if (!deletingSched) return;
    await cafmDataService.deletePPMSchedule(deletingSched.id);
    setSchedules((prev) => prev.filter((s) => s.id !== deletingSched.id));
    setDeletingSched(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          PPM Maintenance Schedules & Inspections
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Execute planned inspection forms, verify mechanical & electrical thresholds, and record sign-offs
        </p>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search PPM #, task title, asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48 py-2 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Schedules Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Schedule #</th>
                <th className="px-5 py-3.5">Plan Title</th>
                <th className="px-5 py-3.5">Asset Target</th>
                <th className="px-5 py-3.5">Frequency</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Assigned Tech</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-4 font-bold text-teal-700 dark:text-teal-400">
                    {s.schedule_number}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200">
                    {s.plan?.title || 'Preventive Routine'}
                  </td>
                  <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {s.plan?.asset?.name || 'Central Equipment'}
                    </span>
                    <span className="text-[11px] text-slate-400 block">{s.plan?.building?.name}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400">{s.plan?.frequency || 'Monthly'}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">{s.due_date}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-400">
                    {s.assigned_technician?.full_name || 'Unassigned'}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                        s.is_overdue || s.status === 'Overdue'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                          : s.status === 'Completed'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                    {s.status === 'Completed' ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center">
                        <Check className="w-3.5 h-3.5 mr-1" /> Approved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleOpenInspection(s)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[11px] font-bold transition-colors shadow-2xs inline-block"
                      >
                        Inspect & Sign
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => setDeletingSched(s)}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors inline-flex items-center"
                        title="Delete PPM Schedule (Admin Only)"
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

      {/* Categorized Inspection Form Modal */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center space-x-2">
                  <FileCheck2 className="w-4 h-4 text-teal-600" />
                  <span>{selectedSchedule.schedule_number} — Inspection Form</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Target: {selectedSchedule.plan?.asset?.name} • Frequency: {selectedSchedule.plan?.frequency}
                </p>
              </div>
              <button
                onClick={() => setSelectedSchedule(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Checklist Sections */}
            <div className="space-y-4 text-xs">
              {/* Mechanical Section */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5 uppercase tracking-wider text-[10px] text-teal-600 dark:text-teal-400">
                  <Wrench className="w-3.5 h-3.5" />
                  <span>1. Mechanical Subsystem Inspection</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">1.1 Check drive belt alignment and tension</span>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-bold text-[10px]">
                      PASS
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">1.2 Bearing vibration amplitude (mm/s)</span>
                  <input
                    type="number"
                    defaultValue="2.4"
                    className="w-24 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
                  />
                </div>
              </div>

              {/* Electrical Section */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5 uppercase tracking-wider text-[10px] text-indigo-600 dark:text-indigo-400">
                  <Zap className="w-3.5 h-3.5" />
                  <span>2. Electrical & Telemetry</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">2.1 Supply Voltage reading (V AC)</span>
                  <input
                    type="number"
                    defaultValue="415"
                    className="w-24 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">2.2 Motor Full Load Current (Amps)</span>
                  <input
                    type="number"
                    defaultValue="24.2"
                    className="w-24 p-1 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold"
                  />
                </div>
              </div>

              {/* Safety & Cleanliness */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5 uppercase tracking-wider text-[10px] text-emerald-600 dark:text-emerald-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>3. Environmental Safety & Strainers</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 dark:text-slate-200">3.1 Clean primary air filter media</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-bold text-[10px]">
                    COMPLETED
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCompleteInspection(selectedSchedule.id)}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs shadow transition-colors"
              >
                Sign & Approve Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSched && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Delete PPM Schedule
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete scheduled PPM task <strong className="text-slate-900 dark:text-white">{deletingSched.schedule_number}</strong> for asset <strong className="text-slate-900 dark:text-white">{deletingSched.plan?.asset?.name || 'Equipment'}</strong>?
            </p>
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingSched(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
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
