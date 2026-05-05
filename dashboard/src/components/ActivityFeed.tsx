import {
  Send,
  MessageSquare,
  Gift,
  XCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type { ActivityItem } from '../types';
import { cn } from '../utils/cn';

const typeConfig: Record<ActivityItem['type'], { icon: React.ReactElement; color: string; bg: string }> = {
  applied: { icon: <Send className="w-3.5 h-3.5" />, color: 'text-info', bg: 'bg-info-bg' },
  interview: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'text-accent', bg: 'bg-accent-bg' },
  offer: { icon: <Gift className="w-3.5 h-3.5" />, color: 'text-gain', bg: 'bg-gain-bg' },
  rejected: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-loss', bg: 'bg-loss-bg' },
  update: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: 'text-cyan', bg: 'bg-cyan-bg' },
  reminder: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-warn', bg: 'bg-warn-bg' },
};

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Activity Feed</h3>
          <p className="text-[10px] text-text-dim font-mono">REAL-TIME UPDATES</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse-dot" />
          <span className="text-[10px] text-text-muted font-mono">LIVE</span>
        </div>
      </div>

      <div className="divide-y divide-border-primary max-h-[420px] overflow-y-auto">
        {activities.map((item, idx) => {
          const cfg = typeConfig[item.type];
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 hover:bg-bg-card-hover transition-colors',
                item.isNew && 'bg-bg-card-hover/50'
              )}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg, cfg.color)}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">{item.company}</span>
                  {item.isNew && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gain bg-gain-bg px-1.5 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5 truncate">{item.message}</p>
                <span className="text-[10px] text-text-dim font-mono mt-1 block">{item.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
