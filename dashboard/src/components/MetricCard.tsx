import { useId } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../utils/cn';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  sparkline?: number[];
  accentColor?: string;
  subtitle?: string;
}

type AccentKey = 'gain' | 'loss' | 'warn' | 'info' | 'accent' | 'cyan' | 'violet';

const ACCENTS: Record<AccentKey, { chip: string; glow: string; tick: string; hex: string }> = {
  gain:   { chip: 'bg-gain/10 text-gain ring-1 ring-gain/20',     glow: 'bg-gain',     tick: 'bg-gain',     hex: '#22c55e' },
  loss:   { chip: 'bg-loss/10 text-loss ring-1 ring-loss/20',     glow: 'bg-loss',     tick: 'bg-loss',     hex: '#ef4444' },
  warn:   { chip: 'bg-warn/10 text-warn ring-1 ring-warn/20',     glow: 'bg-warn',     tick: 'bg-warn',     hex: '#f59e0b' },
  info:   { chip: 'bg-info/10 text-info ring-1 ring-info/20',     glow: 'bg-info',     tick: 'bg-info',     hex: '#3b82f6' },
  accent: { chip: 'bg-accent/10 text-accent ring-1 ring-accent/20', glow: 'bg-accent', tick: 'bg-accent', hex: '#6366f1' },
  cyan:   { chip: 'bg-cyan/10 text-cyan ring-1 ring-cyan/20',     glow: 'bg-cyan',     tick: 'bg-cyan',     hex: '#06b6d4' },
  violet: { chip: 'bg-violet/10 text-violet ring-1 ring-violet/20', glow: 'bg-violet', tick: 'bg-violet', hex: '#8b5cf6' },
};

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  sparkline,
  accentColor = 'accent',
  subtitle,
}: MetricCardProps) {
  const accent = ACCENTS[accentColor as AccentKey] ?? ACCENTS.accent;
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-panel border border-border-primary/60 bg-bg-card/60',
        'shadow-card shadow-inset-top backdrop-blur-xl transition-all duration-300',
        'hover:-translate-y-0.5 hover:border-border-accent/70 hover:shadow-glow-accent'
      )}
    >
      {/* Accent hairline — status tick on the top edge */}
      <div className={cn('absolute inset-x-0 top-0 h-px opacity-40', accent.tick)} />

      {/* Hover glow — accent bloom in the top-right corner */}
      <div className={cn(
        'pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-30',
        accent.glow
      )} />

      <div className="relative flex flex-col gap-2.5 p-4">
        {/* Header: icon chip + title + change pill */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-inner transition-transform duration-300 group-hover:scale-110',
              accent.chip
            )}>
              {icon}
            </div>
            <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              {title}
            </span>
          </div>

          {change !== undefined && (
            <div className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
              isPositive && 'border-gain-border bg-gain-bg text-gain',
              isNegative && 'border-loss-border bg-loss-bg text-loss',
              isNeutral && 'border-border-primary/60 bg-bg-secondary/60 text-text-muted'
            )}>
              {isPositive && <TrendingUp className="h-3 w-3" />}
              {isNegative && <TrendingDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              {isPositive && '+'}
              {change !== 0 ? change : '0'}
              {changeLabel && <span className="text-text-dim">{changeLabel}</span>}
            </div>
          )}
        </div>

        {/* Value + sparkline */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-mono text-[26px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
              {value}
            </div>
            {subtitle && (
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
                <span className={cn('h-1 w-1 rounded-full', accent.tick)} />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
          </div>

          {sparkline && sparkline.length > 1 && (
            <MiniSparkline data={sparkline} color={accent.hex} />
          )}
        </div>
      </div>
    </div>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 26;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const line = points.join(' ');
  const areaPoints = `${padding},${h - padding} ${line} ${w - padding},${h - padding}`;

  return (
    <svg
      width={w}
      height={h}
      className="shrink-0 opacity-50 transition-opacity duration-300 group-hover:opacity-100"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#spark-${gid})`} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={Number(points[points.length - 1].split(',')[0])}
        cy={Number(points[points.length - 1].split(',')[1])}
        r="2"
        fill={color}
      />
    </svg>
  );
}
