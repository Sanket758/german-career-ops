import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import type { WeeklyData, StatusCount } from '../types';
import { cn } from '../utils/cn';

/* ── Shared dark-chart primitives ─────────────────────────────────── */

const TICK = { fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono, ui-monospace, monospace' };
const GRID = '#1e293b';

function ChartCard({
  title,
  eyebrow,
  accentClass,
  headerRight,
  children,
}: {
  title: string;
  eyebrow: string;
  accentClass: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-panel border border-border-primary/60 bg-bg-card/60 shadow-card shadow-inset-top backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border-primary/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('h-3.5 w-1 shrink-0 rounded-sm', accentClass)} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">{title}</h3>
            <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">{eyebrow}</p>
          </div>
        </div>
        {headerRight}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3.5 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function MissionTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-secondary bg-bg-input/95 px-3 py-2 shadow-panel backdrop-blur-md">
      {label !== undefined && label !== '' && (
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-text-dim">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 font-mono text-[11px]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-text-muted">{entry.name}</span>
            <span className="ml-auto pl-5 font-semibold tabular-nums text-text-primary">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Weekly trend (AreaChart) ─────────────────────────────────────── */

interface WeeklyChartProps {
  data: WeeklyData[];
}

export function WeeklyTrendChart({ data }: WeeklyChartProps) {
  const series = [
    { key: 'applied', label: 'Applied', color: '#3b82f6' },
    { key: 'interviews', label: 'Interviews', color: '#6366f1' },
    { key: 'offers', label: 'Offers', color: '#22c55e' },
  ];

  return (
    <ChartCard
      title="Weekly Trend"
      eyebrow="Applications · Interviews · Offers"
      accentClass="bg-gradient-to-b from-info to-info/30"
      headerRight={<ChartLegend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="mc-applied" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mc-interviews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="mc-offers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.32} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} dy={4} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
            <Tooltip content={(props) => <MissionTooltip {...props} />} cursor={{ stroke: '#2a3548', strokeDasharray: '3 3' }} />
            <Area
              type="monotone"
              dataKey="applied"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#mc-applied)"
              name="Applied"
            />
            <Area
              type="monotone"
              dataKey="interviews"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#mc-interviews)"
              name="Interviews"
            />
            <Area
              type="monotone"
              dataKey="offers"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#mc-offers)"
              name="Offers"
            />
            {/* Rejections — noise line, deliberately muted */}
            <Line
              type="monotone"
              dataKey="rejected"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name="Rejected"
              opacity={0.7}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ── Status breakdown (BarChart) ──────────────────────────────────── */

interface StatusBarChartProps {
  data: StatusCount[];
}

/** Canonical status → token hex, matching the status-* tokens in index.css. */
const STATUS_HEX: Record<string, string> = {
  evaluated: '#6366f1',
  applied: '#3b82f6',
  responded: '#06b6d4',
  interview: '#8b5cf6',
  offer: '#10b981',
  rejected: '#ef4444',
  discarded: '#94a3b8',
  skip: '#f59e0b',
};

function toLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function StatusBarChart({ data }: StatusBarChartProps) {
  const chartData = data.map((d) => ({
    name: toLabel(d.status),
    count: d.count,
    fill: STATUS_HEX[d.status.toLowerCase()] ?? '#6366f1',
  }));

  return (
    <ChartCard
      title="Pipeline Breakdown"
      eyebrow="Status distribution"
      accentClass="bg-gradient-to-b from-violet to-violet/30"
      headerRight={
        <ChartLegend items={chartData.map((d) => ({ label: `${d.name}`, color: d.fill }))} />
      }
    >
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -12, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={TICK}
              axisLine={false}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
            <Tooltip content={(props) => <MissionTooltip {...props} />} cursor={{ fill: '#1a2236', fillOpacity: 0.6 }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count" maxBarSize={36}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/* ── Response rate (donut) ────────────────────────────────────────── */

interface ResponseDonutProps {
  rate: number;
}

export function ResponseDonut({ rate }: ResponseDonutProps) {
  const data = [
    { name: 'Response', value: rate },
    { name: 'No Response', value: Math.max(0, 100 - rate) },
  ];

  return (
    <ChartCard
      title="Response Rate"
      eyebrow="Employer response"
      accentClass="bg-gradient-to-b from-gain to-gain/30"
    >
      <div className="flex flex-col items-center">
        <div className="relative h-[160px] w-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={68}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="#22c55e" />
                <Cell fill="#1e293b" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-bold tabular-nums text-gain">{rate}%</span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Response</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-gain" />
            Response {rate}%
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-border-secondary" />
            No response {Math.max(0, 100 - rate)}%
          </span>
        </div>
      </div>
    </ChartCard>
  );
}
