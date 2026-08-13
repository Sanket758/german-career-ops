import { useMemo, useState } from 'react';
import {
  CalendarClock,
  Flame,
  Hourglass,
  RotateCcw,
  ShieldAlert,
  TimerReset,
} from 'lucide-react';
import type { BurnListEntry } from '../types';
import { cn } from '../utils/cn';

interface BurnListViewProps {
  entries: BurnListEntry[];
}

type CooldownStatus = 'blocked' | 'warming' | 'ready';

interface EnrichedEntry extends BurnListEntry {
  /** Whole days until earliest_reapply; null when the date is unparseable. */
  daysLeft: number | null;
  /** Percent of the cooldown window already elapsed; null when uncomputable. */
  progress: number | null;
  status: CooldownStatus;
}

const DAY_MS = 86_400_000;

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function parseDate(value: string): number | null {
  // Date-only strings ("YYYY-MM-DD") parse as LOCAL midnight so day math
  // aligns with startOfToday() — parsing them as UTC shifts same-day
  // reapply windows by the UTC offset and inflates the countdown.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const t = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    ).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Enrich a raw burn-list row with countdown + progress + status.
 * Missing/garbage dates degrade gracefully: an unparseable reapply date is
 * treated as "ready now" rather than silently blocking the candidate.
 */
function enrich(entry: BurnListEntry): EnrichedEntry {
  const today = startOfToday();
  const reject = parseDate(entry.rejection_date);
  const reapply = parseDate(entry.earliest_reapply);

  let daysLeft: number | null = null;
  let progress: number | null = null;
  let status: CooldownStatus = 'ready';

  if (reapply !== null) {
    daysLeft = Math.ceil((reapply - today) / DAY_MS);
    status = daysLeft > 30 ? 'blocked' : daysLeft > 0 ? 'warming' : 'ready';
  }

  if (reject !== null && reapply !== null && reapply > reject) {
    const total = reapply - reject;
    const elapsed = Math.min(Math.max(today - reject, 0), total);
    progress = Math.round((elapsed / total) * 100);
  }

  return { ...entry, daysLeft, progress, status };
}

const STATUS_META: Record<
  CooldownStatus,
  { chip: string; fill: string; label: string }
> = {
  blocked: {
    chip: 'border-loss-border bg-loss-bg text-loss',
    fill: 'bg-loss/70',
    label: 'Deep cooldown',
  },
  warming: {
    chip: 'border-warn-border bg-warn-bg text-warn',
    fill: 'bg-warn/70',
    label: 'Warming up',
  },
  ready: {
    chip: 'border-gain-border bg-gain-bg text-gain',
    fill: 'bg-gain/70',
    label: 'Reapply window open',
  },
};

export function BurnListView({ entries }: BurnListViewProps) {
  const [filter, setFilter] = useState<'all' | 'cooldown' | 'ready'>('all');

  const enriched = useMemo(() => entries.map(enrich), [entries]);

  const counts = useMemo(() => {
    const inCooldown = enriched.filter((e) => e.status !== 'ready').length;
    return {
      total: enriched.length,
      inCooldown,
      ready: enriched.length - inCooldown,
    };
  }, [enriched]);

  const filtered = useMemo(
    () =>
      enriched.filter((e) =>
        filter === 'all'
          ? true
          : filter === 'cooldown'
            ? e.status !== 'ready'
            : e.status === 'ready'
      ),
    [enriched, filter]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Control strip — summary readouts + filter tabs */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={<Flame className="h-3.5 w-3.5 text-loss" />}
            label="Total burned"
            value={counts.total}
            tone="loss"
          />
          <StatTile
            icon={<Hourglass className="h-3.5 w-3.5 text-warn" />}
            label="In cooldown"
            value={counts.inCooldown}
            tone="warn"
          />
          <StatTile
            icon={<RotateCcw className="h-3.5 w-3.5 text-gain" />}
            label="Reapply ready"
            value={counts.ready}
            tone="gain"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 self-start rounded-md border border-border-primary/60 bg-bg-secondary/70 p-0.5 lg:self-auto">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'cooldown', label: 'Cooldown' },
              { id: 'ready', label: 'Ready' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              aria-pressed={filter === tab.id}
              className={cn(
                'rounded-[5px] px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition-all',
                filter === tab.id
                  ? 'bg-bg-card text-text-primary shadow-sm shadow-black/30 ring-1 ring-cyan/20'
                  : 'text-text-dim hover:text-text-secondary'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'ml-1.5 tabular-nums',
                  filter === tab.id ? 'text-cyan' : 'text-text-dim'
                )}
              >
                {tab.id === 'all'
                  ? counts.total
                  : tab.id === 'cooldown'
                    ? counts.inCooldown
                    : counts.ready}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {enriched.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <EmptyState variant="filter" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry, i) => (
            <CooldownCard key={i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────────── */

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'loss' | 'warn' | 'gain';
}) {
  return (
    <div className="rounded-md border border-border-primary/70 bg-bg-card/60 px-4 py-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-dim">
          {label}
        </span>
      </div>
      <span
        className={cn(
          'mt-1 block font-mono text-2xl font-semibold tabular-nums tracking-tight',
          tone === 'loss'
            ? 'text-loss'
            : tone === 'warn'
              ? 'text-warn'
              : 'text-gain'
        )}
      >
        {String(value).padStart(2, '0')}
      </span>
    </div>
  );
}

/* ── Cooldown card — the signature element ─────────────────────────── */

function CooldownCard({ entry }: { entry: EnrichedEntry }) {
  const meta = STATUS_META[entry.status];
  const ready = entry.status === 'ready';
  const countdownLabel = ready
    ? 'Reapply now'
    : `Reapply in ${entry.daysLeft ?? 0} day${entry.daysLeft === 1 ? '' : 's'}`;

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-panel border bg-bg-card/70 p-4 transition-all',
        'before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        ready
          ? 'border-gain/30 hover:border-gain/50'
          : 'border-border-primary/70 hover:border-cyan/30'
      )}
    >
      {/* Status chip + hero countdown */}
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]',
            meta.chip
          )}
        >
          {entry.status === 'blocked' ? (
            <ShieldAlert className="h-3 w-3" />
          ) : entry.status === 'warming' ? (
            <Hourglass className="h-3 w-3" />
          ) : (
            <TimerReset className="h-3 w-3" />
          )}
          {meta.label}
        </span>

        <div className="flex flex-col items-end" aria-label={countdownLabel}>
          <span
            className={cn(
              'font-mono text-[8px] uppercase tracking-[0.22em]',
              ready ? 'text-warn' : 'text-text-dim'
            )}
          >
            {ready ? 'Reapply' : 'Reapply in'}
          </span>
          <span
            className={cn(
              'font-mono text-[26px] font-semibold leading-none tracking-tight tabular-nums',
              ready
                ? 'animate-pulse-dot text-warn'
                : entry.status === 'blocked'
                  ? 'text-loss'
                  : 'text-cyan'
            )}
          >
            {ready ? 'NOW' : `${entry.daysLeft ?? 0}D`}
          </span>
        </div>
      </div>

      {/* Company + role */}
      <div className="min-w-0">
        <h4 className="truncate text-sm font-semibold tracking-tight text-text-primary">
          {entry.company}
        </h4>
        {entry.role && (
          <p className="mt-0.5 truncate text-[11px] text-text-muted">
            {entry.role}
          </p>
        )}
      </div>

      {/* Cooldown progress — elapsed time between rejection and reapply */}
      {entry.progress !== null && (
        <div>
          <div className="relative h-[3px] w-full overflow-visible rounded-full bg-bg-secondary">
            <div
              className={cn('h-full rounded-full transition-all', meta.fill)}
              style={{ width: `${entry.progress}%` }}
            />
            <span
              aria-hidden
              className="absolute -right-px top-1/2 h-[7px] w-px -translate-y-1/2 bg-text-dim/40"
            />
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.12em] text-text-dim">
            <span className="flex items-center gap-1 truncate">
              <CalendarClock className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{entry.rejection_date}</span>
            </span>
            <span className="mx-2 shrink-0 tabular-nums text-text-muted">
              {entry.progress}% ELAPSED
            </span>
            <span className="truncate text-cyan/80">{entry.earliest_reapply}</span>
          </div>
        </div>
      )}

      {/* Reason */}
      {entry.reason && (
        <p className="border-t border-border-primary/50 pt-2.5 text-[11px] leading-relaxed text-text-muted">
          {entry.reason}
        </p>
      )}
    </article>
  );
}

/* ── Empty states ──────────────────────────────────────────────────── */

function EmptyState({ variant = 'empty' }: { variant?: 'empty' | 'filter' }) {
  const isFilter = variant === 'filter';
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-border-secondary/70 bg-bg-card/30 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-border-secondary/60 bg-bg-secondary/60">
        <Flame className="h-5 w-5 text-text-dim" />
      </span>
      {isFilter ? (
        <>
          <p className="text-sm text-text-secondary">
            No companies match this filter
          </p>
          <p className="max-w-sm font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            Try switching to “All”
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-text-primary">
            Burn list empty — no companies in cooldown.
          </p>
          <p className="text-sm text-text-secondary">
            Rejections reset your pipeline.
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-text-dim">
            Auto-populated from Gmail sync
          </p>
        </>
      )}
    </div>
  );
}
