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
  ChevronDown,
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
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { cafmDataService } from '../../api/supabase';
import { getSlaStatus } from '../../utils/sla';
import {
  DashboardStats,
  WorkOrder,
  PPMSchedule,
  Asset,
  Building,
  Category,
  SLAConfig,
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
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
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
        const [s, w, p, a, b, c, sla] = await Promise.allSettled([
          cafmDataService.getDashboardStats(),
          cafmDataService.getWorkOrders(),
          cafmDataService.getPPMSchedules(),
          cafmDataService.getAssets(),
          cafmDataService.getBuildings(),
          cafmDataService.getCategories(),
          cafmDataService.getSlaConfigs(),
        ]);
        if (!mounted) return;
        if (s.status === 'fulfilled') setStats(s.value);
        if (w.status === 'fulfilled') setWorkOrders(w.value);
        if (p.status === 'fulfilled') setPpmSchedules(p.value);
        if (a.status === 'fulfilled') setAssets(a.value);
        if (b.status === 'fulfilled') setBuildings(b.value);
        if (c.status === 'fulfilled') setCategories(c.value);
        if (sla.status === 'fulfilled') setSlaConfigs(sla.value);
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

  /**
   * SLA compliance = of the jobs actually finished, how many beat their
   * deadline. The old formula counted in-progress work as compliant and
   * divided by every work order, which reported a healthy number for a
   * backlog nobody had touched.
   */
  const resolvedWos = filteredWorkOrders.filter((w) =>
    ['Completed', 'Closed'].includes(w.status)
  );
  const metSlaCount = resolvedWos.filter((w) => {
    const finished = w.closed_at || w.completed_at;
    if (!w.resolution_due_at || !finished) return !w.is_overdue;
    return new Date(finished) <= new Date(w.resolution_due_at);
  }).length;
  const dynamicSLA =
    resolvedWos.length > 0 ? Math.round((metSlaCount / resolvedWos.length) * 100) : 0;

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

  /**
   * Real response targets, shown as a range. The panel used to state
   * "< 120 mins avg", a fixed string matching none of the configured values.
   */
  const slaTargetSummary = useMemo(() => {
    const mins = slaConfigs.map((c) => c.response_time_minutes).filter((n) => Number.isFinite(n));
    if (mins.length === 0) return 'Not configured';
    const lo = Math.min(...mins);
    const hi = Math.max(...mins);
    return lo === hi ? `${lo} mins` : `${lo}–${hi} mins by priority`;
  }, [slaConfigs]);

  // Open work orders whose resolution deadline has already passed. Measured
  // from resolution_due_at rather than trusting the stored is_overdue flag,
  // which only updates when something writes to the row.
  const breachedCount = useMemo(
    () => filteredWorkOrders.filter((w) => getSlaStatus(w).state === 'breached').length,
    [filteredWorkOrders]
  );

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

      {/* 2. Filters - one compact row.
             This was a full-width card with a heading, a divider, labelled
             columns and its own reset row: a lot of vertical space for four
             dropdowns that are rarely touched. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/70 bg-white/70 p-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70">
        <Filter className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-400" />

        {[
          {
            value: selectedBuilding,
            onChange: setSelectedBuilding,
            all: 'All buildings',
            options: buildings.map((b) => ({ id: b.id, label: b.name })),
          },
          {
            value: selectedCategory,
            onChange: setSelectedCategory,
            all: 'All trades',
            options: categories.map((c) => ({ id: c.id, label: c.name })),
          },
          {
            value: selectedPriority,
            onChange: setSelectedPriority,
            all: 'All priorities',
            options: ['Emergency', 'High', 'Medium', 'Low'].map((p) => ({ id: p, label: p })),
          },
          {
            value: datePreset,
            onChange: setDatePreset,
            all: 'All time',
            options: [
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_WEEK', label: 'Last 7 days' },
              { id: 'THIS_MONTH', label: 'Last 30 days' },
            ],
          },
        ].map((f, i) => {
          const active = f.value !== 'ALL';
          return (
            /* The highlight lives on this wrapper, not the <select>. A native
               select is painted by the browser, so border and background
               utilities on the element itself do not reliably take effect. */
            <div
              key={i}
              className={`relative min-w-0 flex-1 rounded-lg border transition-colors sm:flex-none ${
                active
                  ? 'border-teal-400 bg-teal-50 dark:border-teal-600 dark:bg-teal-950/40'
                  : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                aria-label={f.all}
                className={`w-full cursor-pointer appearance-none bg-transparent py-1.5 pl-2.5 pr-7 text-xs font-medium focus:outline-none ${
                  active
                    ? 'text-teal-800 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <option value="ALL">{f.all}</option>
                {f.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={`pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 ${
                  active ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'
                }`}
              />
            </div>
          );
        })}

        {activeFiltersCount > 0 && (
          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}

        <span className="ml-auto pr-1 text-[11px] font-medium text-slate-400">
          {totalFilteredCount} work order{totalFilteredCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* 3. Metrics bento.
             Previously four equal tiles above four more equal tiles - eight
             identical rectangles in a row, with nothing to look at first.
             Varying the sizes gives the eye somewhere to land. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">

        {/* ---- Workload: the headline panel ------------------------------ */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-3 dark:border-slate-800 dark:bg-slate-900">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-teal-500/10 blur-2xl"
          />
          <div className="relative">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live workload
              </h3>
              <Link
                to="/work-orders"
                className="text-[11px] font-semibold text-teal-600 hover:underline dark:text-teal-400"
              >
                View all
              </Link>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
              {[
                { n: openCount, label: 'Open', tone: 'text-blue-600 dark:text-blue-400' },
                { n: inProgressCount, label: 'In progress', tone: 'text-amber-600 dark:text-amber-400' },
                { n: totalClosedOrCompleted, label: 'Resolved', tone: 'text-teal-600 dark:text-teal-400' },
              ].map((m) => (
                <div key={m.label}>
                  <p className={`text-4xl font-bold leading-none tracking-tight ${m.tone}`}>{m.n}</p>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {m.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Mix bar - proportions at a glance, no legend needed */}
            <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {totalFilteredCount === 0 ? (
                <div className="w-full bg-slate-200 dark:bg-slate-800" />
              ) : (
                [
                  { n: openCount, cls: 'bg-blue-500' },
                  { n: inProgressCount, cls: 'bg-amber-500' },
                  { n: totalClosedOrCompleted, cls: 'bg-teal-500' },
                ].map((seg, i) => (
                  <div
                    key={i}
                    className={seg.cls}
                    style={{ width: `${(seg.n / totalFilteredCount) * 100}%` }}
                  />
                ))
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {totalFilteredCount} work order{totalFilteredCount === 1 ? '' : 's'} in view
            </p>
          </div>
        </div>

        {/* ---- SLA compliance dial --------------------------------------- */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            SLA compliance
          </h3>

          <div className="mt-1 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  innerRadius="72%"
                  outerRadius="100%"
                  data={[{ value: resolvedWos.length ? dynamicSLA : 0 }]}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar
                    background={{ fill: isDark ? '#1e293b' : '#e2e8f0' }}
                    dataKey="value"
                    cornerRadius={9}
                    fill={dynamicSLA >= 90 ? '#10b981' : dynamicSLA >= 70 ? '#f59e0b' : '#f43f5e'}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold leading-none text-slate-900 dark:text-white">
                  {resolvedWos.length ? `${dynamicSLA}%` : '—'}
                </span>
              </div>
            </div>

            <div className="min-w-0 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {resolvedWos.length ? (
                <>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {metSlaCount} of {resolvedWos.length}
                  </span>{' '}
                  finished jobs beat their deadline.
                </>
              ) : (
                'Nothing resolved yet, so there is nothing to measure.'
              )}
              <span className="mt-2 block text-slate-400">Targets {slaTargetSummary}</span>
            </div>
          </div>
        </div>

        {/* ---- Exceptions + PPM, stacked --------------------------------- */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-1 lg:grid-cols-1">
          <Link
            to="/work-orders"
            className={`rounded-2xl border p-4 shadow-sm transition-colors ${
              breachedCount
                ? 'border-rose-300 bg-rose-50 hover:border-rose-400 dark:border-rose-900 dark:bg-rose-950/30'
                : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Past SLA
              </span>
              <AlertTriangle
                className={`h-3.5 w-3.5 ${
                  breachedCount ? 'text-rose-500' : 'text-slate-300 dark:text-slate-600'
                }`}
              />
            </div>
            <p
              className={`mt-2 text-2xl font-bold leading-none ${
                breachedCount ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {breachedCount}
            </p>
          </Link>

          <Link
            to="/ppm/schedules"
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                PPM due
              </span>
              <CalendarCheck2 className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <p className="mt-2 text-2xl font-bold leading-none text-violet-600 dark:text-violet-400">
              {duePPMCount}
            </p>
          </Link>
        </div>
      </div>

      {/* Portfolio strip - the slow-moving totals, kept visually light */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Assets', value: filteredAssets.length, to: '/assets', Icon: Boxes, tone: 'text-sky-500' },
          { label: 'Buildings', value: buildings.length, to: '/facilities/buildings', Icon: Building2, tone: 'text-teal-500' },
          { label: 'Completed', value: completedCount, to: '/work-orders?status=Completed', Icon: CheckCircle2, tone: 'text-emerald-500' },
          { label: 'Closed', value: closedCount, to: '/work-orders?status=Closed', Icon: Archive, tone: 'text-slate-400' },
        ].map(({ label, value, to, Icon, tone }) => (
          <Link
            key={label}
            to={to}
            className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 transition-colors hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900"
          >
            <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none text-slate-900 dark:text-white">{value}</p>
              <p className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* 4. Exceptions needing a supervisor.
             When there is nothing wrong this used to render a full card with a
             heading, a divider and a large centred tick - roughly 200px to say
             "no news". It now collapses to a single line. */}
      {totalAttentionCount === 0 ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            Nothing needs attention &mdash; no emergencies, SLA breaches or overdue PPM.
          </p>
        </div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-rose-200/70 bg-white shadow-sm dark:border-rose-900/40 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-rose-100 bg-rose-50/60 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-rose-100 p-1.5 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Needs Attention
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Exceptions requiring a supervisor or manager
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
            {totalAttentionCount}
          </span>
        </div>

        <div className="p-4">

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
        </div>
      </div>
      )}

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
            {/* This read "< 120 mins avg", which was hard-coded and matched
                none of the configured targets. Shows the real range now. */}
            <span>Response targets</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {slaTargetSummary}
            </span>
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
