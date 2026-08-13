import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, FileSearch, FileText } from 'lucide-react';
import type { Application, ApplicationStatus, Priority, SidebarConfig } from '../types';
import { PriorityBadge, ScoreBadge, StatusBadge } from './StatusBadge';
import { cn } from '../utils/cn';

interface ApplicationTableProps {
  applications: Application[];
  config: SidebarConfig;
  onSelectApp: (app: Application) => void;
  searchQuery: string;
}

type SortKey = 'date' | 'priority' | 'match' | 'company' | 'status' | 'score';
type SortDir = 'asc' | 'desc';

/** 8 canonical statuses in flow order. */
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

const STATUS_RANK: Record<ApplicationStatus, number> = {
  Evaluated: 0,
  Applied: 1,
  Responded: 2,
  Interview: 3,
  Offer: 4,
  Rejected: 5,
  Discarded: 6,
  SKIP: 7,
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Status token families — mirrors StatusBadge palette for chips + row accents. */
const STATUS_META: Record<
  ApplicationStatus,
  { text: string; bg: string; border: string; dot: string; left: string }
> = {
  Evaluated: {
    text: 'text-status-evaluated',
    bg: 'bg-status-evaluated-bg',
    border: 'border-status-evaluated-border',
    dot: 'bg-status-evaluated',
    left: 'border-l-status-evaluated',
  },
  Applied: {
    text: 'text-status-applied',
    bg: 'bg-status-applied-bg',
    border: 'border-status-applied-border',
    dot: 'bg-status-applied',
    left: 'border-l-status-applied',
  },
  Responded: {
    text: 'text-status-responded',
    bg: 'bg-status-responded-bg',
    border: 'border-status-responded-border',
    dot: 'bg-status-responded',
    left: 'border-l-status-responded',
  },
  Interview: {
    text: 'text-status-interview',
    bg: 'bg-status-interview-bg',
    border: 'border-status-interview-border',
    dot: 'bg-status-interview',
    left: 'border-l-status-interview',
  },
  Offer: {
    text: 'text-status-offer',
    bg: 'bg-status-offer-bg',
    border: 'border-status-offer-border',
    dot: 'bg-status-offer',
    left: 'border-l-status-offer',
  },
  Rejected: {
    text: 'text-status-rejected',
    bg: 'bg-status-rejected-bg',
    border: 'border-status-rejected-border',
    dot: 'bg-status-rejected',
    left: 'border-l-status-rejected',
  },
  Discarded: {
    text: 'text-status-discarded',
    bg: 'bg-status-discarded-bg',
    border: 'border-status-discarded-border',
    dot: 'bg-status-discarded',
    left: 'border-l-status-discarded',
  },
  SKIP: {
    text: 'text-status-skip',
    bg: 'bg-status-skip-bg',
    border: 'border-status-skip-border',
    dot: 'bg-status-skip',
    left: 'border-l-status-skip',
  },
};

function matchTone(matchScore: number): string {
  if (matchScore >= 80) return 'text-gain';
  if (matchScore >= 70) return 'text-warn';
  if (matchScore >= 60) return 'text-info';
  return 'text-loss';
}

/** Chronological rank for display dates like "Aug 08, 2026". */
function dateRank(date: string): number {
  const parsed = Date.parse(date);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function ApplicationTable({
  applications,
  config,
  onSelectApp,
  searchQuery,
}: ApplicationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>(config.sortBy);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  // Follow the sidebar sort setting whenever it changes; header clicks
  // override locally until the sidebar changes again.
  useEffect(() => {
    setSortKey(config.sortBy);
  }, [config.sortBy]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filteredApps = useMemo(() => {
    let result = [...applications];

    // Apply sidebar visibility filters
    if (!config.showRejected) result = result.filter((a) => a.status !== 'Rejected');
    if (!config.showDiscarded) result = result.filter((a) => a.status !== 'Discarded');
    if (!config.showSkipped) result = result.filter((a) => a.status !== 'SKIP');

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((a) => a.status === statusFilter);
    }

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.company.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.notes.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = dateRank(a.date) - dateRank(b.date);
          break;
        case 'company':
          cmp = a.company.localeCompare(b.company);
          break;
        case 'priority':
          cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          break;
        case 'match':
          cmp = a.matchScore - b.matchScore;
          break;
        case 'score':
          cmp = (parseFloat(a.score) || 0) - (parseFloat(b.score) || 0);
          break;
        case 'status':
          cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [applications, config, statusFilter, searchQuery, sortKey, sortDir]);

  const allStatuses = STATUS_ORDER.filter((s) => applications.some((a) => a.status === s));
  const compact = config.compactMode;
  const cell = compact ? 'px-3 py-1.5' : 'px-4 py-3';

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/60 rounded-xl overflow-hidden shadow-panel shadow-black/10">
      {/* Panel header */}
      <div className="px-4 py-3.5 border-b border-border-primary/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Applications</h3>
          <span className="font-mono text-[10px] text-text-dim uppercase tracking-[0.16em]">
            {filteredApps.length} / {applications.length} shown
          </span>
        </div>
        {searchQuery && (
          <span className="font-mono text-[10px] text-cyan uppercase tracking-[0.16em]">
            filter: “{searchQuery}”
          </span>
        )}
      </div>

      {/* Status filter chips */}
      <div className="px-4 py-2.5 border-b border-border-primary/40 bg-bg-card/20 flex flex-wrap gap-1.5">
        <FilterPill
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label={`All (${applications.length})`}
        />
        {allStatuses.map((s) => (
          <FilterPill
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            status={s}
            label={`${s} (${applications.filter((a) => a.status === s).length})`}
          />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary/50 bg-bg-secondary/40">
              <SortableHeader
                label="Date"
                sortKey="date"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('date')}
                className="pl-4 w-28"
              />
              <SortableHeader
                label="Company"
                sortKey="company"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('company')}
              />
              <th className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim whitespace-nowrap">
                Role
              </th>
              <SortableHeader
                label="Priority"
                sortKey="priority"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('priority')}
                className="w-24"
              />
              <SortableHeader
                label="Match"
                sortKey="match"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('match')}
                className="w-20"
              />
              <SortableHeader
                label="Score"
                sortKey="score"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('score')}
                className="w-16"
              />
              <SortableHeader
                label="Status"
                sortKey="status"
                currentSort={sortKey}
                direction={sortDir}
                onSort={() => toggleSort('status')}
                className="w-28"
              />
              <th className="px-3 py-2.5 text-left font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim whitespace-nowrap">
                Notes
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-text-dim whitespace-nowrap w-24">
                Links
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <FileText className="w-8 h-8 text-text-dim mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">No applications found</p>
                  <p className="font-mono text-[10px] text-text-dim mt-1">
                    Applications are added via evaluation reports or the API
                  </p>
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => {
                const meta = STATUS_META[app.status];
                return (
                  <tr
                    key={app.id}
                    onClick={() => onSelectApp(app)}
                    className={cn(
                      'group border-b border-border-primary/40 cursor-pointer transition-colors',
                      compact ? 'hover:bg-bg-card-hover/50' : 'hover:bg-bg-card-hover/80'
                    )}
                  >
                    {/* Status-colored left accent rides the first cell (borders on <tr> are unreliable) */}
                    <td
                      className={cn(
                        'border-l-2 pl-4 whitespace-nowrap',
                        meta.left,
                        cell,
                        'font-mono text-[11px] text-text-muted'
                      )}
                    >
                      {app.date}
                    </td>
                    <td className={cell}>
                      <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors">
                        {app.company}
                      </span>
                    </td>
                    <td className={cell}>
                      <span className="block max-w-[200px] truncate text-[11px] text-text-secondary">
                        {app.role}
                      </span>
                    </td>
                    <td className={cell}>
                      <PriorityBadge priority={app.priority} />
                    </td>
                    <td className={cell}>
                      <span
                        className={cn(
                          'font-mono text-xs font-bold tabular-nums',
                          matchTone(app.matchScore)
                        )}
                      >
                        {app.matchScore}%
                      </span>
                    </td>
                    <td className={cell}>
                      <ScoreBadge score={app.score} />
                    </td>
                    <td className={cell}>
                      <StatusBadge status={app.status} />
                    </td>
                    <td className={cell}>
                      <span className="block max-w-[180px] truncate text-[11px] text-text-muted">
                        {app.notes || '—'}
                      </span>
                    </td>
                    <td className={cn(cell, 'text-right')}>
                      <div className="inline-flex items-center justify-end gap-0.5">
                        {app.jobUrl && (
                          <a
                            href={app.jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open job posting"
                            className="p-1.5 rounded-md text-text-dim hover:text-accent hover:bg-accent/10 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {app.pdf && app.pdf !== '❌' && (
                          <a
                            href={app.pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open generated PDF"
                            className="p-1.5 rounded-md text-text-dim hover:text-gain hover:bg-gain/10 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {app.report && app.report !== 'N/A' && app.report !== '' && (
                          <a
                            href={app.report}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Open evaluation report"
                            className="p-1.5 rounded-md text-text-dim hover:text-cyan hover:bg-cyan/10 transition-colors"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  direction: SortDir;
  onSort: () => void;
  className?: string;
}) {
  const isActive = currentSort === sortKey;

  return (
    <th className={cn('px-3 py-2.5 text-left whitespace-nowrap', className)}>
      <button
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-colors',
          isActive ? 'text-text-primary' : 'text-text-dim hover:text-text-secondary'
        )}
      >
        {label}
        <span className="flex flex-col -space-y-[3px] ml-0.5">
          <ChevronUp
            className={cn(
              'w-2.5 h-2.5',
              isActive && direction === 'asc' ? 'text-accent' : 'text-text-dim/40'
            )}
          />
          <ChevronDown
            className={cn(
              'w-2.5 h-2.5',
              isActive && direction === 'desc' ? 'text-accent' : 'text-text-dim/40'
            )}
          />
        </span>
      </button>
    </th>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  status,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  status?: ApplicationStatus;
}) {
  const meta = status ? STATUS_META[status] : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold border transition-all',
        active
          ? meta
            ? cn(meta.bg, meta.text, meta.border, 'ring-1 ring-white/5')
            : 'bg-accent/10 text-accent border-accent/30 ring-1 ring-white/5'
          : 'text-text-muted hover:text-text-primary bg-bg-secondary/50 border-border-primary/40 hover:border-border-secondary'
      )}
    >
      {meta && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />}
      {label}
    </button>
  );
}
