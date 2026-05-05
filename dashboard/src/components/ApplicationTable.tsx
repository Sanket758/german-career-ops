import { useState, useMemo } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ExternalLink,
  FileText,
} from 'lucide-react';
import type { Application, SidebarConfig, ApplicationStatus } from '../types';
import { StatusBadge, ScoreBadge } from './StatusBadge';
import { cn } from '../utils/cn';

interface ApplicationTableProps {
  applications: Application[];
  config: SidebarConfig;
  onSelectApp: (app: Application) => void;
  searchQuery: string;
}

type SortKey = 'date' | 'company' | 'status' | 'score';
type SortDir = 'asc' | 'desc';

export function ApplicationTable({ applications, config, onSelectApp, searchQuery }: ApplicationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filteredApps = useMemo(() => {
    let result = [...applications];

    // Apply visibility filters
    if (!config.showRejected) result = result.filter(a => a.status !== 'Rejected');
    if (!config.showDiscarded) result = result.filter(a => a.status !== 'Discarded');
    if (!config.showSkipped) result = result.filter(a => a.status !== 'SKIP');

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
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
          cmp = a.date.localeCompare(b.date);
          break;
        case 'company':
          cmp = a.company.localeCompare(b.company);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'score':
          cmp = (parseFloat(a.score) || 0) - (parseFloat(b.score) || 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [applications, config, statusFilter, searchQuery, sortKey, sortDir]);

  // Get unique statuses for filter
  const allStatuses = [...new Set(applications.map(a => a.status))];

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10">
      {/* Header with filters */}
      <div className="px-5 py-4 border-b border-border-primary/30 bg-bg-card/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Applications</h3>
            <p className="text-[10px] text-text-dim font-mono">
              SHOWING {filteredApps.length} OF {applications.length} ENTRIES
            </p>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-1">
          <FilterPill
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            label={`All (${applications.length})`}
          />
          {allStatuses.map(s => (
            <FilterPill
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              label={`${s} (${applications.filter(a => a.status === s).length})`}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-primary/30 bg-bg-secondary/30">
              <SortableHeader label="#" sortKey="date" currentSort={sortKey} direction={sortDir} onSort={() => toggleSort('date')} className="w-10" />
              <SortableHeader label="Date" sortKey="date" currentSort={sortKey} direction={sortDir} onSort={() => toggleSort('date')} className="w-24" />
              <SortableHeader label="Company" sortKey="company" currentSort={sortKey} direction={sortDir} onSort={() => toggleSort('company')} />
              <th className="px-4 py-3 text-left text-text-dim font-medium">Role</th>
              <SortableHeader label="Score" sortKey="score" currentSort={sortKey} direction={sortDir} onSort={() => toggleSort('score')} className="w-20" />
              <SortableHeader label="Status" sortKey="status" currentSort={sortKey} direction={sortDir} onSort={() => toggleSort('status')} className="w-28" />
              <th className="px-4 py-3 text-left text-text-dim font-medium">Notes</th>
              <th className="px-4 py-3 text-left text-text-dim font-medium w-16">Files</th>
            </tr>
          </thead>
          <tbody>
            {filteredApps.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <FileText className="w-8 h-8 text-text-dim mx-auto mb-2 opacity-30" />
                  <p className="text-sm text-text-muted">No applications found</p>
                  <p className="text-[10px] text-text-dim mt-1">
                    Applications are added via evaluation reports or the API
                  </p>
                </td>
              </tr>
            ) : (
              filteredApps.map(app => (
                <tr
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="border-b border-border-primary/30 hover:bg-bg-card-hover/80 transition-all duration-300 cursor-pointer group"
                >
                  <td className="px-4 py-3 font-mono text-text-dim group-hover:text-text-muted transition-colors">{app.id}</td>
                  <td className="px-4 py-3 font-mono text-text-muted">{app.date}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-text-primary group-hover:text-accent transition-colors">{app.company}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary max-w-[200px] truncate">{app.role}</td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={app.score} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-4 py-3 text-text-muted max-w-[200px] truncate">{app.notes}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {app.pdf !== '❌' && app.pdf !== '' && (
                        <span className="text-gain text-[10px]" title="PDF generated">📄</span>
                      )}
                      {app.report !== 'N/A' && app.report !== '' && (
                        <span className="text-info text-[10px]" title="Report available">📊</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
    <th className={cn('px-4 py-3 text-left', className)}>
      <button
        onClick={onSort}
        className="flex items-center gap-1 text-text-dim font-medium hover:text-text-primary transition-colors"
      >
        {label}
        {isActive && (
          direction === 'asc'
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />
        )}
      </button>
    </th>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-md text-[10px] font-bold transition-all shadow-sm',
        active
          ? 'bg-accent/10 text-accent border border-accent/20 shadow-black/20 ring-1 ring-white/5'
          : 'text-text-muted hover:text-text-primary bg-bg-secondary/50 border border-border-primary/20 hover:bg-bg-card/30'
      )}
    >
      {label}
    </button>
  );
}
