import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-dark-700 text-dark-300 border-dark-600',
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
  info: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-dark-400',
  success: 'bg-emerald-400',
  warning: 'bg-yellow-400',
  danger: 'bg-red-400',
  info: 'bg-brand-400',
  purple: 'bg-purple-400',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])}
        />
      )}
      {children}
    </span>
  );
}

export function PositionBadge({ position }: { position: number }) {
  const variant = position < 5 ? 'success' : position <= 20 ? 'warning' : 'danger';
  return (
    <Badge variant={variant} dot>
      #{position.toFixed(1)}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    pending: 'default',
    synced: 'info',
    optimized: 'warning',
    published: 'success',
    draft: 'default',
    draft_wp: 'warning',
    active: 'success',
    canceled: 'danger',
    inactive: 'default',
  };

  return (
    <Badge variant={variantMap[status] || 'default'} dot>
      {status.replace('_', ' ')}
    </Badge>
  );
}
