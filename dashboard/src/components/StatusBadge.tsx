import { cn } from '../utils/cn';
import type { ApplicationStatus, Priority } from '../types';

/**
 * 8 canonical statuses — exact labels from templates/states.yml.
 * Each status carries its own token family (status-*) so badge,
 * pipeline columns and table row accents stay in lockstep.
 */
const STATUS_META: Record<
  ApplicationStatus,
  { text: string; bg: string; border: string; dot: string; extra?: string }
> = {
  Evaluated: {
    text: 'text-status-evaluated',
    bg: 'bg-status-evaluated-bg',
    border: 'border-status-evaluated-border',
    dot: 'bg-status-evaluated',
  },
  Applied: {
    text: 'text-status-applied',
    bg: 'bg-status-applied-bg',
    border: 'border-status-applied-border',
    dot: 'bg-status-applied',
  },
  Responded: {
    text: 'text-status-responded',
    bg: 'bg-status-responded-bg',
    border: 'border-status-responded-border',
    dot: 'bg-status-responded',
  },
  Interview: {
    text: 'text-status-interview',
    bg: 'bg-status-interview-bg',
    border: 'border-status-interview-border',
    dot: 'bg-status-interview',
  },
  Offer: {
    text: 'text-status-offer',
    bg: 'bg-status-offer-bg',
    border: 'border-status-offer-border',
    dot: 'bg-status-offer',
  },
  Rejected: {
    text: 'text-status-rejected',
    bg: 'bg-status-rejected-bg',
    border: 'border-status-rejected-border',
    dot: 'bg-status-rejected',
  },
  // Candidate-driven end state — de-emphasized, struck through
  Discarded: {
    text: 'text-status-discarded',
    bg: 'bg-status-discarded-bg',
    border: 'border-status-discarded-border',
    dot: 'bg-status-discarded',
    extra: 'line-through decoration-status-discarded/50',
  },
  // "Don't apply" — dashed border reads as suspended/blocked
  SKIP: {
    text: 'text-status-skip',
    bg: 'bg-status-skip-bg',
    border: 'border-status-skip-border',
    dot: 'bg-status-skip',
    extra: 'border-dashed',
  },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.Evaluated;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold tracking-wide',
        meta.bg,
        meta.text,
        meta.border,
        meta.extra
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
      {status}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { text: string; dot: string }> = {
  high: { text: 'text-status-rejected', dot: 'bg-status-rejected' },
  medium: { text: 'text-status-skip', dot: 'bg-status-skip' },
  low: { text: 'text-text-dim', dot: 'bg-text-dim' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border-primary/70 bg-bg-secondary/60 text-[9px] font-mono font-bold uppercase tracking-wider',
        meta.text
      )}
    >
      <span className={cn('w-1 h-1 rounded-full', meta.dot)} />
      {priority}
    </span>
  );
}

export function ScoreBadge({ score }: { score: string }) {
  const numericScore = parseFloat(score) || 0;
  const color =
    numericScore >= 4.0
      ? 'text-gain'
      : numericScore >= 3.5
        ? 'text-warn'
        : numericScore >= 2.5
          ? 'text-info'
          : 'text-loss';

  return (
    <span className={cn('font-mono text-xs font-bold tabular-nums tracking-tight', color)}>
      {score}
    </span>
  );
}
