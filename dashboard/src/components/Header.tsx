import { useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  LayoutDashboard,
  GitBranch,
  ListChecks,
  Flame,
  FileDown,
  Settings,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { TabId } from '../types';
import { cn } from '../utils/cn';

/** Subset of metrics the header instrument reads off the pipeline. */
export interface HeaderMetrics {
  total: number;
  interviewing: number;
  offers: number;
}

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sidebarCollapsed: boolean;
  onNewApplication: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  apiConnected: boolean;
  metrics: HeaderMetrics;
}

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  { id: 'applications', label: 'Applications', icon: ListChecks },
  { id: 'burn-list', label: 'Burn List', icon: Flame },
  { id: 'generate', label: 'Generate', icon: FileDown },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Header({
  activeTab,
  onTabChange,
  sidebarCollapsed,
  onNewApplication,
  searchQuery,
  onSearchChange,
  apiConnected,
  metrics,
}: HeaderProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 transition-[left] duration-300',
        'bg-bg-header/80 backdrop-blur-2xl border-b border-border-primary/50 shadow-inset-top',
        sidebarCollapsed ? 'left-16' : 'left-72'
      )}
    >
      {/* CODE RED alarm strip — the campaign's urgency, always on */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-code-red/70 via-code-red to-code-red/70 animate-code-red"
      />

      <div className="flex items-center gap-2 h-full px-4 lg:px-5">
        {/* CODE RED chip */}
        <div className="hidden md:flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded border border-code-red/25 bg-code-red/10 shrink-0">
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-code-red opacity-60" />
            <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-code-red" />
          </span>
          <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-code-red-bright">
            CODE RED
          </span>
        </div>

        {/* Tab rail */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center h-full min-w-0 overflow-x-auto no-scrollbar"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-1.5 h-full px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors',
                  active ? 'text-text-primary' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <Icon
                  className={cn('w-3.5 h-3.5 shrink-0', active ? 'text-accent' : 'text-text-dim')}
                />
                <span className="hidden lg:inline">{label}</span>
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-accent to-cyan transition-opacity duration-200',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </button>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden xl:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search companies, roles…"
            className="w-44 2xl:w-60 pl-8 pr-12 py-1.5 rounded-lg bg-bg-input/50 border border-border-primary/60 text-[11px] text-text-primary placeholder:text-text-dim transition-all focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 focus:bg-bg-input/80"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border-primary bg-bg-secondary text-[9px] font-mono text-text-dim">
            ⌘K
          </kbd>
        </div>

        {/* Connection pill */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[10px] font-bold tracking-[0.12em] shrink-0',
            apiConnected
              ? 'border-gain/25 bg-gain/10 text-gain'
              : 'border-warn/30 bg-warn/10 text-warn'
          )}
          title={apiConnected ? 'Connected to career-ops API' : 'API offline — showing demo data'}
        >
          {apiConnected ? (
            <Wifi className="w-3 h-3 animate-pulse-dot" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {apiConnected ? 'LIVE' : 'DEMO'}
        </div>

        {/* Instrument chips */}
        <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
          <MetricChip label="TOTAL" value={metrics.total} tone="text-info" />
          <MetricChip label="INT" value={metrics.interviewing} tone="text-violet" />
          <MetricChip label="OFF" value={metrics.offers} tone="text-gain" />
        </div>

        {/* New Application */}
        <button
          onClick={onNewApplication}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-accent to-cyan text-white text-[11px] font-bold shrink-0 transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-px active:translate-y-0 active:shadow-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">New Application</span>
          <span className="md:hidden">New</span>
        </button>
      </div>
    </header>
  );
}

function MetricChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-md bg-bg-card/60 border border-border-primary/60">
      <span className="text-[8px] font-mono font-semibold tracking-[0.18em] text-text-dim">
        {label}
      </span>
      <span className={cn('font-mono text-[11px] font-bold leading-none tabular-nums', tone)}>
        {value}
      </span>
    </span>
  );
}
