'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  BarChart2, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, ExternalLink, RefreshCw
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { sitesApi, gscApi } from '@/lib/api';
import { cn, truncateUrl, getScoreColor } from '@/lib/utils';
import type { RankingPage, KeywordRankHistory } from '@/types';

// Simple inline sparkline using SVG
function Sparkline({ history, color }: { history: { position: number }[]; color: string }) {
  if (history.length < 2) return <span className="text-xs text-dark-600">–</span>;

  const positions = history.map(h => h.position);
  const maxPos = Math.max(...positions);
  const minPos = Math.min(...positions);
  const range = maxPos - minPos || 1;

  const w = 64, h = 24;
  const points = positions.map((p, i) => {
    const x = (i / (positions.length - 1)) * w;
    // Invert: lower position = higher on chart
    const y = ((p - minPos) / range) * (h - 4) + 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-xs text-dark-600">–</span>;
  if (Math.abs(delta) < 0.5) return (
    <span className="flex items-center gap-0.5 text-xs text-dark-500">
      <Minus className="w-3 h-3" /> {delta > 0 ? '+' : ''}{delta}
    </span>
  );
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-medium">
      <TrendingUp className="w-3 h-3" /> +{delta}
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-xs text-red-400 font-medium">
      <TrendingDown className="w-3 h-3" /> {delta}
    </span>
  );
}

function KeywordHistoryRow({ kw }: { kw: KeywordRankHistory }) {
  const color = kw.positionChange !== null && kw.positionChange > 0 ? '#10b981'
    : kw.positionChange !== null && kw.positionChange < 0 ? '#ef4444'
    : '#64748b';

  return (
    <div className="flex items-center gap-3 py-2 border-b border-dark-700/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-dark-200 truncate">{kw.keyword}</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Sparkline history={kw.history} color={color} />
        <span className="text-xs text-dark-300 w-10 text-right tabular-nums">
          #{kw.currentPosition.toFixed(1)}
        </span>
        <div className="w-14 text-right">
          <DeltaBadge delta={kw.positionChange} />
        </div>
      </div>
    </div>
  );
}

function PageRow({ page }: { page: RankingPage }) {
  const [expanded, setExpanded] = useState(false);

  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ['rank-history', page.pageId],
    queryFn: () => gscApi.getRankHistory(page.pageId).then(r => r.data),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
  });

  const posColor = page.avgPosition
    ? page.avgPosition <= 10 ? 'text-emerald-400'
      : page.avgPosition <= 20 ? 'text-yellow-400'
      : 'text-red-400'
    : 'text-dark-500';

  return (
    <div className="border border-dark-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-dark-800 hover:bg-dark-700/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm text-dark-100 truncate font-medium">
            {page.title || truncateUrl(page.url, 55)}
          </p>
          <p className="text-xs text-dark-500 truncate mt-0.5">{page.url}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className={cn('text-sm font-bold tabular-nums', posColor)}>
              {page.avgPosition !== null ? `#${page.avgPosition}` : '–'}
            </p>
            <p className="text-xs text-dark-600">avg pos</p>
          </div>
          <div className="w-16 text-right">
            <DeltaBadge delta={page.positionDelta} />
            <p className="text-xs text-dark-600 mt-0.5">vs prev</p>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-dark-300">{page.totalImpressions.toLocaleString()}</p>
            <p className="text-xs text-dark-600">impr</p>
          </div>
          {page.contentScore !== null && (
            <span className={cn('text-xs font-bold', getScoreColor(page.contentScore))}>
              {page.contentScore}
            </span>
          )}
          <Link
            href={`/optimizer/${page.pageId}`}
            onClick={e => e.stopPropagation()}
            className="text-brand-400 hover:text-brand-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          {expanded ? <ChevronUp className="w-4 h-4 text-dark-500" /> : <ChevronDown className="w-4 h-4 text-dark-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-dark-900/50">
          {histLoading && (
            <div className="space-y-2 pt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-8 bg-dark-800 rounded animate-pulse" />
              ))}
            </div>
          )}
          {histData && histData.keywords.length === 0 && (
            <p className="text-xs text-dark-500 py-4 text-center">
              No rank history yet — data appears after the next GSC sync.
            </p>
          )}
          {histData && histData.keywords.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-dark-400 uppercase tracking-wide">Keyword Position History</p>
                <p className="text-xs text-dark-600">↑ = improved ranking</p>
              </div>
              {histData.keywords.map((kw) => (
                <KeywordHistoryRow key={kw.keyword} kw={kw} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RankingsPage() {
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [sortBy, setSortBy] = useState<'impressions' | 'position' | 'delta'>('impressions');

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list().then(r => r.data),
  });

  useEffect(() => {
    if (sitesData?.sites?.length && !selectedSiteId) {
      setSelectedSiteId(sitesData.sites[0].id);
    }
  }, [sitesData, selectedSiteId]);

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', selectedSiteId],
    queryFn: () => gscApi.getRankings(selectedSiteId).then(r => r.data),
    enabled: !!selectedSiteId,
  });

  const pages = [...(data?.pages || [])].sort((a, b) => {
    if (sortBy === 'position') return (a.avgPosition ?? 999) - (b.avgPosition ?? 999);
    if (sortBy === 'delta') return (b.positionDelta ?? -99) - (a.positionDelta ?? -99);
    return b.totalImpressions - a.totalImpressions;
  });

  const improved = data?.pages.filter(p => (p.positionDelta ?? 0) > 0.5).length ?? 0;
  const declined = data?.pages.filter(p => (p.positionDelta ?? 0) < -0.5).length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-brand-400" />
          <h1 className="text-xl font-bold text-dark-100">Rank Tracker</h1>
        </div>
        <p className="text-sm text-dark-400">
          Track keyword position changes over time. Positions are snapshotted on every GSC sync.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {sitesData?.sites?.length && (
          <select
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
            className="bg-dark-800 border border-dark-700 text-dark-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            {sitesData.sites.map(s => (
              <option key={s.id} value={s.id}>{s.domain}</option>
            ))}
          </select>
        )}
        <div className="flex bg-dark-800 border border-dark-700 rounded-lg p-1 gap-1">
          {(['impressions', 'position', 'delta'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                sortBy === s ? 'bg-dark-700 text-dark-100' : 'text-dark-500 hover:text-dark-300'
              )}
            >
              {s === 'impressions' ? 'By Traffic' : s === 'position' ? 'By Position' : 'Most Improved'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-dark-100">{data.pages.length}</p>
              <p className="text-xs text-dark-400 mt-0.5">Pages tracked</p>
            </div>
          </Card>
          <Card className="border-emerald-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-emerald-400">{improved}</p>
              <p className="text-xs text-dark-400 mt-0.5">Positions improved</p>
            </div>
          </Card>
          <Card className="border-red-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-red-400">{declined}</p>
              <p className="text-xs text-dark-400 mt-0.5">Positions declined</p>
            </div>
          </Card>
        </div>
      )}

      {/* Page list */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-dark-800 rounded-xl animate-pulse border border-dark-700" />
          ))}
        </div>
      )}

      {!isLoading && pages.length === 0 && selectedSiteId && (
        <Card>
          <div className="text-center py-8">
            <BarChart2 className="w-10 h-10 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-300 font-medium">No ranking data yet</p>
            <p className="text-sm text-dark-500 mt-1">Sync your GSC data to start tracking positions.</p>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {pages.map(page => <PageRow key={page.pageId} page={page} />)}
      </div>
    </div>
  );
}
