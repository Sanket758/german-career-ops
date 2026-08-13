import { useMemo } from 'react';
import { Calendar, ChevronRight, Layers } from 'lucide-react';
import type { Application, ApplicationStatus, SidebarConfig } from '../types';
import { ScoreBadge } from './StatusBadge';
import { cn } from '../utils/cn';

interface PipelineViewProps {
  applications: Application[];
  onSelectApp: (app: Application) => void;
  /**
   * Optional — App.tsx currently wires only `applications`/`onSelectApp`.
   * When absent, defaults mirror the Sidebar defaults so the Rejected and
   * Discarded stages stay visible and SKIP collapses out of the board.
   */
  config?: SidebarConfig;
}

/** 8 canonical statuses in flow order — matches templates/states.yml. */
const STATUS_ORDER: ApplicationStatus[] = [
  'Evaluated',
  'Applied',
  'Responded',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
  'SKIP',
];

/**
 * Status token families — identical names to StatusBadge so column accents
 * stay in lockstep with the badge palette (indigo → blue → cyan → violet →
 * emerald → red → slate → amber).
 */
const STATUS_META: Record<
  ApplicationStatus,
  { accent: string; text: string; bg: string; border: string; dot: string }
> = {
  Evaluated: {
    accent: 'bg-status-evaluated',
    text: 'text-status-evaluated',
    bg: 'bg-status-evaluated-bg',
    border: 'border-status-evaluated-border',
    dot: 'bg-status-evaluated',
  },
  Applied: {
    accent: 'bg-status-applied',
    text: 'text-status-applied',
    bg: 'bg-status-applied-bg',
    border: 'border-status-applied-border',
    dot: 'bg-status-applied',
  },
  Responded: {
    accent: 'bg-status-responded',
    text: 'text-status-responded',
    bg: 'bg-status-responded-bg',
    border: 'border-status-responded-border',
    dot: 'bg-status-responded',
  },
  Interview: {
    accent: 'bg-status-interview',
    text: 'text-status-interview',
    bg: 'bg-status-interview-bg',
    border: 'border-status-interview-border',
    dot: 'bg-status-interview',
  },
  Offer: {
    accent: 'bg-status-offer',
    text: 'text-status-offer',
    bg: 'bg-status-offer-bg',
    border: 'border-status-offer-border',
    dot: 'bg-status-offer',
  },
  Rejected: {
    accent: 'bg-status-rejected',
    text: 'text-status-rejected',
    bg: 'bg-status-rejected-bg',
    border: 'border-status-rejected-border',
    dot: 'bg-status-rejected',
  },
  Discarded: {
    accent: 'bg-status-discarded',
    text: 'text-status-discarded',
    bg: 'bg-status-discarded-bg',
    border: 'border-status-discarded-border',
    dot: 'bg-status-discarded',
  },
  SKIP: {
    accent: 'bg-status-skip',
    text: 'text-status-skip',
    bg: 'bg-status-skip-bg',
    border: 'border-status-skip-border',
    dot: 'bg-status-skip',
  },
};

function matchTone(matchScore: number): string {
  if (matchScore >= 80) return 'text-gain';
  if (matchScore >= 70) return 'text-warn';
  if (matchScore >= 60) return 'text-info';
  return 'text-loss';
}

export function PipelineView({ applications, onSelectApp, config }: PipelineViewProps) {
  const showRejected = config?.showRejected ?? true;
  const showDiscarded = config?.showDiscarded ?? true;
  const showSkipped = config?.showSkipped ?? false;

  const columns = useMemo(() => {
    return STATUS_ORDER.filter((status) => {
      if (status === 'Rejected') return showRejected;
      if (status === 'Discarded') return showDiscarded;
      if (status === 'SKIP') return showSkipped;
      return true;
    }).map((status) => ({
      status,
      meta: STATUS_META[status],
      apps: applications.filter((a) => a.status === status),
    }));
  }, [applications, showRejected, showDiscarded, showSkipped]);

  const totalCards = columns.reduce((n, col) => n + col.apps.length, 0);

  return (
    <div>
      {/* Board utility header — mission-control chrome */}
      <div className="mb-4 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
          <Layers className="w-3.5 h-3.5 text-cyan" />
          <span>{columns.length} stages</span>
          <span className="text-text-dim/40">·</span>
          <span>{totalCards} cards</span>
        </div>
        <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
          <span className="w-1 h-1 rounded-full bg-accent animate-pulse-dot" />
          click a card to inspect
        </span>
      </div>

      {/* Kanban board — horizontal scroll with snap */}
      <div className="flex items-start gap-3 overflow-x-auto snap-x snap-mandatory pb-3 -mx-1 px-1">
        {columns.map((col) => (
          <section
            key={col.status}
            className="w-72 shrink-0 snap-start rounded-xl border border-border-primary/60 bg-bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col"
          >
            {/* Status accent hairline */}
            <div className={cn('h-0.5 w-full shrink-0', col.meta.accent)} />

            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-border-primary/50 flex items-center gap-2 bg-bg-card/40">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', col.meta.dot)} />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-text-secondary">
                {col.status}
              </span>
              <span
                className={cn(
                  'ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md border text-[10px] font-mono font-bold tabular-nums',
                  col.meta.bg,
                  col.meta.text,
                  col.meta.border
                )}
              >
                {col.apps.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 flex flex-col gap-2 flex-1">
              {col.apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="group w-full text-left rounded-lg border border-border-primary/60 bg-bg-card/90 px-3 py-2.5 transition-all duration-200 hover:bg-bg-card-hover hover:border-border-accent hover:-translate-y-px hover:shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-text-primary leading-tight truncate">
                        {app.company}
                      </p>
                      <p className="text-[11px] text-text-muted leading-snug mt-0.5 truncate">
                        {app.role}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-text-dim shrink-0 mt-0.5 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border-primary/40 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-dim whitespace-nowrap">
                      <Calendar className="w-3 h-3" />
                      {app.date}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          'font-mono text-[11px] font-bold tabular-nums',
                          matchTone(app.matchScore)
                        )}
                      >
                        {app.matchScore}%
                      </span>
                      <ScoreBadge score={app.score} />
                    </div>
                  </div>
                </button>
              ))}

              {col.apps.length === 0 && (
                <div className="flex-1 min-h-[64px] flex items-center justify-center rounded-lg border border-dashed border-border-primary/50 bg-bg-card/20">
                  <span className="font-mono text-[9px] tracking-[0.2em] text-text-dim">
                    EMPTY
                  </span>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
