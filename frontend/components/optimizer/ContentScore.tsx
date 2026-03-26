'use client';

import { cn, getScoreColor, getScoreBg, getScoreLabel } from '@/lib/utils';
import type { ContentScoreBreakdown, ScoreMetric } from '@/types';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface ContentScoreProps {
  score: ContentScoreBreakdown | null;
  loading?: boolean;
  compact?: boolean;
}

function MetricRow({ metric, loading }: { metric: ScoreMetric; loading?: boolean }) {
  const pct = (metric.score / metric.maxScore) * 100;
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400';
  const textColor = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400';

  const Icon = pct >= 70 ? CheckCircle : pct >= 40 ? AlertCircle : XCircle;

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="w-4 h-4 bg-dark-700 rounded animate-pulse" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-dark-700 rounded animate-pulse mb-1.5" />
          <div className="h-1.5 bg-dark-700 rounded-full animate-pulse" />
        </div>
        <div className="w-8 h-3 bg-dark-700 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', textColor)} />
        <span className="text-xs font-medium text-dark-200 flex-1">{metric.label}</span>
        <span className={cn('text-xs font-bold tabular-nums', textColor)}>
          {metric.score}/{metric.maxScore}
        </span>
      </div>
      <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden ml-5">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {metric.recommendation && (
        <p className="text-xs text-dark-500 mt-1 ml-5 flex items-start gap-1">
          <Info className="w-3 h-3 shrink-0 mt-0.5 text-dark-600" />
          {metric.recommendation}
        </p>
      )}
    </div>
  );
}

export default function ContentScore({ score, loading, compact = false }: ContentScoreProps) {
  const total = score?.total ?? 0;

  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (circumference * total) / 100;

  const ringColor = total >= 75 ? '#10b981' : total >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div>
      {/* Score circle */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={loading ? '#334155' : ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={loading ? circumference : dashOffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {loading ? (
              <div className="w-6 h-5 bg-dark-700 rounded animate-pulse" />
            ) : (
              <span className={cn('text-lg font-bold', getScoreColor(total))}>
                {total}
              </span>
            )}
          </div>
        </div>
        <div>
          {loading ? (
            <>
              <div className="h-5 w-20 bg-dark-700 rounded animate-pulse mb-1" />
              <div className="h-3 w-28 bg-dark-700 rounded animate-pulse" />
            </>
          ) : (
            <>
              <p className={cn('text-lg font-bold', getScoreColor(total))}>
                {getScoreLabel(total)}
              </p>
              <p className="text-xs text-dark-400">
                Content optimization score
              </p>
            </>
          )}
        </div>
      </div>

      {/* Metrics breakdown */}
      {!compact && (
        <div className="divide-y divide-dark-700/50">
          {loading
            ? [...Array(10)].map((_, i) => <MetricRow key={i} metric={{} as ScoreMetric} loading />)
            : score
            ? Object.values(score.metrics).map((metric) => (
                <MetricRow key={metric.label} metric={metric} />
              ))
            : null}
        </div>
      )}
    </div>
  );
}
