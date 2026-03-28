'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ExternalLink, ArrowRight } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { Card } from '@/components/ui/Card';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { optimizerApi } from '@/lib/api';
import { formatDate, formatRelativeDate, truncateUrl, getScoreColor } from '@/lib/utils';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['optimization-history', page],
    queryFn: () => optimizerApi.getHistory(page, limit).then((r) => r.data),
  });

  const optimizations = data?.optimizations || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <Header
        title="Optimization History"
        subtitle={`${total} optimizations performed`}
      />

      <div className="p-6">
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Page</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">AI Provider</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Score Change</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? [...Array(10)].map((_, i) => (
                      <tr key={i} className="border-b border-dark-700/50">
                        {[...Array(6)].map((_, j) => (
                          <td key={j} className="px-4 py-3.5">
                            <div className="h-4 bg-dark-700 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : optimizations.map((opt) => {
                      const improvement = (opt.contentScoreAfter || 0) - (opt.contentScoreBefore || 0);
                      return (
                        <tr key={opt.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors group">
                          <td className="px-4 py-3.5 max-w-xs">
                            <p className="text-xs text-dark-200 truncate">
                              {opt.pageTitle || truncateUrl(opt.pageUrl || '', 45)}
                            </p>
                            <p className="text-xs text-dark-500 truncate">{opt.domain}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge variant={opt.aiProvider === 'claude' ? 'info' : 'purple'}>
                              {opt.aiProvider === 'claude' ? 'Claude' : 'GPT-4'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <span className={cn('text-xs font-semibold', getScoreColor(opt.contentScoreBefore || 0))}>
                                {opt.contentScoreBefore || '—'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-dark-600" />
                              <span className={cn('text-xs font-semibold', getScoreColor(opt.contentScoreAfter || 0))}>
                                {opt.contentScoreAfter || '—'}
                              </span>
                              {improvement !== 0 && (
                                <span className={cn(
                                  'text-xs font-bold',
                                  improvement > 0 ? 'text-emerald-400' : 'text-red-400'
                                )}>
                                  ({improvement > 0 ? '+' : ''}{improvement})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={opt.status} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-xs text-dark-300">{formatDate(opt.createdAt)}</p>
                              {opt.publishedAt && (
                                <p className="text-xs text-dark-500">
                                  Published {formatRelativeDate(opt.publishedAt)}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            {opt.pageId && (
                              <Link
                                href={`/optimizer/${opt.pageId}`}
                                className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-all"
                              >
                                Open <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>

            {!isLoading && optimizations.length === 0 && (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center mx-auto mb-4">
                  <History className="w-6 h-6 text-dark-500" />
                </div>
                <p className="text-dark-300 font-medium">No optimizations yet</p>
                <p className="text-dark-500 text-sm mt-1">
                  Go to a page and run AI optimization to see history here
                </p>
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-dark-700">
              <p className="text-xs text-dark-500">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
