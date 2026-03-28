'use client';

import Link from 'next/link';
import { ExternalLink, Sparkles, RefreshCw, MoreHorizontal } from 'lucide-react';
import { cn, formatNumber, formatRelativeDate, truncateUrl, getScoreColor, getScoreBg } from '@/lib/utils';
import { PositionBadge, StatusBadge } from '@/components/ui/Badge';
import type { Page } from '@/types';

interface PageTableProps {
  pages: Page[];
  loading?: boolean;
  onOptimize?: (pageId: string) => void;
  onSync?: (pageId: string) => void;
}

function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-dark-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getScoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', getScoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-dark-700/50">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-dark-700 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

import Link from 'next/link';
import { ExternalLink, Sparkles, RefreshCw, MoreHorizontal } from 'lucide-react';
import { cn, formatNumber, formatRelativeDate, truncateUrl, getScoreColor, getScoreBg } from '@/lib/utils';
import { PositionBadge, StatusBadge } from '@/components/ui/Badge';
import type { Page } from '@/types';

interface PageTableProps {
  pages: Page[];
  loading?: boolean;
  onOptimize?: (pageId: string) => void;
  onSync?: (pageId: string) => void;
}

function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-dark-500 text-xs">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getScoreBg(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums', getScoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-dark-700/50">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-4 bg-dark-700 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function PageTable({ pages, loading, onOptimize, onSync }: PageTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-dark-700">
            <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              URL
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Keywords
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Impressions
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Avg Position
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Score
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Status
            </th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
            : pages.map((page) => (
                <tr
                  key={page.id}
                  className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors group"
                >
                  <td className="px-4 py-3.5 max-w-xs">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/optimizer/${page.id}`}
                          className="text-dark-100 hover:text-brand-300 font-medium transition-colors text-xs leading-relaxed block truncate"
                        >
                          {truncateUrl(page.url, 55)}
                        </Link>
                        {page.lastSyncedAt && (
                          <span className="text-dark-500 text-xs">
                            Synced {formatRelativeDate(page.lastSyncedAt)}
                          </span>
                        )}
                      </div>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3 text-dark-500 hover:text-dark-300" />
                      </a>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <span className="text-dark-200 tabular-nums text-xs">
                      {page.keywordCount ? formatNumber(Number(page.keywordCount)) : '—'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <span className="text-dark-200 tabular-nums text-xs">
                      {page.totalImpressions ? formatNumber(Number(page.totalImpressions)) : '—'}
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {page.avgPosition ? (
                      <PositionBadge position={Number(page.avgPosition)} />
                    ) : (
                      <span className="text-dark-500 text-xs">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <ScoreBar score={page.contentScore} />
                  </td>

                  <td className="px-4 py-3.5">
                    <StatusBadge status={page.status} />
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/optimizer/${page.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        Optimize
                      </Link>
                      {onSync && (
                        <button
                          onClick={() => onSync(page.id)}
                          className="p-1.5 rounded-lg text-dark-500 hover:text-dark-300 hover:bg-dark-700 transition-colors"
                          title="Refresh from GSC"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>

      {!loading && pages.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-dark-500" />
          </div>
          <p className="text-dark-300 font-medium">No pages found</p>
          <p className="text-dark-500 text-sm mt-1">
            Connect Google Search Console to sync your pages
          </p>
        </div>
      )}
    </div>
  );
}
