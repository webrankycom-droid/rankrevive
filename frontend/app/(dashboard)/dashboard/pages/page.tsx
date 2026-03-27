'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Download } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import PageTable from '@/components/dashboard/PageTable';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { pagesApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'synced', label: 'Synced' },
  { value: 'optimized', label: 'Optimized' },
  { value: 'published', label: 'Published' },
];

export default function PagesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['pages', { search, status, page }],
    queryFn: () =>
      pagesApi.list({ search: search || undefined, status: status || undefined, page, limit })
        .then((r) => r.data),
  });

  const pages = data?.pages || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <Header
        title="Pages"
        subtitle={`${total} pages tracked from Google Search Console`}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by URL or title..."
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            <div className="flex items-center gap-1 bg-dark-900 rounded-lg border border-dark-700 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatus(f.value); setPage(1); }}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    status === f.value
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-500 hover:text-dark-300'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
            <p className="text-sm text-dark-400">
              Showing{' '}
              <span className="text-dark-200 font-medium">
                {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)}
              </span>{' '}
              of <span className="text-dark-200 font-medium">{total}</span> pages
            </p>
            <Button variant="ghost" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />}>
              Export CSV
            </Button>
          </div>

          <PageTable pages={pages} loading={isLoading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-dark-700">
              <p className="text-xs text-dark-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
