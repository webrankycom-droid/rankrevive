'use client';

import { cn, formatNumber, formatCTR } from '@/lib/utils';
import { PositionBadge } from '@/components/ui/Badge';
import { TrendingDown, TrendingUp, Target } from 'lucide-react';
import type { Keyword } from '@/types';

interface KeywordSuggestionsProps {
  keywords: Keyword[];
  targeted?: string[];
  loading?: boolean;
}

export default function KeywordSuggestions({
  keywords,
  targeted = [],
  loading,
}: KeywordSuggestionsProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-dark-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!keywords.length) {
    return (
      <div className="text-center py-8">
        <Target className="w-8 h-8 text-dark-600 mx-auto mb-2" />
        <p className="text-dark-400 text-sm">No keywords found</p>
        <p className="text-dark-500 text-xs mt-1">Sync with Google Search Console first</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {keywords.map((kw) => {
        const isTargeted = targeted.includes(kw.keyword);
        const isRecovery = kw.position > 10 && kw.impressions > 100;

        return (
          <div
            key={kw.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
              isTargeted
                ? 'bg-brand-500/10 border-brand-500/25'
                : 'bg-dark-800/50 border-dark-700/50 hover:border-dark-600'
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-dark-100 truncate">{kw.keyword}</p>
                {isTargeted && (
                  <span className="text-xs text-brand-400 shrink-0">(targeted)</span>
                )}
                {isRecovery && !isTargeted && (
                  <span className="flex items-center gap-0.5 text-xs text-yellow-400 shrink-0">
                    <TrendingDown className="w-2.5 h-2.5" />
                    recovery
                  </span>
                )}
              </div>
              <p className="text-xs text-dark-500 mt-0.5">
                {formatNumber(kw.impressions)} imp · {formatNumber(kw.clicks)} clicks · {formatCTR(kw.ctr)} CTR
              </p>
            </div>
            <PositionBadge position={kw.position} />
          </div>
        );
      })}
    </div>
  );
}
