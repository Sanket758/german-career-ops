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
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl p-4 hover:border-accent/30 shadow-lg shadow-black/10 hover:shadow-accent/5 transition-all duration-300 group relative overflow-hidden">
      <div className={cn(
        "absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500",
        accentColor === 'gain' && 'bg-gain',
        accentColor === 'loss' && 'bg-loss',
        accentColor === 'warn' && 'bg-warn',
        accentColor === 'info' && 'bg-info',
        accentColor === 'accent' && 'bg-accent',
        accentColor === 'cyan' && 'bg-cyan',
      )} />
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110',
            accentColor === 'gain' && 'bg-gain/10 text-gain ring-1 ring-gain/20',
            accentColor === 'loss' && 'bg-loss/10 text-loss ring-1 ring-loss/20',
            accentColor === 'warn' && 'bg-warn/10 text-warn ring-1 ring-warn/20',
            accentColor === 'info' && 'bg-info/10 text-info ring-1 ring-info/20',
            accentColor === 'accent' && 'bg-accent/10 text-accent ring-1 ring-accent/20',
            accentColor === 'cyan' && 'bg-cyan/10 text-cyan ring-1 ring-cyan/20',
          )}>
            {icon}
          </div>
          <span className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{title}</span>
        </div>
        {change !== undefined && (
          <div className={cn(
            'flex items-center gap-0.5 text-[11px] font-mono font-semibold',
            isPositive && 'text-gain',
            isNegative && 'text-loss',
            isNeutral && 'text-text-dim'
          )}>
            {isPositive && <TrendingUp className="w-3 h-3" />}
            {isNegative && <TrendingDown className="w-3 h-3" />}
            {isNeutral && <Minus className="w-3 h-3" />}
            {isPositive && '+'}
            {change !== 0 ? change : '0'}
            {changeLabel && <span className="text-text-dim ml-0.5">{changeLabel}</span>}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-text-primary font-mono tracking-tight">{value}</div>
          {subtitle && <p className="text-[10px] text-text-dim mt-0.5">{subtitle}</p>}
        </div>

        {sparkline && sparkline.length > 1 && (
          <MiniSparkline data={sparkline} positive={isPositive || isNeutral} />
        )}
      </div>
    </div>
  );
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 32;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x},${y}`;
  });

  const line = points.join(' ');
  const areaPoints = `${padding},${h - padding} ${line} ${w - padding},${h - padding}`;
  const color = positive ? '#22c55e' : '#ef4444';

  return (
    <svg width={w} height={h} className="opacity-60 group-hover:opacity-100 transition-opacity">
      <defs>
        <linearGradient id={`grad-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${positive})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r="2" fill={color} />
    </svg>
  );
}
