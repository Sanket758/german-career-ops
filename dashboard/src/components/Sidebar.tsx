import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  Bell,
  BellOff,
  RefreshCw,
  Moon,
  Minimize2,
  Maximize2,
  Palette,
  Target,
  CalendarDays,
  Flame,
  Building2,
  ListChecks,
  LayoutDashboard,
  GitBranch,
  FileDown,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { SidebarConfig, TabId } from '../types';
import { cn } from '../utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  config: SidebarConfig;
  onConfigChange: (config: SidebarConfig) => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const NAV_TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch },
  { id: 'applications', label: 'Applications', icon: ListChecks },
  { id: 'burn-list', label: 'Burn List', icon: Flame },
  { id: 'generate', label: 'Generate', icon: FileDown },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const SORT_OPTIONS: { id: SidebarConfig['sortBy']; label: string; icon: LucideIcon }[] = [
  { id: 'date', label: 'Date Applied', icon: CalendarDays },
  { id: 'priority', label: 'Priority', icon: Flame },
  { id: 'match', label: 'Match Score', icon: Target },
  { id: 'company', label: 'Company A-Z', icon: Building2 },
  { id: 'status', label: 'Status', icon: ListChecks },
];

export function Sidebar({
  collapsed,
  onToggle,
  config,
  onConfigChange,
  activeTab,
  onTabChange,
}: SidebarProps) {
  const [activeSection, setActiveSection] = useState<string | null>('display');

  const updateConfig = (key: keyof SidebarConfig, value: unknown) => {
    onConfigChange({ ...config, [key]: value });
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  /** When collapsed, clicking a section expands the rail and opens that section. */
  const handleSectionClick = (section: string) => {
    if (collapsed) {
      onToggle();
      setActiveSection(section);
    } else {
      toggleSection(section);
    }
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out',
        'bg-bg-sidebar/80 backdrop-blur-2xl border-r border-border-primary/50 shadow-2xl shadow-black/20',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      {/* Brand */}
      <div className="flex items-center h-16 px-4 border-b border-border-primary/50 shrink-0 bg-bg-card/20">
        {!collapsed ? (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-cyan flex items-center justify-center shadow-glow-accent ring-1 ring-white/10">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-text-primary tracking-tight leading-none">
                JobTrackr
              </h1>
              <p className="mt-1 text-[9px] text-text-muted font-mono uppercase tracking-[0.22em]">
                Mission Control
              </p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-cyan flex items-center justify-center mx-auto shadow-glow-accent ring-1 ring-white/10">
            <Target className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-3 py-4 border-b border-border-primary/60">
        {!collapsed && (
          <p className="text-[9px] font-semibold text-text-dim uppercase tracking-[0.2em] mb-2.5 px-1">
            Navigate
          </p>
        )}
        <div className="space-y-0.5">
          {NAV_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                title={collapsed ? label : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center w-full gap-3 rounded-lg transition-all',
                  collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                  active
                    ? 'bg-bg-card/70 text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card/40'
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-accent to-cyan"
                  />
                )}
                <Icon
                  className={cn('w-4 h-4 shrink-0', active ? 'text-accent' : 'text-text-dim')}
                />
                {!collapsed && <span className="text-xs font-medium">{label}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configuration */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="text-[9px] font-semibold text-text-dim uppercase tracking-[0.2em] mb-2.5 px-1">
            Configuration
          </p>
        )}

        {/* Display */}
        <SidebarSection
          id="display"
          title="Display"
          icon={<Palette className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'display'}
          onToggle={() => handleSectionClick('display')}
        >
          <ToggleOption
            icon={config.showRejected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Show Rejected"
            value={config.showRejected}
            onChange={(v) => updateConfig('showRejected', v)}
          />
          <ToggleOption
            icon={config.showDiscarded ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Show Discarded"
            value={config.showDiscarded}
            onChange={(v) => updateConfig('showDiscarded', v)}
          />
          <ToggleOption
            icon={config.showSkipped ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Show Skipped"
            value={config.showSkipped}
            onChange={(v) => updateConfig('showSkipped', v)}
          />
          <ToggleOption
            icon={config.compactMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            label="Compact Mode"
            value={config.compactMode}
            onChange={(v) => updateConfig('compactMode', v)}
          />
          <ToggleOption
            icon={<Moon className="w-3.5 h-3.5" />}
            label="Dark Charts"
            value={config.darkCharts}
            onChange={(v) => updateConfig('darkCharts', v)}
          />
        </SidebarSection>

        {/* Sorting */}
        <SidebarSection
          id="sorting"
          title="Sorting"
          icon={<ArrowUpDown className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'sorting'}
          onToggle={() => handleSectionClick('sorting')}
        >
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => updateConfig('sortBy', id)}
              aria-pressed={config.sortBy === id}
              className={cn(
                'flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors',
                config.sortBy === id
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
              )}
            >
              <Icon
                className={cn(
                  'w-3.5 h-3.5 shrink-0',
                  config.sortBy === id ? 'text-accent' : 'text-text-dim'
                )}
              />
              {label}
            </button>
          ))}
        </SidebarSection>

        {/* View Mode */}
        <SidebarSection
          id="view"
          title="View Mode"
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'view'}
          onToggle={() => handleSectionClick('view')}
        >
          <div className="flex gap-1">
            <button
              onClick={() => updateConfig('viewMode', 'table')}
              aria-pressed={config.viewMode === 'table'}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all',
                config.viewMode === 'table'
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20'
                  : 'text-text-secondary hover:bg-bg-card border border-transparent'
              )}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => updateConfig('viewMode', 'kanban')}
              aria-pressed={config.viewMode === 'kanban'}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all',
                config.viewMode === 'kanban'
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20'
                  : 'text-text-secondary hover:bg-bg-card border border-transparent'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
        </SidebarSection>

        {/* Alerts */}
        <SidebarSection
          id="alerts"
          title="Alerts"
          icon={<Bell className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'alerts'}
          onToggle={() => handleSectionClick('alerts')}
        >
          <ToggleOption
            icon={config.notifications ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            label="Notifications"
            value={config.notifications}
            onChange={(v) => updateConfig('notifications', v)}
          />
          <ToggleOption
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label="Auto Refresh"
            value={config.autoRefresh}
            onChange={(v) => updateConfig('autoRefresh', v)}
          />
        </SidebarSection>
      </div>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-border-primary/60 shrink-0">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center w-full rounded-lg py-2.5 transition-colors',
            'text-text-muted hover:text-text-primary hover:bg-bg-card',
            collapsed ? 'justify-center' : 'gap-3 px-3'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarSection({
  title,
  icon,
  collapsed,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-full p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors mb-1"
        title={`Expand to configure — ${title}`}
        aria-label={`Expand to configure — ${title}`}
      >
        {icon}
      </button>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center w-full gap-2.5 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
      >
        {icon}
        <span className="text-xs font-medium">{title}</span>
        <ChevronDown
          className={cn('w-3 h-3 ml-auto text-text-dim transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="mt-1 ml-2 pl-3 border-l border-border-primary/70 space-y-1 animate-slide-in">
          {children}
        </div>
      )}
    </div>
  );
}

function ToggleOption({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="flex items-center w-full gap-2.5 px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
    >
      {icon}
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          'ml-auto flex items-center w-8 h-4.5 rounded-full p-0.5 transition-colors',
          value ? 'bg-accent/90' : 'bg-border-accent/70'
        )}
      >
        <span
          className={cn(
            'block w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200',
            value ? 'translate-x-3.5' : 'translate-x-0'
          )}
        />
      </span>
    </button>
  );
}
