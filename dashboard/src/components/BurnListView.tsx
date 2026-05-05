import { useState } from 'react';
import { Flame, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { BurnListEntry } from '../types';
import { cn } from '../utils/cn';

interface BurnListViewProps {
  entries: BurnListEntry[];
}

export function BurnListView({ entries }: BurnListViewProps) {
  const [filter, setFilter] = useState<'all' | 'blocked' | 'clear'>('all');

  const today = new Date();

  const enrichedEntries = entries.map(entry => {
    const reapplyDate = new Date(entry.earliest_reapply);
    const daysLeft = Math.ceil((reapplyDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'blocked' | 'caution' | 'clear';
    if (daysLeft > 30) status = 'blocked';
    else if (daysLeft > 0) status = 'caution';
    else status = 'clear';

    return { ...entry, daysLeft, status };
  });

  const filtered = enrichedEntries.filter(e => {
    if (filter === 'blocked') return e.status === 'blocked' || e.status === 'caution';
    if (filter === 'clear') return e.status === 'clear';
    return true;
  });

  const blockedCount = enrichedEntries.filter(e => e.status === 'blocked' || e.status === 'caution').length;
  const clearCount = enrichedEntries.filter(e => e.status === 'clear').length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          icon={<Flame className="w-4 h-4 text-loss" />}
          label="Total Burned"
          value={entries.length}
          accent="loss"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-4 h-4 text-warn" />}
          label="Blocked"
          value={blockedCount}
          accent="warn"
        />
        <SummaryCard
          icon={<CheckCircle className="w-4 h-4 text-gain" />}
          label="Reapply OK"
          value={clearCount}
          accent="gain"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-bg-secondary/50 backdrop-blur-sm rounded-lg p-1.5 w-fit border border-border-primary/20 shadow-inner shadow-black/10">
        {(['all', 'blocked', 'clear'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-bold transition-all capitalize relative',
                filter === f
                  ? 'bg-bg-card text-text-primary shadow-md shadow-black/20 ring-1 ring-white/5'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-card/30'
              )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10">
        <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Burn List</h3>
            <p className="text-[10px] text-text-dim font-mono tracking-wider mt-0.5">
              COMPANIES WITH REJECTION COOLDOWN ({enrichedEntries.length} TOTAL)
            </p>
          </div>
          <Flame className="w-4 h-4 text-loss" />
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Flame className="w-8 h-8 text-text-dim mx-auto mb-2 opacity-30" />
            <p className="text-sm text-text-muted">
              {entries.length === 0 ? 'No companies on the burn list yet' : 'No entries match this filter'}
            </p>
            <p className="text-[10px] text-text-dim mt-1">
              Companies are auto-added after rejection via Gmail sync
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-primary/30">
            {filtered.map((entry, i) => (
              <div key={i} className="group flex items-center gap-4 px-5 py-3 hover:bg-bg-card-hover/80 transition-all duration-300">
                <div className={cn(
                  'w-2 h-2 rounded-full shrink-0 shadow-sm',
                  entry.status === 'blocked' ? 'bg-loss' :
                  entry.status === 'caution' ? 'bg-warn' : 'bg-gain'
                )} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">{entry.company}</span>
                    <span className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded shadow-sm',
                      entry.status === 'blocked' ? 'bg-loss/10 text-loss ring-1 ring-loss/20' :
                      entry.status === 'caution' ? 'bg-warn/10 text-warn ring-1 ring-warn/20' : 'bg-gain/10 text-gain ring-1 ring-gain/20'
                    )}>
                      {entry.status === 'blocked' ? `🔴 ${entry.daysLeft}d left` :
                       entry.status === 'caution' ? `🟡 ${entry.daysLeft}d left` :
                       '🟢 CLEAR'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{entry.role}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-[10px] text-text-dim">
                    <Calendar className="w-3 h-3" />
                    <span>{entry.rejection_date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>Reapply: {entry.earliest_reapply}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl p-5 shadow-xl shadow-black/10 hover:border-accent/20 transition-all duration-300 relative overflow-hidden group">
      <div className={cn(
        "absolute -right-8 -top-8 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500",
        `bg-${accent}`
      )} />
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <div className={cn("p-1.5 rounded-lg shadow-inner", `bg-${accent}/10`)}>
          {icon}
        </div>
        <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">{label}</span>
      </div>
      <span className={cn('text-3xl font-bold font-mono tracking-tight relative z-10', `text-${accent}`)}>{value}</span>
    </div>
  );
}
