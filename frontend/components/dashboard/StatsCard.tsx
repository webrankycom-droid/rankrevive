import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'brand' | 'success' | 'warning';
  loading?: boolean;
}

const variantStyles = {
  default: {
    icon: 'bg-dark-700 text-dark-300',
    border: 'border-dark-700',
  },
  brand: {
    icon: 'bg-brand-500/15 text-brand-400',
    border: 'border-brand-500/20',
  },
  success: {
    icon: 'bg-emerald-500/15 text-emerald-400',
    border: 'border-emerald-500/20',
  },
  warning: {
    icon: 'bg-yellow-500/15 text-yellow-400',
    border: 'border-yellow-500/20',
  },
};

export default function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  loading = false,
}: StatsCardProps) {
  const styles = variantStyles[variant];

  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
      ? TrendingDown
      : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? 'text-emerald-400'
      : trend.value < 0
      ? 'text-red-400'
      : 'text-dark-400'
    : '';

  if (loading) {
    return (
      <div className={cn('bg-dark-800 border rounded-xl p-5', styles.border)}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-lg bg-dark-700 animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-dark-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-dark-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-dark-800 border rounded-xl p-5 transition-all duration-200 hover:border-dark-600 group',
        styles.border
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', styles.icon)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {trend && TrendIcon && (
          <div className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>

      <div className="mb-1">
        <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
      </div>

      <p className="text-sm font-medium text-dark-400">{title}</p>
      {subtitle && <p className="text-xs text-dark-500 mt-0.5">{subtitle}</p>}
      {trend && (
        <p className="text-xs text-dark-500 mt-1">{trend.label}</p>
      )}
    </div>
  );
}
