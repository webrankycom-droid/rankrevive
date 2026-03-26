'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface DataPoint {
  date: string;
  clicks: number;
  impressions: number;
  position?: number;
}

interface TrafficChartProps {
  data: DataPoint[];
  loading?: boolean;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg p-3 shadow-xl">
      <p className="text-dark-300 text-xs mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-dark-400 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TrafficChart({ data, loading }: TrafficChartProps) {
  if (loading) {
    return (
      <div className="h-48 bg-dark-900/50 rounded-lg animate-pulse flex items-center justify-center">
        <p className="text-dark-500 text-sm">Loading chart...</p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="text-dark-500 text-sm">No traffic data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="clicksGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="impressionsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(val) => {
            try { return format(new Date(val), 'MMM d'); } catch { return val; }
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11 }}
          tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="clicks"
          stroke="#0ea5e9"
          strokeWidth={2}
          fill="url(#clicksGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#0ea5e9' }}
        />
        <Area
          type="monotone"
          dataKey="impressions"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#impressionsGradient)"
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
