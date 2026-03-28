'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PositionBadge } from '@/components/ui/Badge';
import { pagesApi } from '@/lib/api';
import { formatNumber, formatCTR, truncateUrl } from '@/lib/utils';
import Link from 'next/link';

export default function KeywordsPage() {
  const [search, setSearch] = useState('');

  const { data: pagesData, isLoading } = useQuery({
    queryKey: ['pages-with-keywords'],
    queryFn: () => pagesApi.list({ limit: 100 }).then((r) => r.data),
  });

  const pages = pagesData?.pages || [];

  // Aggregate keywords view: pages sorted by avg position
  const recoveryOpportunities = pages
    .filter((p) => p.avgPosition && Number(p.avgPosition) > 5 && Number(p.avgPosition) <= 20)
    .sort((a, b) => Number(b.totalImpressions) - Number(a.totalImpressions));

  const topPerformers = pages
    .filter((p) => p.avgPosition && Number(p.avgPosition) <= 5)
    .sort((a, b) => Number(b.totalClicks) - Number(a.totalClicks));

  return (
    <div>
      <Header
        title="Keywords"
        subtitle="Pages ranked in positions 1-20 with recovery opportunities"
      />

      <div className="p-6 space-y-6">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by URL..."
          leftIcon={<Search className="w-4 h-4" />}
          className="max-w-sm"
        />

        {/* Recovery opportunities */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark-200">Recovery Opportunities</h3>
              <p className="text-xs text-dark-500">Pages ranking 5-20 with high impression volume</p>
            </div>
            <span className="ml-auto text-xs text-dark-500">{recoveryOpportunities.length} pages</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">URL</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">CTR</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Avg Position</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b border-dark-700/50">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-dark-700 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : recoveryOpportunities
                      .filter((p) => !search || p.url.includes(search))
                      .map((p) => (
                        <tr key={p.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-xs text-dark-200 truncate">{truncateUrl(p.url)}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-dark-300 tabular-nums">
                            {formatNumber(Number(p.totalImpressions))}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-dark-300 tabular-nums">
                            {formatNumber(Number(p.totalClicks))}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-dark-300 tabular-nums">
                            {formatCTR(Number(p.totalClicks) / Math.max(1, Number(p.totalImpressions)))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <PositionBadge position={Number(p.avgPosition)} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/optimizer/${p.id}`}
                              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                            >
                              Optimize →
                            </Link>
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
            {!isLoading && recoveryOpportunities.length === 0 && (
              <div className="text-center py-10">
                <p className="text-dark-400 text-sm">No recovery opportunities found</p>
                <p className="text-dark-500 text-xs mt-1">Sync your site from Google Search Console first</p>
              </div>
            )}
          </div>
        </Card>

        {/* Top performers */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-dark-700 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dark-200">Top Performers</h3>
              <p className="text-xs text-dark-500">Pages ranking in top 5 positions</p>
            </div>
            <span className="ml-auto text-xs text-dark-500">{topPerformers.length} pages</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">URL</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Clicks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Impressions</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Avg Position</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers
                  .filter((p) => !search || p.url.includes(search))
                  .slice(0, 10)
                  .map((p) => (
                    <tr key={p.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs text-dark-200 truncate">{truncateUrl(p.url)}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-emerald-400 font-semibold tabular-nums">
                        {formatNumber(Number(p.totalClicks))}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-dark-300 tabular-nums">
                        {formatNumber(Number(p.totalImpressions))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PositionBadge position={Number(p.avgPosition)} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
