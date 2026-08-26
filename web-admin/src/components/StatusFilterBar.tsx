import React from 'react';
import { WorkOrder, WorkOrderStatus } from '../types';

/**
 * Horizontal status filter, one pill per work-order state, each carrying its
 * own count. Gives the whole pipeline at a glance and doubles as the filter -
 * the picture and the control are the same thing.
 *
 * Colours are per status rather than decorative: work waiting on someone reads
 * warm, work in motion reads blue, finished work reads green.
 */

interface StatusFilterBarProps {
  workOrders: WorkOrder[];
  value: WorkOrderStatus | 'ALL';
  onChange: (status: WorkOrderStatus | 'ALL') => void;
}

const STATUSES: { key: WorkOrderStatus; label: string; badge: string }[] = [
  { key: 'New', label: 'Unassigned', badge: 'bg-rose-600' },
  { key: 'Assigned', label: 'Assigned', badge: 'bg-teal-700' },
  { key: 'Accepted', label: 'Accepted', badge: 'bg-purple-600' },
  { key: 'In Progress', label: 'In Progress', badge: 'bg-sky-500' },
  { key: 'On Hold', label: 'On Hold', badge: 'bg-orange-800' },
  { key: 'Pending Approval', label: 'Pending Approval', badge: 'bg-amber-500' },
  { key: 'Completed', label: 'Completed', badge: 'bg-emerald-500' },
  { key: 'Closed', label: 'Closed', badge: 'bg-emerald-800' },
  { key: 'Cancelled', label: 'Cancelled', badge: 'bg-slate-500' },
];

/** 15400 -> "+15K", so a long pipeline does not stretch the pill. */
const compact = (n: number) => (n >= 1000 ? `+${Math.floor(n / 1000)}K` : String(n));

export const StatusFilterBar: React.FC<StatusFilterBarProps> = ({
  workOrders,
  value,
  onChange,
}) => {
  const countOf = (status: WorkOrderStatus) =>
    workOrders.filter((w) => w.status === status).length;

  const Pill: React.FC<{
    active: boolean;
    badge: string;
    count: number;
    label: string;
    onClick: () => void;
  }> = ({ active, badge, count, label, onClick }) => (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`group flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 transition-colors ${
        active
          ? 'border-teal-600 dark:border-teal-400'
          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
      <span
        className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold text-white ${badge}`}
      >
        {compact(count)}
      </span>
      <span
        className={`whitespace-nowrap text-[13px] transition-colors ${
          active
            ? 'font-semibold text-slate-900 dark:text-white'
            : 'font-medium text-slate-500 group-hover:text-slate-800 dark:text-slate-400 dark:group-hover:text-slate-200'
        }`}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Scrolls inside itself on narrow screens rather than widening the page */}
      <div className="flex items-center gap-1 overflow-x-auto px-2">
        <Pill
          active={value === 'ALL'}
          badge="bg-teal-600"
          count={workOrders.length}
          label="All"
          onClick={() => onChange('ALL')}
        />
        {STATUSES.map((s) => (
          <Pill
            key={s.key}
            active={value === s.key}
            badge={s.badge}
            count={countOf(s.key)}
            label={s.label}
            onClick={() => onChange(value === s.key ? 'ALL' : s.key)}
          />
        ))}
      </div>
    </div>
  );
};
