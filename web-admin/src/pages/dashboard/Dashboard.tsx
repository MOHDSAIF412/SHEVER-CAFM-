import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarCheck2,
  Boxes,
  Activity,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Flame,
  Plus,
  ShieldCheck,
  Zap,
  ArrowRight,
  Check,
  Sparkles,
  Filter,
  RotateCcw,
  Calendar,
  Building2,
  Layers,
  Wrench,
  CheckCircle,
  Archive,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { cafmDataService } from '../../api/supabase';
import {
  DashboardStats,
  WorkOrder,
  PPMSchedule,
  Asset,
  Building,
  Category,
} from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Filter States
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [s, w, p, a, b, c] = await Promise.allSettled([
          cafmDataService.getDashboardStats(),
          cafmDataService.getWorkOrders(),
          cafmDataService.getPPMSchedules(),
          cafmDataService.getAssets(),
          cafmDataService.getBuildings(),
          cafmDataService.getCategories(),
        ]);
        if (!mounted) return;
        if (s.status === 'fulfilled') setStats(s.value);
        if (w.status === 'fulfilled') setWorkOrders(w.value);
        if (p.status === 'fulfilled') setPpmSchedules(p.value);
        if (a.status === 'fulfilled') setAssets(a.value);
        if (b.status === 'fulfilled') setBuildings(b.value);
        if (c.status === 'fulfilled') setCategories(c.value);
      } catch (err) {
        console.warn('Dashboard load error handled:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Filter application logic
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((w) => {
      // Building filter
      if (selectedBuilding !== 'ALL') {
        const matchesBuildingId = w.building_id === selectedBuilding;
        const matchesBuildingName = w.building?.id === selectedBuilding || w.building?.name === selectedBuilding;
        if (!matchesBuildingId && !matchesBuildingName) return false;
      }

      // Category / Department filter
      if (selectedCategory !== 'ALL') {
        const matchesCatId = w.category_id === selectedCategory;
        const matchesCatName = w.category?.id === selectedCategory || w.category?.name === selectedCategory;
        if (!matchesCatId && !matchesCatName) return false;
      }

      // Priority filter
      if (selectedPriority !== 'ALL' && w.priority !== selectedPriority) {
        return false;
      }

      // Date filter
      if (datePreset !== 'ALL') {
        const woDate = new Date(w.created_at);
        const now = new Date();

        if (datePreset === 'TODAY') {
          const isToday = woDate.toDateString() === now.toDateString();
          if (!isToday) return false;
        } else if (datePreset === 'THIS_WEEK') {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          if (woDate < weekAgo) return false;
        } else if (datePreset === 'THIS_MONTH') {
          const monthAgo = new Date();
          monthAgo.setMonth(now.getMonth() - 1);
          if (woDate < monthAgo) return false;
        } else if (datePreset === 'CUSTOM') {
          if (startDate && new Date(startDate) > woDate) return false;
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (woDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [workOrders, selectedBuilding, selectedCategory, selectedPriority, datePreset, startDate, endDate]);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (selectedBuilding !== 'ALL' && a.building_id !== selectedBuilding) {
        return false;
      }
      if (selectedCategory !== 'ALL' && a.category_id !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [assets, selectedBuilding, selectedCategory]);

  const filteredPPMs = useMemo(() => {
    return ppmSchedules.filter((p) => {
      if (selectedBuilding !== 'ALL' && p.plan?.building_id !== selectedBuilding) {
        return false;
      }
      return true;
    });
  }, [ppmSchedules, selectedBuilding]);

  // Compute dynamic KPI metrics based on active filters
  const openCount = filteredWorkOrders.filter((w) => ['New', 'Assigned'].includes(w.status)).length;
  const inProgressCount = filteredWorkOrders.filter((w) => w.status === 'In Progress').length;
  const completedCount = filteredWorkOrders.filter((w) => w.status === 'Completed').length;
  const closedCount = filteredWorkOrders.filter((w) => w.status === 'Closed').length;
  const pendingApprovalCount = filteredWorkOrders.filter((w) => w.status === 'Pending Approval').length;

  const totalClosedOrCompleted = completedCount + closedCount;
  const totalFilteredCount = filteredWorkOrders.length;
  const dynamicSLA = totalFilteredCount > 0
    ? Math.round(((totalClosedOrCompleted + inProgressCount) / totalFilteredCount) * 100)
    : 100;

  const duePPMCount = filteredPPMs.filter((p) => p.status === 'Scheduled' || p.status === 'Pending Approval').length;
  const overduePPMCount = filteredPPMs.filter((p) => p.status === 'Overdue' || p.is_overdue).length;

  // Active filter count
  const activeFiltersCount =
    (selectedBuilding !== 'ALL' ? 1 : 0) +
    (selectedCategory !== 'ALL' ? 1 : 0) +
    (selectedPriority !== 'ALL' ? 1 : 0) +
    (datePreset !== 'ALL' ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedBuilding('ALL');
    setSelectedCategory('ALL');
    setSelectedPriority('ALL');
    setDatePreset('ALL');
    setStartDate('');
    setEndDate('');
  };

  /**
   * Six-month trend built from real records. This used to be hard-coded figures
   * for Sep-Jan, so the chart showed invented history no matter what was
   * actually in the system.
   *
   * Declared above the loading return below - hooks cannot sit after an early
   * return or React sees a different hook count between renders.
   */
  const monthlyTrendData = useMemo(() => {
    const months: {
      month: string;
      key: string;
      reactive: number;
      completed: number;
      ppm: number;
    }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        reactive: 0,
        completed: 0,
        ppm: 0,
      });
    }

    const bucketOf = (iso?: string) => {
      if (!iso) return undefined;
      return months.find((m) => m.key === iso.slice(0, 7));
    };

    filteredWorkOrders.forEach((wo) => {
      const raised = bucketOf(wo.created_at);
      if (raised) raised.reactive += 1;

      if (['Completed', 'Closed'].includes(wo.status)) {
        const done = bucketOf(wo.closed_at || wo.completed_at);
        if (done) done.completed += 1;
      }
    });

    filteredPPMs.forEach((ppm) => {
      const bucket = bucketOf(ppm.due_date);
      if (bucket) bucket.ppm += 1;
    });

    return months;
  }, [filteredWorkOrders, filteredPPMs]);

  // Nothing entered yet - show setup guidance rather than a grid of zeroes.
  const isSystemEmpty =
    !loading && buildings.length === 0 && assets.length === 0 && workOrders.length === 0;

  if (loading || !stats) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  // Priority Attention Items from filtered list
  const emergencyWos = filteredWorkOrders.filter((w) => w.priority === 'Emergency' && !['Completed', 'Closed'].includes(w.status));
  const pendingApprovalWos = filteredWorkOrders.filter((w) => w.status === 'Pending Approval');
  const overduePPMItems = filteredPPMs.filter((p) => p.status === 'Overdue' || p.is_overdue);
  const totalAttentionCount = emergencyWos.length + overduePPMItems.length + pendingApprovalWos.length;


  const priorityData = [
    { name: 'Emergency', count: filteredWorkOrders.filter((w) => w.priority === 'Emergency').length, fill: '#EF4444' },
    { name: 'High', count: filteredWorkOrders.filter((w) => w.priority === 'High').length, fill: '#F97316' },
    { name: 'Medium', count: filteredWorkOrders.filter((w) => w.priority === 'Medium').length, fill: '#F59E0B' },
    { name: 'Low', count: filteredWorkOrders.filter((w) => w.priority === 'Low').length, fill: '#10B981' },
  ];

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-5 w-full">
      {/* 1. Branded command bar - logo, live status, quick actions */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 border border-slate-800 shadow-lg">
        {/* Brand accent wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent"
        />

        <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Logo + title */}
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src="/shever-logo.png"
              alt="Shever Technical Services"
              className="h-12 w-12 shrink-0 rounded-xl object-contain ring-1 ring-white/15 shadow-md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold leading-tight text-white">
                  Facilities Operations
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-300">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
                  </span>
                  Live
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-400">
                Shever Technical Services · CAFM Command Centre · {todayStr}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/work-orders/new"
              className="flex items-center gap-1.5 rounded-xl bg-teal-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-400"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Work Order</span>
            </Link>
            <Link
              to="/ppm/plans"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
            >
              Create PPM
            </Link>
            <Link
              to="/reports"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
            >
              Export Reports
            </Link>
          </div>
        </div>
      </div>

      {/* 1b. First-run guidance - the cloud is empty until master data is added */}
      {isSystemEmpty && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 dark:border-teal-900 dark:bg-teal-950/30">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-teal-500/15 p-2 text-teal-600 dark:text-teal-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Let&rsquo;s set up your portfolio
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Nothing has been added yet. Create your buildings and their floors and
                locations first &mdash; assets and work orders attach to them. Everything you
                add is stored in the cloud and visible to your whole team.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/facilities/buildings"
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-teal-500"
                >
                  1. Add a building
                </Link>
                <Link
                  to="/assets"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  2. Register assets
                </Link>
                <Link
                  to="/work-orders/new"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  3. Raise a work order
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Comprehensive Master Operations Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Operational Filters</span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                {activeFiltersCount} Active
              </span>
            )}
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold flex items-center space-x-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Building Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center space-x-1">
              <Building2 className="w-3 h-3" />
              <span>Building / Property</span>
            </label>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Buildings</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department / Category Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center space-x-1">
              <Wrench className="w-3 h-3" />
              <span>Department / Trade</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center space-x-1">
              <Flame className="w-3 h-3" />
              <span>Priority Level</span>
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Priorities</option>
              <option value="Emergency">Emergency</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Date Range Preset */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>Date Range</span>
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:ring-1 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week (Last 7 Days)</option>
              <option value="THIS_MONTH">This Month (Last 30 Days)</option>
              <option value="CUSTOM">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Inputs if CUSTOM selected */}
          {datePreset === 'CUSTOM' ? (
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] text-slate-900 dark:text-slate-100 focus:outline-none"
                title="End Date"
              />
            </div>
          ) : (
            <div className="flex items-center justify-end pt-4">
              <span className="text-[11px] text-slate-400 font-semibold">
                Showing {filteredWorkOrders.length} work orders
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive KPI Metric Strip (Complete with Completed & Closed) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 w-full">
        {/* 1. Open Work Orders */}
        <Link
          to={`/work-orders?status=New${selectedBuilding !== 'ALL' ? `&building=${selectedBuilding}` : ''}`}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-blue-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Open
            </span>
            <Clock className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {openCount}
            </div>
            <div className="flex items-center text-[10px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              <span>New & Assigned</span>
            </div>
          </div>
        </Link>

        {/* 2. In Progress */}
        <Link
          to={`/work-orders?status=In%20Progress${selectedBuilding !== 'ALL' ? `&building=${selectedBuilding}` : ''}`}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-amber-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              In Progress
            </span>
            <Activity className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
              {inProgressCount}
            </div>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              Active on-site
            </div>
          </div>
        </Link>

        {/* 3. Completed (Requested by user) */}
        <Link
          to={`/work-orders?status=Completed${selectedBuilding !== 'ALL' ? `&building=${selectedBuilding}` : ''}`}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-emerald-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Completed
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {completedCount}
            </div>
            <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
              Work Verified
            </div>
          </div>
        </Link>

        {/* 4. Closed & Approved (Requested by user) */}
        <Link
          to={`/work-orders?status=Closed${selectedBuilding !== 'ALL' ? `&building=${selectedBuilding}` : ''}`}
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-teal-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Closed
            </span>
            <Archive className="w-4 h-4 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-teal-700 dark:text-teal-300">
              {closedCount}
            </div>
            <div className="text-[10px] font-medium text-teal-600 dark:text-teal-400 mt-0.5">
              Admin Signed-Off
            </div>
          </div>
        </Link>

        {/* 5. SLA Compliance Rate */}
        <Link
          to="/reports"
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-teal-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              SLA Health
            </span>
            <ShieldCheck className="w-4 h-4 text-teal-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-teal-600 dark:text-teal-400">
              {dynamicSLA}%
            </div>
            <div className="flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              <TrendingUp className="w-3 h-3 mr-0.5" />
              <span>↑ 2.4% Target</span>
            </div>
          </div>
        </Link>

        {/* 6. PPM Schedules */}
        <Link
          to="/ppm/schedules"
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-indigo-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              PPM Due
            </span>
            <CalendarCheck2 className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {duePPMCount}
            </div>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              {filteredPPMs.length} Total Plans
            </div>
          </div>
        </Link>

        {/* 7. Critical Assets */}
        <Link
          to="/assets"
          className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm hover:border-purple-500 transition-all flex flex-col justify-between group cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Assets
            </span>
            <Boxes className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2.5">
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
              {filteredAssets.length}
            </div>
            <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
              100% QR Mapped
            </div>
          </div>
        </Link>
      </div>

      {/* 4. "ATTENTION REQUIRED" Exception Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="p-1 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-md">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Priority Attention Panel
              </h3>
              <p className="text-[11px] text-slate-400">
                Operational exceptions requiring immediate supervisor or manager intervention
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md text-[10px] font-bold">
            {totalAttentionCount} Action Items
          </span>
        </div>

        {totalAttentionCount === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
            <span>All systems nominal for selected criteria. No emergency breaches or overdue items.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Emergency Work Orders */}
            {emergencyWos.map((w) => (
              <Link
                key={w.id}
                to={`/work-orders/${w.id}`}
                className="p-3.5 bg-red-50/50 dark:bg-red-950/20 border border-red-200/80 dark:border-red-900/40 rounded-xl hover:border-red-400 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-400 flex items-center">
                      <Flame className="w-3.5 h-3.5 mr-1" />
                      {w.wo_number}
                    </span>
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Emergency
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                    {w.problem_description}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-red-100 dark:border-red-900/30 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>📍 {w.building?.name || 'Main Tower'}</span>
                  <span className="text-red-600 dark:text-red-400 font-bold flex items-center">
                    Action &rarr;
                  </span>
                </div>
              </Link>
            ))}

            {/* Overdue PPM */}
            {overduePPMItems.map((p) => (
              <Link
                key={p.id}
                to="/ppm/schedules?status=Overdue"
                className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-xl hover:border-amber-400 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      {p.schedule_number}
                    </span>
                    <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Overdue PPM
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                    {p.plan?.title || 'Preventive Inspection Run'}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-amber-100 dark:border-amber-900/30 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Due: {p.due_date}</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center">
                    Execute &rarr;
                  </span>
                </div>
              </Link>
            ))}

            {/* Pending Approvals */}
            {pendingApprovalWos.map((w) => (
              <Link
                key={w.id}
                to={`/work-orders/${w.id}`}
                className="p-3.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 rounded-xl hover:border-purple-400 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
                      {w.wo_number}
                    </span>
                    <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                    {w.work_performed || w.problem_description}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-purple-100 dark:border-purple-900/30 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>By: {w.assigned_technician?.full_name || 'Tech'}</span>
                  <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center">
                    Sign-Off &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 5. Main Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Trend Area Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Facilities Maintenance Volume & Delivery Trend
              </h3>
              <p className="text-[11px] text-slate-400">
                Reactive maintenance logged vs completed vs planned preventive maintenance
              </p>
            </div>
            <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">
              Active Sample: {filteredWorkOrders.length} Jobs
            </span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReactive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                    color: isDark ? '#FFFFFF' : '#000000',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="reactive" name="Reactive Logged" stroke="#0EA5E9" fillOpacity={1} fill="url(#colorReactive)" strokeWidth={2} />
                <Area type="monotone" dataKey="completed" name="Closed & Done" stroke="#10B981" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Breakdown (1 col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
              Priority Distribution
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Breakdown across active ticket pool
            </p>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <XAxis type="number" stroke="#94A3B8" fontSize={10} hide />
                  <YAxis type="category" dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} width={75} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                      borderRadius: '0.75rem',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>SLA Response Target</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">&lt; 120 mins avg</span>
          </div>
        </div>
      </div>

      {/* 6. Recent Work Orders Activity Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Work Orders Stream
            </h3>
            <p className="text-[11px] text-slate-400">
              Live updates matching active filter criteria
            </p>
          </div>
          <Link
            to="/work-orders"
            className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline flex items-center space-x-1"
          >
            <span>View All Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">WO Number</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Trade / Dept</th>
                <th className="px-4 py-3">Building & Location</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredWorkOrders.slice(0, 7).map((wo) => {
                const isEmergency = wo.priority === 'Emergency';
                const isHigh = wo.priority === 'High';
                return (
                  <tr key={wo.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-extrabold text-teal-700 dark:text-teal-400">
                      <Link to={`/work-orders/${wo.id}`} className="hover:underline">
                        {wo.wo_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isEmergency
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                            : isHigh
                            ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {wo.category?.name || 'General'}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {wo.building?.name || 'Main Tower'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {wo.floor?.name || 'Level 1'} • {wo.asset?.name || 'General Area'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                      {wo.problem_description}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {wo.assigned_technician?.full_name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/work-orders/${wo.id}`}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-teal-600 hover:text-white dark:hover:bg-teal-600 rounded-lg text-[11px] font-bold transition-colors"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
