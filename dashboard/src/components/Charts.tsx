import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { WeeklyData, StatusCount } from '../types';

interface WeeklyChartProps {
  data: WeeklyData[];
}

export function WeeklyTrendChart({ data }: WeeklyChartProps) {
  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">Weekly Trend</h3>
        <p className="text-[10px] text-text-dim font-mono">APPLICATIONS & INTERVIEWS OVER TIME</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="appliedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="interviewGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="offerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#151c2c',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#f1f5f9',
              }}
              itemStyle={{ color: '#94a3b8' }}
              labelStyle={{ color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }}
            />
            <Area type="monotone" dataKey="applied" stroke="#3b82f6" strokeWidth={2} fill="url(#appliedGrad)" name="Applied" />
            <Area type="monotone" dataKey="interviews" stroke="#6366f1" strokeWidth={2} fill="url(#interviewGrad)" name="Interviews" />
            <Area type="monotone" dataKey="offers" stroke="#22c55e" strokeWidth={2} fill="url(#offerGrad)" name="Offers" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StatusBarChartProps {
  data: StatusCount[];
}

export function StatusBarChart({ data }: StatusBarChartProps) {
  const colors: Record<string, string> = {
    bookmarked: '#475569',
    applied: '#3b82f6',
    screening: '#06b6d4',
    interview: '#6366f1',
    offer: '#22c55e',
    accepted: '#22c55e',
    rejected: '#ef4444',
    withdrawn: '#64748b',
  };

  const chartData = data.map((d) => ({
    name: d.status.charAt(0).toUpperCase() + d.status.slice(1),
    count: d.count,
    fill: colors[d.status] || '#6366f1',
  }));

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">Pipeline Breakdown</h3>
        <p className="text-[10px] text-text-dim font-mono">STATUS DISTRIBUTION</p>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              angle={-35}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#151c2c',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#f1f5f9',
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ResponseDonutProps {
  rate: number;
}

export function ResponseDonut({ rate }: ResponseDonutProps) {
  const data = [
    { name: 'Response', value: rate },
    { name: 'No Response', value: 100 - rate },
  ];

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary">
        <h3 className="text-sm font-semibold text-text-primary">Response Rate</h3>
        <p className="text-[10px] text-text-dim font-mono">OVERALL EMPLOYER RESPONSE</p>
      </div>
      <div className="flex items-center justify-center p-4">
        <div className="relative">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={72}
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
            <span className="text-2xl font-bold font-mono text-gain">{rate}%</span>
            <span className="text-[10px] text-text-dim">Response</span>
          </div>
        </div>
      </div>
    </div>
  );
}
