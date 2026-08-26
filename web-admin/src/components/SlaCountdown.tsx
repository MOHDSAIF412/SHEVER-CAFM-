import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Timer } from 'lucide-react';
import { WorkOrder } from '../types';
import { getSlaStatus, SLA_STYLES } from '../utils/sla';

interface SlaCountdownProps {
  workOrder: WorkOrder;
  /** `chip` for table cells, `panel` for the work-order detail header. */
  variant?: 'chip' | 'panel';
  className?: string;
}

/**
 * Live SLA countdown. Re-renders every 30s so the remaining time stays honest
 * on a screen left open, rather than freezing at whatever it said on load.
 */
export const SlaCountdown: React.FC<SlaCountdownProps> = ({
  workOrder,
  variant = 'chip',
  className = '',
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sla = getSlaStatus(workOrder, now);
  const style = SLA_STYLES[sla.state];

  if (sla.state === 'no-target' && variant === 'chip') {
    return <span className="text-[10px] text-slate-400">—</span>;
  }

  const Icon =
    sla.state === 'breached'
      ? AlertTriangle
      : sla.state === 'settled'
        ? CheckCircle2
        : sla.state === 'critical' || sla.state === 'warning'
          ? Timer
          : Clock;

  if (variant === 'chip') {
    return (
      <span
        title={sla.label}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${style.chip} ${className}`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        {sla.short}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3 ${style.chip} ${className}`}
      role="status"
      aria-live={sla.state === 'breached' ? 'assertive' : 'polite'}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight">{sla.label}</p>
          {workOrder.resolution_due_at && sla.state !== 'settled' && (
            <p className="mt-0.5 text-[10px] opacity-80">
              Target:{' '}
              {new Date(workOrder.resolution_due_at).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>

      {sla.state !== 'settled' && sla.state !== 'no-target' && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
            style={{ width: `${Math.round(sla.elapsedRatio * 100)}%` }}
          />
        </div>
      )}

      {sla.needsEscalation && (
        <p className="mt-2 text-[10px] font-semibold">
          {sla.state === 'breached'
            ? 'SLA breached — escalate to the supervisor now.'
            : 'Over 90% of the SLA window used — escalate before it breaches.'}
        </p>
      )}
    </div>
  );
};
