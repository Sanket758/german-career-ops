import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Eye,
  EyeOff,
  ArrowUpDown,
  LayoutGrid,
  Table,
  Bell,
  BellOff,
  RefreshCw,
  Moon,
  Minimize2,
  Maximize2,
  Filter,
  Palette,
  Target,
  Bookmark,
  FileDown,
} from 'lucide-react';
import type { SidebarConfig } from '../types';
import { cn } from '../utils/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  config: SidebarConfig;
  onConfigChange: (config: SidebarConfig) => void;
}

export function Sidebar({ collapsed, onToggle, config, onConfigChange }: SidebarProps) {
  const [activeSection, setActiveSection] = useState<string | null>('display');

  const updateConfig = (key: keyof SidebarConfig, value: unknown) => {
    onConfigChange({ ...config, [key]: value });
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300 ease-in-out',
        'bg-bg-sidebar/80 backdrop-blur-2xl border-r border-border-primary/50 shadow-2xl shadow-black/20',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center h-16 px-4 border-b border-border-primary/50 shrink-0 bg-bg-card/20">
        {!collapsed && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-cyan flex items-center justify-center shadow-lg shadow-accent/20 ring-1 ring-white/10">
              <Target className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-text-primary tracking-tight">JobTrackr</h1>
              <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">Dashboard</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent to-cyan flex items-center justify-center mx-auto shadow-lg shadow-accent/20 ring-1 ring-white/10">
            <Target className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Navigation Quick Links */}
      <div className="px-3 py-4 border-b border-border-primary">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-3 px-1">Quick Access</p>
        )}
        <div className="space-y-1">
          {[
            { icon: Bookmark, label: 'Saved Jobs', count: 1 },
            { icon: Target, label: 'Active Pipeline', count: 9 },
            { icon: FileDown, label: 'Generate', count: 0 },
            { icon: Filter, label: 'Filters', count: 0 },
          ].map(({ icon: Icon, label, count }) => (
            <button
              key={label}
              className={cn(
                'flex items-center w-full rounded-lg transition-colors',
                'text-text-secondary hover:text-text-primary hover:bg-bg-card',
                collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="text-sm">{label}</span>
                  {count > 0 && (
                    <span className="ml-auto text-[10px] font-mono bg-bg-card px-1.5 py-0.5 rounded text-text-muted">
                      {count}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Settings Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-3 px-1">
            Configuration
          </p>
        )}

        {/* Display Section */}
        <SidebarSection
          title="Display"
          icon={<Palette className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'display'}
          onToggle={() => toggleSection('display')}
        >
          <ToggleOption
            icon={config.showRejected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Show Rejected"
            value={config.showRejected}
            onChange={(v) => updateConfig('showRejected', v)}
          />
          <ToggleOption
            icon={config.showWithdrawn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            label="Show Withdrawn"
            value={config.showWithdrawn}
            onChange={(v) => updateConfig('showWithdrawn', v)}
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

        {/* Sort Section */}
        <SidebarSection
          title="Sorting"
          icon={<ArrowUpDown className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'sorting'}
          onToggle={() => toggleSection('sorting')}
        >
          {(['date', 'priority', 'match', 'company'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => updateConfig('sortBy', opt)}
              className={cn(
                'w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors',
                config.sortBy === opt
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20 shadow-inner'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
              )}
            >
              {opt === 'date' && '📅 Date Applied'}
              {opt === 'priority' && '🔥 Priority'}
              {opt === 'match' && '🎯 Match Score'}
              {opt === 'company' && '🏢 Company A-Z'}
            </button>
          ))}
        </SidebarSection>

        {/* View Mode */}
        <SidebarSection
          title="View Mode"
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'view'}
          onToggle={() => toggleSection('view')}
        >
          <div className="flex gap-1">
            <button
              onClick={() => updateConfig('viewMode', 'table')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all',
                config.viewMode === 'table'
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20 shadow-inner'
                  : 'text-text-secondary hover:bg-bg-card border border-transparent'
              )}
            >
              <Table className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              onClick={() => updateConfig('viewMode', 'kanban')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs transition-all',
                config.viewMode === 'kanban'
                  ? 'bg-accent/10 text-accent border border-accent/20 ring-1 ring-accent/20 shadow-inner'
                  : 'text-text-secondary hover:bg-bg-card border border-transparent'
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
        </SidebarSection>

        {/* Notifications */}
        <SidebarSection
          title="Alerts"
          icon={<Bell className="w-3.5 h-3.5" />}
          collapsed={collapsed}
          open={activeSection === 'alerts'}
          onToggle={() => toggleSection('alerts')}
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
      <div className="p-3 border-t border-border-primary shrink-0">
        <button
          onClick={onToggle}
          className={cn(
            'flex items-center w-full rounded-lg py-2.5 transition-colors',
            'text-text-muted hover:text-text-primary hover:bg-bg-card',
            collapsed ? 'justify-center' : 'gap-3 px-3'
          )}
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
  title: string;
  icon: React.ReactNode;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="flex items-center justify-center w-full p-2.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors mb-1"
        title={title}
      >
        {icon}
      </button>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="flex items-center w-full gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
      >
        {icon}
        <span className="text-xs font-medium">{title}</span>
        <Settings className={cn('w-3 h-3 ml-auto transition-transform', open && 'rotate-90')} />
      </button>
      {open && (
        <div className="mt-1 ml-2 pl-3 border-l border-border-primary space-y-1 animate-slide-in">
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
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center w-full gap-2 px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary transition-colors"
    >
      {icon}
      <span>{label}</span>
      <div
        className={cn(
          'ml-auto w-7 h-4 rounded-full transition-colors relative',
          value ? 'bg-accent' : 'bg-border-accent'
        )}
      >
        <div
          className={cn(
            'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
            value ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </div>
    </button>
  );
}
