import { cn } from '../utils/cn';
import type { ApplicationStatus, Priority } from '../types';

// Career-Ops Germany canonical status colors
const statusStyles: Record<ApplicationStatus, { bg: string; text: string; dot: string }> = {
  Evaluated: { bg: 'bg-info-bg border-info-border', text: 'text-info', dot: 'bg-info' },
  Applied: { bg: 'bg-accent-bg border-accent-border', text: 'text-accent', dot: 'bg-accent' },
  Responded: { bg: 'bg-cyan-bg border-cyan/20', text: 'text-cyan', dot: 'bg-cyan' },
  Interview: { bg: 'bg-warn-bg border-warn-border', text: 'text-warn', dot: 'bg-warn' },
  Offer: { bg: 'bg-gain-bg border-gain-border', text: 'text-gain', dot: 'bg-gain' },
  Rejected: { bg: 'bg-loss-bg border-loss-border', text: 'text-loss', dot: 'bg-loss' },
  Discarded: { bg: 'bg-bg-secondary border-border-primary', text: 'text-text-dim', dot: 'bg-text-dim' },
  SKIP: { bg: 'bg-bg-secondary border-border-primary', text: 'text-text-muted', dot: 'bg-text-muted' },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style = statusStyles[status] || statusStyles.Evaluated;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border',
        style.bg,
        style.text
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
      {status}
    </span>
  );
}

const priorityStyles: Record<Priority, { bg: string; text: string }> = {
  high: { bg: 'bg-loss-bg border-loss-border', text: 'text-loss' },
  medium: { bg: 'bg-warn-bg border-warn-border', text: 'text-warn' },
  low: { bg: 'bg-bg-secondary border-border-primary', text: 'text-text-dim' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const style = priorityStyles[priority];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border',
        style.bg,
        style.text
      )}
    >
      {priority === 'high' && '🔥'}
      {priority === 'medium' && '⚡'}
      {priority === 'low' && '•'}
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
    <span className={cn('font-mono text-xs font-bold', color)}>
      {score}
    </span>
  );
}
