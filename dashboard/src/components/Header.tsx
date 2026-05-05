import {
  Search,
  Bell,
  Plus,
  TrendingUp,
  ChevronDown,
  Clock,
  Zap,
  FileDown,
} from 'lucide-react';
import type { TabId } from '../types';
import { cn } from '../utils/cn';

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  sidebarCollapsed: boolean;
  onNewApplication: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'pipeline', label: 'Pipeline', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'applications', label: 'Applications', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'generate', label: 'Generate', icon: <FileDown className="w-3.5 h-3.5" /> },
];

export function Header({
  activeTab,
  onTabChange,
  sidebarCollapsed,
  onNewApplication,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 transition-all duration-300',
        'bg-bg-header/80 backdrop-blur-2xl border-b border-border-primary/50 shadow-sm shadow-black/10',
        sidebarCollapsed ? 'left-16' : 'left-72'
      )}
    >
      <div className="flex items-center h-full px-6 gap-4">
        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-bg-secondary/50 backdrop-blur-md rounded-lg p-1.5 border border-border-primary/20 shadow-inner shadow-black/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-bg-card text-text-primary shadow-md shadow-black/20 ring-1 ring-white/5'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Market Ticker Style Info */}
        <div className="hidden lg:flex items-center gap-4 ml-4 text-xs font-mono">
          <span className="text-text-muted">PIPELINE</span>
          <span className="ticker-positive flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 9 Active
          </span>
          <span className="text-border-accent">│</span>
          <span className="text-text-muted">OFFERS</span>
          <span className="ticker-positive">1 ↑</span>
          <span className="text-border-accent">│</span>
          <span className="text-text-muted">RATE</span>
          <span className="text-cyan">58%</span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
          <input
            type="text"
            placeholder="Search companies, roles..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-56 lg:w-72 pl-9 pr-4 py-2 rounded-lg bg-bg-input/50 border border-border-primary/50 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all shadow-inner shadow-black/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-dim bg-bg-secondary px-1.5 py-0.5 rounded border border-border-primary">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-card transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gain animate-pulse-dot" />
        </button>

        {/* Profile */}
        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-bg-card transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-cyan flex items-center justify-center text-xs font-bold text-white shadow-md shadow-accent/20 ring-1 ring-white/10 hover:scale-105 transition-transform">
            SG
          </div>
          <ChevronDown className="w-3 h-3 text-text-dim" />
        </button>

        {/* New Application */}
        <button
          onClick={onNewApplication}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white text-xs font-bold transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Job</span>
        </button>
      </div>
    </header>
  );
}
