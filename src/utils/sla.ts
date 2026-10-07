import { WorkOrder } from '../types';

/**
 * SLA state for a work order.
 *
 * `resolution_due_at` has always been stored but nothing read it, so a job
 * could sail past its deadline with no visible signal. These helpers turn that
 * timestamp into something the UI can show and act on.
 */
export type SlaState =
  | 'no-target' // no deadline recorded
  | 'settled' // work done, completed or closed - the clock has stopped
  | 'paused' // on hold - the database moves the deadline when work resumes
  | 'safe' // comfortably within target
  | 'warning' // 75%+ of the window used
  | 'critical' // 90%+ used, escalate now
  | 'breached'; // past the deadline

export interface SlaStatus {
  state: SlaState;
  /** Milliseconds remaining; negative once breached. */
  msRemaining: number;
  /** Portion of the SLA window consumed, 0-1 (capped). */
  elapsedRatio: number;
  /** "2h 14m left" / "Overdue by 3h 05m" / "Closed on time". */
  label: string;
  /** Compact form for table cells: "2h 14m" / "-3h 05m". */
  short: string;
  /** True when a supervisor should be alerted. */
  needsEscalation: boolean;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3d 04h" / "2h 14m" / "45m" - always two units at most. */
export const formatDuration = (ms: number): string => {
  const abs = Math.abs(ms);
  if (abs >= DAY) {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    return `${d}d ${String(h).padStart(2, '0')}h`;
  }
  if (abs >= HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MINUTE);
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  const m = Math.max(0, Math.floor(abs / MINUTE));
  return `${m}m`;
};

const SETTLED = ['Work Done', 'Pending Approval', 'Completed', 'Closed', 'Cancelled'];

export const getSlaStatus = (wo: WorkOrder, now: Date = new Date()): SlaStatus => {
  const due = wo.resolution_due_at ? new Date(wo.resolution_due_at) : null;

  if (!due || Number.isNaN(due.getTime())) {
    return {
      state: 'no-target',
      msRemaining: 0,
      elapsedRatio: 0,
      label: 'No SLA target set',
      short: '—',
      needsEscalation: false,
    };
  }

  if (SETTLED.includes(wo.status)) {
    // Judge against when work actually finished, not against "now" - otherwise
    // every historic job drifts into breach as time passes.
    const finished = wo.work_done_at || wo.completed_at || wo.closed_at;
    const finishedAt = finished ? new Date(finished) : null;
    const late = finishedAt ? finishedAt.getTime() > due.getTime() : Boolean(wo.is_overdue);
    return {
      state: 'settled',
      msRemaining: finishedAt ? due.getTime() - finishedAt.getTime() : 0,
      elapsedRatio: late ? 1 : 0,
      label: late ? 'Closed after SLA' : 'Closed within SLA',
      short: late ? 'Late' : 'On time',
      needsEscalation: false,
    };
  }

  if (wo.status === 'On Hold') {
    const left = due.getTime() - (wo.on_hold_since ? new Date(wo.on_hold_since).getTime() : now.getTime());
    return {
      state: 'paused',
      msRemaining: left,
      elapsedRatio: 0,
      label: `On hold — clock paused with ${formatDuration(left)} left`,
      short: 'Paused',
      needsEscalation: false,
    };
  }

  const start = new Date(wo.created_at).getTime();
  const window = Math.max(1, due.getTime() - start);
  const msRemaining = due.getTime() - now.getTime();
  const elapsedRatio = Math.min(1, Math.max(0, (now.getTime() - start) / window));

  if (msRemaining <= 0) {
    return {
      state: 'breached',
      msRemaining,
      elapsedRatio: 1,
      label: `Overdue by ${formatDuration(msRemaining)}`,
      short: `-${formatDuration(msRemaining)}`,
      needsEscalation: true,
    };
  }

  const state: SlaState = elapsedRatio >= 0.9 ? 'critical' : elapsedRatio >= 0.75 ? 'warning' : 'safe';

  return {
    state,
    msRemaining,
    elapsedRatio,
    label: `${formatDuration(msRemaining)} to SLA breach`,
    short: formatDuration(msRemaining),
    needsEscalation: state === 'critical',
  };
};

/** Tailwind classes per state, so badges stay consistent across screens. */
export const SLA_STYLES: Record<SlaState, { chip: string; bar: string; dot: string }> = {
  'no-target': {
    chip: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
    bar: 'bg-slate-300 dark:bg-slate-700',
    dot: 'bg-slate-400',
  },
  paused: {
    chip: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    bar: 'bg-sky-400',
    dot: 'bg-sky-400',
  },
  settled: {
    chip: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
    bar: 'bg-slate-400 dark:bg-slate-600',
    dot: 'bg-slate-400',
  },
  safe: {
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  warning: {
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
  },
  critical: {
    chip: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800',
    bar: 'bg-orange-500',
    dot: 'bg-orange-500',
  },
  breached: {
    chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    bar: 'bg-rose-500',
    dot: 'bg-rose-500',
  },
};

/**
 * One SLA clock (response, restoration or resolution): target vs actual.
 * `met` is when the milestone was reached; until then the clock is live.
 */
export interface ClockResult {
  state: 'none' | 'met' | 'late' | 'running' | 'warning' | 'overdue' | 'paused';
  dueAt: Date | null;
  metAt: Date | null;
  /** Target window length (due - created). */
  targetMs: number | null;
  /** Actual elapsed to `met`, or so far. */
  actualMs: number | null;
  label: string;
}

export const slaClock = (
  createdAt: string,
  dueAt?: string | null,
  metAt?: string | null,
  paused = false,
  now: Date = new Date()
): ClockResult => {
  const created = new Date(createdAt);
  const due = dueAt ? new Date(dueAt) : null;
  const met = metAt ? new Date(metAt) : null;
  if (!due) return { state: 'none', dueAt: null, metAt: met, targetMs: null, actualMs: null, label: 'No target' };
  const targetMs = due.getTime() - created.getTime();
  if (met) {
    const late = met > due;
    return {
      state: late ? 'late' : 'met',
      dueAt: due,
      metAt: met,
      targetMs,
      actualMs: met.getTime() - created.getTime(),
      label: late ? `Late by ${formatDuration(met.getTime() - due.getTime())}` : 'Met',
    };
  }
  const left = due.getTime() - now.getTime();
  const actualMs = now.getTime() - created.getTime();
  if (paused) return { state: 'paused', dueAt: due, metAt: null, targetMs, actualMs, label: 'Paused' };
  if (left <= 0) return { state: 'overdue', dueAt: due, metAt: null, targetMs, actualMs, label: `Overdue ${formatDuration(left)}` };
  const ratio = targetMs > 0 ? actualMs / targetMs : 1;
  return { state: ratio >= 0.75 ? 'warning' : 'running', dueAt: due, metAt: null, targetMs, actualMs, label: `${formatDuration(left)} left` };
};
