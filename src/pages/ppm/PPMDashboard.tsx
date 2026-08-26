import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  PlusCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Boxes,
  ShieldCheck,
} from 'lucide-react';
import { cafmDataService } from '../../api/supabase';
import { PPMSchedule, PPMPlan } from '../../types';
import { exportPPMToExcel } from '../../utils/excelExporter';

export const PPMDashboard: React.FC = () => {
  const [schedules, setSchedules] = useState<PPMSchedule[]>([]);
  const [plans, setPlans] = useState<PPMPlan[]>([]);
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [scheds, plns] = await Promise.all([
          cafmDataService.getPPMSchedules(),
          cafmDataService.getPPMPlans(),
        ]);
        setSchedules(scheds);
        setPlans(plns);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = schedules.length;
  const completed = schedules.filter((s) => s.status === 'Completed' || s.status === 'Closed').length;
  const overdue = schedules.filter((s) => s.is_overdue || s.status === 'Overdue').length;
  const scheduled = schedules.filter((s) => s.status === 'Scheduled' || s.status === 'Assigned').length;
  const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 94.2;

  // Calendar mock days
  const calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            PPM & Preventive Compliance Command
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automated recurring maintenance cycles, threshold inspection checklists, and SLA compliance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportPPMToExcel(schedules)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export PPM</span>
          </button>
          <Link
            to="/ppm/plans"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Manage PPM Plans</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total PPM Schedules
          </span>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{total}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">{plans.length} active recurring plans</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
            Upcoming / Active
          </span>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-teal-600 dark:text-teal-400">{scheduled}</span>
            <p className="text-[10px] text-slate-400 mt-0.5">Due in the next 30 days</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
            Overdue PPM
          </span>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-red-600 dark:text-red-400">{overdue}</span>
            <p className="text-[10px] text-red-500/80 mt-0.5">Require immediate inspection</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Compliance Rate
          </span>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{complianceRate}%</span>
            <p className="text-[10px] text-slate-400 mt-0.5">+1.8% vs last quarter</p>
          </div>
        </div>
      </div>

      {/* Interactive PPM Calendar Matrix View */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Preventive Maintenance Calendar — August 2026
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-xs font-bold">
              <button
                onClick={() => setCalendarView('month')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  calendarView === 'month'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setCalendarView('week')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  calendarView === 'week'
                    ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </div>

        {/* Month Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-1 text-[11px] font-bold text-slate-400 uppercase">
              {day}
            </div>
          ))}

          {calendarDays.map((d) => {
            const hasTask = d === 15 || d === 24 || d === 28;
            const isOverdue = d === 15;
            return (
              <div
                key={d}
                className={`min-h-[64px] p-1.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                  d === 24
                    ? 'border-teal-500 bg-teal-50/40 dark:bg-teal-950/20'
                    : 'border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-900/40'
                }`}
              >
                <span className={`text-[10px] font-extrabold ${d === 24 ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>
                  {d}
                </span>
                {hasTask && (
                  <div
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold truncate ${
                      isOverdue
                        ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400'
                    }`}
                  >
                    {isOverdue ? 'Overdue PPM' : 'AHU-001 Check'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Preventive Maintenance Schedule Queue
            </h3>
            <p className="text-[11px] text-slate-400">Next scheduled maintenance inspection executions</p>
          </div>
          <Link
            to="/ppm/schedules"
            className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center"
          >
            <span>View All Schedules</span>
            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3">Schedule #</th>
                <th className="px-5 py-3">Plan Title</th>
                <th className="px-5 py-3">Asset Target</th>
                <th className="px-5 py-3">Frequency</th>
                <th className="px-5 py-3">Due Date</th>
                <th className="px-5 py-3">Technician</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-teal-700 dark:text-teal-400">
                    {s.schedule_number}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                    {s.plan?.title || 'Inspection Routine'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {s.plan?.asset?.name || 'Central Equipment'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">{s.plan?.frequency || 'Monthly'}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100">{s.due_date}</td>
                  <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                    {s.assigned_technician?.full_name || 'Unassigned'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
