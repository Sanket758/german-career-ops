import { useMemo, useState } from 'react';
import {
  Send,
  MessageSquare,
  Gift,
  XCircle,
  RefreshCw,
  Clock,
  Radar,
  MailCheck,
} from 'lucide-react';
import type { ActivityItem } from '../types';
import { cn } from '../utils/cn';

type FilterKey = 'all' | ActivityItem['type'];

const typeConfig: Record<ActivityItem['type'], { icon: React.ReactElement; color: string; bg: string; dot: string; label: string }> = {
  applied:   { icon: <Send className="h-3.5 w-3.5" />, color: 'text-info',      bg: 'bg-info-bg',            dot: 'bg-info',      label: 'Applied' },
  interview: { icon: <MessageSquare className="h-3.5 w-3.5" />, color: 'text-accent',  bg: 'bg-accent-bg',      dot: 'bg-accent',  label: 'Interview' },
  offer:     { icon: <Gift className="h-3.5 w-3.5" />, color: 'text-gain',     bg: 'bg-gain-bg',            dot: 'bg-gain',      label: 'Offer' },
  rejected:  { icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-loss',    bg: 'bg-loss-bg',            dot: 'bg-loss',      label: 'Rejected' },
  update:    { icon: <RefreshCw className="h-3.5 w-3.5" />, color: 'text-cyan',    bg: 'bg-cyan-bg',            dot: 'bg-cyan',      label: 'Update' },
  reminder:  { icon: <Clock className="h-3.5 w-3.5" />, color: 'text-warn',    bg: 'bg-warn-bg',            dot: 'bg-warn',      label: 'Reminder' },
  scan:      { icon: <Radar className="h-3.5 w-3.5" />, color: 'text-violet',  bg: 'bg-violet-bg',          dot: 'bg-violet',    label: 'Scan' },
  sync:      { icon: <MailCheck className="h-3.5 w-3.5" />, color: 'text-status-discarded', bg: 'bg-status-discarded-bg', dot: 'bg-status-discarded', label: 'Sync' },
};

const FILTER_KEYS = Object.keys(typeConfig) as ActivityItem['type'][];

interface ActivityFeedProps {
  activities: ActivityItem[];
  /** When false, hides the unread/NEW highlighting (tied to config.notifications). */
  showUnread?: boolean;
}

export function ActivityFeed({ activities, showUnread = true }: ActivityFeedProps) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const acc: Record<FilterKey, number> = {
      all: activities.length, applied: 0, interview: 0, offer: 0,
      rejected: 0, update: 0, reminder: 0, scan: 0, sync: 0,
    };
    for (const a of activities) acc[a.type] += 1;
    return acc;
  }, [activities]);

  const filtered = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [activities, filter]
  );

  const unreadCount = showUnread ? activities.filter((a) => a.isNew).length : 0;

  return (
    <div className="overflow-hidden rounded-panel border border-border-primary/60 bg-bg-card/60 shadow-card shadow-inset-top backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-primary/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-3.5 w-1 shrink-0 rounded-sm bg-gradient-to-b from-warn to-warn/30" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">Activity Feed</h3>
            <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Real-time updates</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showUnread && <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-gain" />}
          <span className="font-mono text-[10px] text-text-muted">
            {showUnread && unreadCount > 0 ? `${unreadCount} NEW` : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Type filter chips */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-border-primary/50 px-4 py-2.5">
        <FilterChip
          label="All"
          count={counts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        {FILTER_KEYS.map((t) => (
          <FilterChip
            key={t}
            label={typeConfig[t].label}
            count={counts[t]}
            dot={typeConfig[t].dot}
            active={filter === t}
            onClick={() => setFilter(t)}
          />
        ))}
      </div>

      {/* Feed */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border-primary/50">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-text-dim">
              No activity — {filter === 'all' ? 'feed empty' : filter}
            </p>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const cfg = typeConfig[item.type];
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-card-hover',
                  showUnread && item.isNew && 'bg-bg-card-hover/40'
                )}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/5',
                  cfg.bg,
                  cfg.color
                )}>
                  {cfg.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold text-text-primary">{item.company}</span>
                    {showUnread && item.isNew && (
                      <span className="rounded-full bg-gain-bg px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-widest text-gain">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-text-secondary">{item.message}</p>
                  <span className="mt-1 block font-mono text-[10px] text-text-dim">{item.time}</span>
                </div>
                {showUnread && item.isNew && <span className="mt-2 h-1.5 w-1.5 shrink-0 animate-pulse-dot rounded-full bg-gain" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors',
        active
          ? 'border-border-accent bg-bg-input text-text-primary'
          : 'border-border-primary/60 bg-bg-card/40 text-text-muted hover:border-border-accent/50 hover:text-text-secondary'
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label}
      <span className={cn('tabular-nums', active ? 'text-text-dim' : 'text-text-dim/70')}>{count}</span>
    </button>
  );
}
