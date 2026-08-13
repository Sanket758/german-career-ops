import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import type { SidebarConfig } from '../../types';
import { cn } from '../../utils/cn';
import {
  ActionButton,
  Panel,
  PanelBody,
  PanelHeader,
  SectionLabel,
  Segmented,
  Select,
  SuccessBar,
  Toggle,
} from './ui';

const DEFAULT_CONFIG: SidebarConfig = {
  showRejected: true,
  showDiscarded: true,
  showSkipped: false,
  sortBy: 'date',
  viewMode: 'table',
  autoRefresh: false,
  notifications: true,
  darkCharts: true,
  compactMode: false,
};

const SORT_OPTIONS: { value: SidebarConfig['sortBy']; label: string }[] = [
  { value: 'date', label: 'Date Applied' },
  { value: 'priority', label: 'Priority' },
  { value: 'match', label: 'Match Score' },
  { value: 'company', label: 'Company A–Z' },
  { value: 'status', label: 'Status' },
];

interface SettingsPanelProps {
  /** When provided, the panel is controlled by the parent (App-level) config. */
  config?: SidebarConfig;
  onConfigChange?: (config: SidebarConfig) => void;
}

/**
 * Dashboard preferences — mirrors the Sidebar's SidebarConfig contract so it
 * can be bound to the same state App.tsx holds, or manage its own state when
 * rendered standalone.
 */
export function SettingsPanel({ config, onConfigChange }: SettingsPanelProps) {
  const isControlled = config !== undefined && onConfigChange !== undefined;
  const [local, setLocal] = useState<SidebarConfig>(config ?? DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const current: SidebarConfig = config ?? local;

  useEffect(() => {
    return () => {
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const update = <K extends keyof SidebarConfig>(key: K, value: SidebarConfig[K]) => {
    if (isControlled) {
      onConfigChange!({ ...config!, [key]: value });
    } else {
      setLocal((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleSave = () => {
    setSaved(true);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <Panel>
      <PanelHeader
        icon={<Settings2 className="h-3.5 w-3.5" />}
        title="Dashboard Settings"
        eyebrow="Mission control preferences"
        tone="violet"
      />

      <PanelBody className="space-y-6">
        {/* Display */}
        <section>
          <SectionLabel className="mb-2 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3 w-3" />
            Display
          </SectionLabel>
          <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
            <Toggle
              checked={current.showRejected}
              onChange={(v) => update('showRejected', v)}
              label="Show Rejected"
              description="Keep rejected applications in the table"
              icon={current.showRejected ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            />
            <Toggle
              checked={current.showDiscarded}
              onChange={(v) => update('showDiscarded', v)}
              label="Show Discarded"
              description="Include discarded / withdrawn rows"
              icon={current.showDiscarded ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            />
            <Toggle
              checked={current.showSkipped}
              onChange={(v) => update('showSkipped', v)}
              label="Show Skipped"
              description="Show rows marked as skipped"
              icon={current.showSkipped ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            />
            <Toggle
              checked={current.compactMode}
              onChange={(v) => update('compactMode', v)}
              label="Compact Mode"
              description="Tighter rows across the dashboard"
              icon={current.compactMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            />
            <Toggle
              checked={current.darkCharts}
              onChange={(v) => update('darkCharts', v)}
              label="Dark Charts"
              description="Chart surfaces stay dark on light themes"
              icon={<Moon className="h-3.5 w-3.5" />}
            />
          </div>
        </section>

        {/* Sorting + view mode */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <ArrowUpDown className="h-3 w-3" />
              Sort By
            </SectionLabel>
            <Select
              value={current.sortBy}
              onChange={(e) => update('sortBy', e.target.value as SidebarConfig['sortBy'])}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <LayoutGrid className="h-3 w-3" />
              View Mode
            </SectionLabel>
            <Segmented
              value={current.viewMode}
              onChange={(v) => update('viewMode', v)}
              options={[
                { value: 'table', label: 'Table' },
                { value: 'kanban', label: 'Kanban' },
              ]}
            />
          </div>
        </section>

        {/* Alerts */}
        <section className="grid grid-cols-1 gap-1 md:grid-cols-2">
          <div className="md:col-span-2">
            <SectionLabel className="mb-2 flex items-center gap-1.5">
              <Bell className="h-3 w-3" />
              Alerts
            </SectionLabel>
          </div>
          <Toggle
            checked={current.notifications}
            onChange={(v) => update('notifications', v)}
            label="Notifications"
            description="Surface status changes and reminders"
            icon={current.notifications ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          />
          <Toggle
            checked={current.autoRefresh}
            onChange={(v) => update('autoRefresh', v)}
            label="Auto Refresh"
            description="Re-poll data every 30 seconds"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          />
        </section>
      </PanelBody>

      {/* Save */}
      <div className="flex flex-col gap-3 border-t border-border-primary/70 p-5">
        <ActionButton onClick={handleSave} tone="accent" className="w-full md:w-auto md:px-8">
          Save Preferences
        </ActionButton>
        <p className={cn('font-mono text-[9px] uppercase tracking-[0.18em]', saved ? 'text-gain' : 'text-text-dim')}>
          Changes apply instantly across the dashboard
        </p>
        {saved && (
          <SuccessBar>Preferences saved — active across all views</SuccessBar>
        )}
      </div>
    </Panel>
  );
}
