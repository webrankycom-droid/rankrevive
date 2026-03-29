'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  ExternalLink, Lightbulb, TrendingDown
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { sitesApi, pagesApi } from '@/lib/api';
import { cn, truncateUrl } from '@/lib/utils';
import type { CannibalizationConflict } from '@/types';

const SEVERITY_CONFIG = {
  high: {
    label: 'High',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    dot: 'bg-red-400',
    badge: 'variant' as const,
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'Low',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-400',
  },
};

function ConflictCard({ conflict }: { conflict: CannibalizationConflict }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CONFIG[conflict.severity];

  return (
    <div className={cn('rounded-xl border overflow-hidden', sev.bg)}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <span className={cn('w-2 h-2 rounded-full shrink-0', sev.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-dark-100 truncate">
              &quot;{conflict.keyword}&quot;
            </span>
            <span className={cn('text-xs font-medium', sev.color)}>
              {sev.label} — {conflict.pageCount} pages competing
            </span>
          </div>
          <div className="flex items-center gap-4 mt-0.5 text-xs text-dark-500">
            <span>{conflict.totalImpressions.toLocaleString()} impressions/mo</span>
            <span>{conflict.totalClicks} clicks/mo</span>
            <span>Best pos: {conflict.bestPosition.toFixed(1)}</span>
            {conflict.positionSpread > 0 && (
              <span className="text-amber-500">Spread: {conflict.positionSpread} positions</span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-dark-500 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-dark-500 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          {/* Recommendation */}
          <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-dark-800/60 border border-dark-700">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-dark-300 leading-relaxed">{conflict.recommendation}</p>
          </div>

          {/* Competing pages */}
          <div className="space-y-2">
            {conflict.pages.map((page, idx) => (
              <div
                key={page.pageId}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                  idx === 0
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-dark-800/40 border-dark-700'
                )}
              >
                <div className="shrink-0">
                  {idx === 0 ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-dark-200 truncate">{truncateUrl(page.url, 55)}</p>
                    {idx === 0 && (
                      <span className="text-xs text-emerald-400 font-medium shrink-0">Winner</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-dark-500">
                    <span>pos {page.position.toFixed(1)}</span>
                    <span>{page.impressions} impr</span>
                    <span>{page.clicks} clicks</span>
                    {page.contentScore != null && (
                      <span>score: {page.contentScore}</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/optimizer/${page.pageId}`}
                  className="shrink-0 text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
                >
                  Optimize
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CannibalizationPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [minImpressions, setMinImpressions] = useState(5);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list().then((r) => r.data),
  });

  // Auto-select first site
  useEffect(() => {
    if (sitesData?.sites?.length && !selectedSiteId) {
      setSelectedSiteId(sitesData.sites[0].id);
    }
  }, [sitesData, selectedSiteId]);

  const sites = sitesData?.sites || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ['cannibalization', selectedSiteId, minImpressions],
    queryFn: () => pagesApi.getCannibalization(selectedSiteId, minImpressions).then((r) => r.data),
    enabled: !!selectedSiteId,
  });

  const highConflicts = data?.conflicts.filter(c => c.severity === 'high') || [];
  const mediumConflicts = data?.conflicts.filter(c => c.severity === 'medium') || [];
  const lowConflicts = data?.conflicts.filter(c => c.severity === 'low') || [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          <h1 className="text-xl font-bold text-dark-100">Keyword Cannibalization</h1>
        </div>
        <p className="text-sm text-dark-400">
          Find keywords where multiple pages compete against each other, splitting Google&apos;s ranking signals.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {sites.length > 0 && (
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-dark-800 border border-dark-700 text-dark-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.domain}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-2">
          <label className="text-xs text-dark-400">Min impressions:</label>
          <select
            value={minImpressions}
            onChange={(e) => setMinImpressions(Number(e.target.value))}
            className="bg-dark-800 border border-dark-700 text-dark-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            <option value={1}>1+</option>
            <option value={5}>5+</option>
            <option value={10}>10+</option>
            <option value={50}>50+</option>
            <option value={100}>100+</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="border-red-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-red-400">{data.summary.high}</p>
              <p className="text-xs text-dark-400 mt-0.5">High severity</p>
            </div>
          </Card>
          <Card className="border-amber-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-amber-400">{data.summary.medium}</p>
              <p className="text-xs text-dark-400 mt-0.5">Medium severity</p>
            </div>
          </Card>
          <Card className="border-blue-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-blue-400">{data.summary.low}</p>
              <p className="text-xs text-dark-400 mt-0.5">Low severity</p>
            </div>
          </Card>
        </div>
      )}

      {/* Results */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-dark-800 rounded-xl animate-pulse border border-dark-700" />
          ))}
        </div>
      )}

      {error && (
        <Card>
          <p className="text-sm text-red-400 text-center py-4">Failed to load cannibalization data</p>
        </Card>
      )}

      {data && data.total === 0 && (
        <Card>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-dark-200 font-medium">No cannibalization detected</p>
            <p className="text-sm text-dark-400 mt-1">
              No keywords have multiple pages competing for the same ranking on {data.domain}.
            </p>
          </div>
        </Card>
      )}

      {data && data.total > 0 && (
        <div className="space-y-6">
          {highConflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <h2 className="text-sm font-semibold text-dark-200">High Severity — Fix These First</h2>
                <Badge variant="danger">{highConflicts.length}</Badge>
              </div>
              <div className="space-y-2">
                {highConflicts.map((c) => <ConflictCard key={c.keyword} conflict={c} />)}
              </div>
            </div>
          )}

          {mediumConflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <h2 className="text-sm font-semibold text-dark-200">Medium Severity</h2>
                <Badge variant="warning">{mediumConflicts.length}</Badge>
              </div>
              <div className="space-y-2">
                {mediumConflicts.map((c) => <ConflictCard key={c.keyword} conflict={c} />)}
              </div>
            </div>
          )}

          {lowConflicts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <h2 className="text-sm font-semibold text-dark-200">Low Severity</h2>
                <Badge variant="info">{lowConflicts.length}</Badge>
              </div>
              <div className="space-y-2">
                {lowConflicts.map((c) => <ConflictCard key={c.keyword} conflict={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedSiteId && !isLoading && (
        <Card>
          <p className="text-sm text-dark-400 text-center py-6">
            Select a site above to analyze keyword cannibalization.
          </p>
        </Card>
      )}
    </div>
  );
}
