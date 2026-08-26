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
  RefreshCw,
  Megaphone,
  FileSpreadsheet,
  Users,
  Gauge,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { cafmDataService } from '../../api/supabase';
import { getSlaStatus } from '../../utils/sla';
import { StatusFilterBar } from '../../components/StatusFilterBar';
import {
  DashboardStats,
  WorkOrder,
  PPMSchedule,
  Asset,
  Building,
  Category,
  SLAConfig,
  WorkOrderStatus,
  AuditLog,
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [lastUpdated] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  // Master Filter States
  const [selectedBuilding, setSelectedBuilding] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<WorkOrderStatus | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [s, w, p, a, b, c, sla, logs] = await Promise.allSettled([
          cafmDataService.getDashboardStats(),
          cafmDataService.getWorkOrders(),
          cafmDataService.getPPMSchedules(),
          cafmDataService.getAssets(),
          cafmDataService.getBuildings(),
          cafmDataService.getCategories(),
          cafmDataService.getSlaConfigs(),
          cafmDataService.getAuditLogs(),
        ]);
        if (!mounted) return;
        if (s.status === 'fulfilled') setStats(s.value);
        if (w.status === 'fulfilled') setWorkOrders(w.value);
        if (p.status === 'fulfilled') setPpmSchedules(p.value);
        if (a.status === 'fulfilled') setAssets(a.value);
        if (b.status === 'fulfilled') setBuildings(b.value);
        if (c.status === 'fulfilled') setCategories(c.value);
        if (sla.status === 'fulfilled') setSlaConfigs(sla.value);
        if (logs.status === 'fulfilled') setAuditLogs(logs.value);
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

      // Status filter, driven by the pill bar
      if (selectedStatus !== 'ALL' && w.status !== selectedStatus) {
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
  }, [workOrders, selectedBuilding, selectedCategory, selectedPriority, selectedStatus, datePreset, startDate, endDate]);

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
    (selectedStatus !== 'ALL' ? 1 : 0) +
    (datePreset !== 'ALL' ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedBuilding('ALL');
    setSelectedCategory('ALL');
    setSelectedPriority('ALL');
    setSelectedStatus('ALL');
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

  /** Everything the other filters allow, before the status pill narrows it. */
  const statusBarSource = useMemo(
    () =>
      workOrders.filter((w) => {
        if (selectedBuilding !== 'ALL' && w.building_id !== selectedBuilding) return false;
        if (selectedCategory !== 'ALL' && w.category_id !== selectedCategory) return false;
        if (selectedPriority !== 'ALL' && w.priority !== selectedPriority) return false;
        return true;
      }),
    [workOrders, selectedBuilding, selectedCategory, selectedPriority]
  );

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

  // Everything below runs on every render, above the loading return, so
  // the hook order stays identical between renders.
  const priorityData = [
    { name: 'Emergency', count: filteredWorkOrders.filter((w) => w.priority === 'Emergency').length, fill: '#EF4444' },
    { name: 'High', count: filteredWorkOrders.filter((w) => w.priority === 'High').length, fill: '#F97316' },
    { name: 'Medium', count: filteredWorkOrders.filter((w) => w.priority === 'Medium').length, fill: '#F59E0B' },
    { name: 'Low', count: filteredWorkOrders.filter((w) => w.priority === 'Low').length, fill: '#10B981' },
  ];

  // ---- figures the reference layout needs, all measured ---------------------
  const activeWorkOrders = openCount + inProgressCount;

  /** PPM completion: of the scheduled visits, how many are done. */
  const ppmDone = filteredPPMs.filter((p) =>
    ['Completed', 'Closed'].includes(p.status)
  ).length;
  const ppmCompliance =
    filteredPPMs.length > 0 ? Math.round((ppmDone / filteredPPMs.length) * 100) : 0;

  /** PPM visits falling in the next seven days. */
  const upcomingPPM = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    return filteredPPMs.filter((p) => {
      if (!p.due_date) return false;
      const d = new Date(p.due_date);
      return d >= now && d <= in7;
    }).length;
  }, [filteredPPMs]);

  /** Work orders raised per day across the last week. */
  const dailyTrend = useMemo(() => {
    const days: { day: string; key: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        key: d.toISOString().slice(0, 10),
        count: 0,
      });
    }
    filteredWorkOrders.forEach((w) => {
      const bucket = days.find((x) => x.key === (w.created_at || '').slice(0, 10));
      if (bucket) bucket.count += 1;
    });
    return days;
  }, [filteredWorkOrders]);

  /** Busiest trades, largest first. */
  const topCategories = useMemo(() => {
    const tally = new Map<string, number>();
    filteredWorkOrders.forEach((w) => {
      const name = w.category?.name || 'Uncategorised';
      tally.set(name, (tally.get(name) || 0) + 1);
    });
    const palette = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444'];
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({ name, count, fill: palette[i % palette.length] }));
  }, [filteredWorkOrders]);

  const maxCategoryCount = Math.max(1, ...topCategories.map((c) => c.count));

  /** Donut of the live pipeline. */
  const workOrderDonut = [
    { name: 'Open', value: openCount, fill: '#3B82F6' },
    { name: 'In Progress', value: inProgressCount, fill: '#F59E0B' },
    { name: 'Resolved', value: totalClosedOrCompleted, fill: '#10B981' },
  ].filter((d) => d.value > 0);

  const slaDonut = [
    { name: 'Achieved', value: metSlaCount, fill: '#10B981' },
    { name: 'Breached', value: resolvedWos.length - metSlaCount, fill: '#EF4444' },
    { name: 'No target', value: totalFilteredCount - resolvedWos.length, fill: '#E2E8F0' },
  ].filter((d) => d.value > 0);

  const priorityDonut = priorityData.filter((p) => p.count > 0);

  const QUICK_ACTIONS = [
    { label: 'New Work Order', to: '/work-orders/new', Icon: Plus, tint: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' },
    { label: 'Create PPM', to: '/ppm/plans', Icon: CalendarCheck2, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { label: 'Asset Registry', to: '/assets', Icon: Boxes, tint: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400' },
    { label: 'PPM Schedule', to: '/ppm/schedules', Icon: Calendar, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
    { label: 'Reports', to: '/reports', Icon: ClipboardList, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400' },
    { label: 'Checklists', to: '/ppm/checklists', Icon: CheckCircle, tint: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
    { label: 'Materials', to: '/materials', Icon: Archive, tint: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' },
    { label: 'Users', to: '/users', Icon: Layers, tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' },
  ];


  /**
   * Asset health. The reference showed Good / Fair / Poor, which this system
   * does not store - assets carry a status instead. Mapped rather than
   * invented: Active is healthy, Under Maintenance needs attention, and
   * Inactive or Disposed is out of service.
   */
  const assetHealth = useMemo(() => {
    const good = filteredAssets.filter((a) => a.status === 'Active').length;
    const fair = filteredAssets.filter((a) => a.status === 'Under Maintenance').length;
    const poor = filteredAssets.filter((a) => ['Inactive', 'Disposed'].includes(a.status)).length;
    const total = good + fair + poor;
    return {
      good,
      fair,
      poor,
      total,
      percent: total > 0 ? Math.round((good / total) * 100) : 0,
    };
  }, [filteredAssets]);

  /** Reactive vs preventive volume per day, for the maintenance trend bars. */
  const maintenanceMix = useMemo(() => {
    const days: { day: string; key: string; reactive: number; preventive: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        day: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        key: d.toISOString().slice(0, 10),
        reactive: 0,
        preventive: 0,
      });
    }
    filteredWorkOrders.forEach((w) => {
      const b = days.find((x) => x.key === (w.created_at || '').slice(0, 10));
      if (b) b.reactive += 1;
    });
    filteredPPMs.forEach((ppm) => {
      const b = days.find((x) => x.key === (ppm.due_date || '').slice(0, 10));
      if (b) b.preventive += 1;
    });
    return days;
  }, [filteredWorkOrders, filteredPPMs]);

  /**
   * The reference had a System Announcements panel. There is no announcements
   * table, so rather than invent notices this shows the real audit trail -
   * same slot, same shape, actual events.
   */
  const recentActivity = useMemo(() => auditLogs.slice(0, 4), [auditLogs]);

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




  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const card =
    'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
  const cardTitle =
    'text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200';

  const pct = (n: number, total: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0.0%';

  return (
    <div className="space-y-4 w-full">
      {/* ===================================================== welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative px-5 pt-5 sm:px-6">
          {/* Skyline, drawn rather than fetched so it themes with the page */}
          <svg
            aria-hidden
            viewBox="0 0 640 150"
            preserveAspectRatio="xMaxYMax slice"
            className="pointer-events-none absolute right-0 top-0 hidden h-[150px] w-[62%] md:block"
          >
            <g opacity="0.9">
              <rect x="300" y="70" width="34" height="80" rx="2" fill="#BFDBFE" />
              <rect x="340" y="46" width="26" height="104" rx="2" fill="#93C5FD" />
              <rect x="372" y="82" width="30" height="68" rx="2" fill="#DBEAFE" />
              <rect x="408" y="34" width="24" height="116" rx="2" fill="#60A5FA" />
              <rect x="438" y="66" width="32" height="84" rx="2" fill="#BFDBFE" />
              <rect x="476" y="52" width="22" height="98" rx="2" fill="#93C5FD" />
              <rect x="504" y="88" width="34" height="62" rx="2" fill="#DBEAFE" />
              <rect x="544" y="58" width="26" height="92" rx="2" fill="#60A5FA" />
              <rect x="576" y="78" width="30" height="72" rx="2" fill="#BFDBFE" />
              {/* windows */}
              {[310, 348, 380, 414, 446, 482, 512, 550, 584].map((x, i) => (
                <g key={x} fill="#FFFFFF" opacity="0.65">
                  <rect x={x} y={96 - (i % 3) * 8} width="5" height="6" rx="1" />
                  <rect x={x + 10} y={110 - (i % 2) * 8} width="5" height="6" rx="1" />
                  <rect x={x} y={126} width="5" height="6" rx="1" />
                </g>
              ))}
              {/* turbine */}
              <g stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path d="M614 150V96" />
                <path d="M614 96l16-10M614 96l-16-10M614 96v-18" />
              </g>
              {/* solar row */}
              <g fill="#38BDF8" opacity="0.8">
                <rect x="256" y="128" width="28" height="8" rx="1" transform="rotate(-12 270 132)" />
                <rect x="256" y="140" width="28" height="8" rx="1" transform="rotate(-12 270 144)" />
              </g>
              {/* trees */}
              {[236, 292, 466, 534].map((x) => (
                <g key={x}>
                  <rect x={x + 4} y="138" width="3" height="12" fill="#A7F3D0" />
                  <circle cx={x + 5.5} cy="134" r="9" fill="#34D399" opacity="0.75" />
                </g>
              ))}
            </g>
            <rect x="0" y="148" width="640" height="2" fill="#E2E8F0" />
          </svg>

          <div className="relative max-w-lg">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Welcome to</p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-blue-600 sm:text-3xl dark:text-blue-400">
              CAFM Command Centre
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              Real-time overview of your facilities operations
            </p>
          </div>
        </div>

        {/* headline figures */}
        <div className="relative grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            { label: 'Total Buildings', value: buildings.length, sub: 'Active buildings',
              Icon: Building2, ring: 'bg-blue-500', to: '/facilities/buildings' },
            { label: 'Total Assets', value: assets.length.toLocaleString(), sub: 'Registered assets',
              Icon: Boxes, ring: 'bg-emerald-500', to: '/assets' },
            { label: 'Active Work Orders', value: activeWorkOrders, sub: 'Open & in progress',
              Icon: ClipboardList, ring: 'bg-orange-500', to: '/work-orders' },
            { label: 'PPM Compliance', value: filteredPPMs.length ? `${ppmCompliance}%` : '—',
              sub: filteredPPMs.length ? `${ppmDone} of ${filteredPPMs.length} visits done` : 'No visits scheduled',
              Icon: CheckCircle, ring: 'bg-violet-500', to: '/ppm/dashboard' },
            { label: 'SLA Compliance', value: resolvedWos.length ? `${dynamicSLA}%` : '—',
              sub: resolvedWos.length ? 'On target' : 'Nothing resolved yet',
              Icon: ShieldCheck, ring: 'bg-teal-500', to: '/reports' },
          ].map(({ label, value, sub, Icon, ring, to }) => (
            <Link
              key={label}
              to={to}
              className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white ${ring}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="text-xl font-bold leading-tight text-slate-900 dark:text-white">
                  {value}
                </p>
                <p className="truncate text-[11px] text-slate-400">{sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ===================================================== filters */}
      <div className={`flex flex-wrap items-center gap-2 p-2.5 ${card}`}>
        {[
          { value: selectedBuilding, onChange: setSelectedBuilding, all: 'All Buildings',
            options: buildings.map((b) => ({ id: b.id, label: b.name })) },
          { value: selectedCategory, onChange: setSelectedCategory, all: 'All Trades',
            options: categories.map((c) => ({ id: c.id, label: c.name })) },
          { value: selectedPriority, onChange: setSelectedPriority, all: 'All Priorities',
            options: ['Emergency', 'High', 'Medium', 'Low'].map((x) => ({ id: x, label: x })) },
          { value: selectedStatus, onChange: (v: string) => setSelectedStatus(v as WorkOrderStatus | 'ALL'),
            all: 'All Status',
            options: ['New', 'Assigned', 'Accepted', 'In Progress', 'On Hold', 'Pending Approval', 'Completed', 'Closed', 'Cancelled'].map((x) => ({ id: x, label: x })) },
          { value: datePreset, onChange: setDatePreset, all: 'All Time',
            options: [
              { id: 'TODAY', label: 'Today' },
              { id: 'THIS_WEEK', label: 'Last 7 days' },
              { id: 'THIS_MONTH', label: 'Last 30 days' },
            ] },
        ].map((f, i) => {
          const active = f.value !== 'ALL';
          return (
            <div
              key={i}
              className={`relative min-w-0 flex-1 rounded-lg border transition-colors sm:min-w-[9.5rem] sm:flex-none ${
                active
                  ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'
              }`}
            >
              <select
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                aria-label={f.all}
                className={`w-full cursor-pointer appearance-none bg-transparent py-2 pl-3 pr-7 text-[13px] font-medium focus:outline-none ${
                  active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <option value="ALL">{f.all}</option>
                {f.options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${active ? 'text-blue-500' : 'text-slate-400'}`} />
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-2 pl-1">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetFilters}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
            >
              Clear
            </button>
          )}
          <span className="text-[11px] text-slate-400">
            Last updated: {lastUpdated.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => window.location.reload()}
            title="Refresh"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ===================================================== row 1 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* work order overview */}
        <div className={`p-5 xl:col-span-3 ${card}`}>
          <h3 className={cardTitle}>Work Order Overview</h3>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={workOrderDonut.length ? workOrderDonut : [{ name: 'None', value: 1, fill: isDark ? '#1e293b' : '#E2E8F0' }]}
                       dataKey="value" innerRadius="66%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {(workOrderDonut.length ? workOrderDonut : [{ fill: isDark ? '#1e293b' : '#E2E8F0' }]).map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none text-slate-900 dark:text-white">{totalFilteredCount}</span>
                <span className="mt-0.5 text-[10px] text-slate-400">Total</span>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {[
                { c: '#3B82F6', label: 'Open', n: openCount },
                { c: '#F59E0B', label: 'In Progress', n: inProgressCount },
                { c: '#10B981', label: 'Resolved', n: completedCount },
                { c: '#8B5CF6', label: 'Closed', n: closedCount },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.c }} />
                  <span className="w-6 font-bold text-slate-900 dark:text-white">{r.n}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{r.label}</span>
                  <span className="text-slate-400">{pct(r.n, totalFilteredCount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link to="/work-orders" className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
            View all work orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* work orders trend */}
        <div className={`p-5 xl:col-span-4 ${card}`}>
          <div className="flex items-center justify-between">
            <h3 className={cardTitle}>Work Orders Trend</h3>
            <span className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-slate-700">
              This week
            </span>
          </div>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#F1F5F9'} vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #E2E8F0' }} />
                <Line type="monotone" dataKey="count" name="Logged" stroke="#3B82F6" strokeWidth={2}
                      dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* sla compliance */}
        <div className={`p-5 xl:col-span-3 ${card}`}>
          <h3 className={cardTitle}>SLA Compliance</h3>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slaDonut.length ? slaDonut : [{ name: 'None', value: 1, fill: isDark ? '#1e293b' : '#E2E8F0' }]}
                       dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {(slaDonut.length ? slaDonut : [{ fill: isDark ? '#1e293b' : '#E2E8F0' }]).map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold leading-none text-slate-900 dark:text-white">
                  {resolvedWos.length ? `${dynamicSLA}%` : '—'}
                </span>
                <span className="mt-0.5 text-[10px] text-slate-400">On target</span>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {[
                { label: 'Achieved', n: metSlaCount, tone: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Breached', n: resolvedWos.length - metSlaCount, tone: 'text-rose-600 dark:text-rose-400' },
                { label: 'At risk', n: filteredWorkOrders.filter((w) => getSlaStatus(w).state === 'critical').length, tone: 'text-amber-600 dark:text-amber-400' },
                { label: 'No target', n: filteredWorkOrders.filter((w) => !w.resolution_due_at).length, tone: 'text-slate-400' },
              ].map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2">
                  <span className={`truncate font-medium ${r.tone}`}>{r.label}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{r.n}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Targets {slaTargetSummary}</p>
        </div>

        {/* right stack */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:col-span-2 xl:grid-cols-1">
          {[
            { label: 'PPM Due Today', value: duePPMCount, Icon: Calendar,
              tint: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
              tone: 'text-violet-600 dark:text-violet-400', to: '/ppm/schedules' },
            { label: 'Overdue PPM', value: overduePPMCount, Icon: AlertTriangle,
              tint: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
              tone: 'text-rose-600 dark:text-rose-400', to: '/ppm/schedules' },
            { label: 'Past SLA Breaches', value: breachedCount, Icon: Clock,
              tint: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400',
              tone: 'text-orange-600 dark:text-orange-400', to: '/work-orders' },
          ].map(({ label, value, Icon, tint, tone, to }) => (
            <Link key={label} to={to} className={`flex items-center gap-3 p-4 transition-shadow hover:shadow-md ${card}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className={`text-2xl font-bold leading-tight ${tone}`}>{value}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      </div>

      {/* ===================================================== row 2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* maintenance trend */}
        <div className={`p-5 ${card}`}>
          <h3 className={cardTitle}>Facilities Maintenance Trend</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">Reactive vs preventive</p>
          <div className="mt-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maintenanceMix} margin={{ top: 4, right: 4, left: -26, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#F1F5F9'} vertical={false} />
                <XAxis dataKey="day" stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="reactive" name="Reactive" fill="#FB7185" radius={[3, 3, 0, 0]} />
                <Bar dataKey="preventive" name="Preventive" fill="#34D399" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* priority distribution */}
        <div className={`p-5 ${card}`}>
          <h3 className={cardTitle}>Priority Distribution</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">Across active work orders</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={priorityDonut.length ? priorityDonut : [{ name: 'None', count: 1, fill: isDark ? '#1e293b' : '#E2E8F0' }]}
                       dataKey="count" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none">
                    {(priorityDonut.length ? priorityDonut : [{ fill: isDark ? '#1e293b' : '#E2E8F0' }]).map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold leading-none text-slate-900 dark:text-white">{totalFilteredCount}</span>
                <span className="text-[10px] text-slate-400">Total</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2 text-[12px]">
              {priorityData.map((r) => (
                <li key={r.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.fill }} />
                  <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{r.name}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{r.count}</span>
                  <span className="text-slate-400">({pct(r.count, totalFilteredCount)})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* top categories */}
        <div className={`p-5 ${card}`}>
          <h3 className={cardTitle}>Top 5 Categories</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">By work order count</p>
          {topCategories.length === 0 ? (
            <p className="mt-8 text-center text-[12px] text-slate-400">No work orders yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topCategories.map((c) => (
                <li key={c.name} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-16 shrink-0 truncate text-slate-500 dark:text-slate-400">{c.name}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span className="block h-full rounded-full" style={{ width: `${(c.count / maxCategoryCount) * 100}%`, background: c.fill }} />
                  </span>
                  <span className="w-4 shrink-0 text-right font-bold text-slate-900 dark:text-white">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* asset health */}
        <div className={`p-5 ${card}`}>
          <h3 className={cardTitle}>Asset Health Overview</h3>
          <div className="mt-2 flex flex-col items-center">
            <div className="relative h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart innerRadius="66%" outerRadius="100%" startAngle={200} endAngle={-20}
                                data={[{ value: assetHealth.percent }]}>
                  <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                  <RadialBar background={{ fill: isDark ? '#1e293b' : '#F1F5F9' }} dataKey="value" cornerRadius={8}
                            fill={assetHealth.percent >= 80 ? '#10B981' : assetHealth.percent >= 50 ? '#F59E0B' : '#EF4444'} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
                <span className="text-xl font-bold leading-none text-slate-900 dark:text-white">
                  {assetHealth.total ? `${assetHealth.percent}%` : '—'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {assetHealth.total ? 'In service' : 'No assets'}
                </span>
              </div>
            </div>

            <div className="mt-2 grid w-full grid-cols-3 gap-2">
              {[
                { label: 'Good', n: assetHealth.good, tone: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Fair', n: assetHealth.fair, tone: 'text-amber-600 dark:text-amber-400' },
                { label: 'Poor', n: assetHealth.poor, tone: 'text-rose-600 dark:text-rose-400' },
              ].map((b) => (
                <div key={b.label} className="rounded-lg border border-slate-200 py-2 text-center dark:border-slate-800">
                  <p className={`text-[10px] font-bold uppercase ${b.tone}`}>{b.label}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{b.n.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================== row 3 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={`p-5 xl:col-span-2 ${card}`}>
          <h3 className={cardTitle}>Quick Actions</h3>
          <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
            {QUICK_ACTIONS.map(({ label, to, Icon, tint }) => (
              <Link key={label} to={to} className="group flex flex-col items-center gap-2 text-center">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-medium leading-tight text-slate-600 dark:text-slate-400">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className={`p-5 ${card}`}>
          <div className="flex items-center justify-between">
            <h3 className={cardTitle}>Recent Activity</h3>
            <Link to="/audit" className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400">
              View all
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="mt-8 text-center text-[12px] text-slate-400">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentActivity.map((log) => (
                <li key={log.id} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <Megaphone className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-200">
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">
                      {log.module} · {log.user_email || 'system'} ·{' '}
                      {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
