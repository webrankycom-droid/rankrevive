'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Link2, Zap, CheckCircle, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { sitesApi, pagesApi } from '@/lib/api';
import { truncateUrl, cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { InternalLinkSuggestion } from '@/types';

// Group suggestions by source page
function groupBySourcePage(suggestions: InternalLinkSuggestion[]) {
  const map: Record<string, { pageId: string; url: string; title: string; links: InternalLinkSuggestion[] }> = {};
  for (const s of suggestions) {
    if (!map[s.sourcePageId]) {
      map[s.sourcePageId] = { pageId: s.sourcePageId, url: s.sourceUrl, title: s.sourceTitle, links: [] };
    }
    map[s.sourcePageId].links.push(s);
  }
  return Object.values(map);
}

function SourcePageCard({
  group,
  onApply,
  applying,
  applied,
}: {
  group: { pageId: string; url: string; title: string; links: InternalLinkSuggestion[] };
  onApply: (pageId: string, links: InternalLinkSuggestion[]) => void;
  applying: boolean;
  applied: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(group.links.map(l => l.anchorText))
  );

  const toggleLink = (anchorText: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(anchorText)) next.delete(anchorText);
      else next.add(anchorText);
      return next;
    });
  };

  const selectedLinks = group.links.filter(l => selected.has(l.anchorText));

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden transition-all',
      applied ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-dark-700 bg-dark-800'
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {applied && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-dark-100 truncate">
            {group.title || truncateUrl(group.url, 50)}
          </p>
          <p className="text-xs text-dark-500 truncate">{group.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={applied ? 'success' : 'info'}>
            {applied ? 'Applied' : `${group.links.length} link${group.links.length > 1 ? 's' : ''}`}
          </Badge>
          {!applied && (
            <Button
              size="sm"
              onClick={() => onApply(group.pageId, selectedLinks)}
              loading={applying}
              disabled={selected.size === 0}
              leftIcon={<Zap className="w-3 h-3" />}
              className="text-xs"
            >
              Auto-Apply ({selected.size})
            </Button>
          )}
          <Link
            href={`/optimizer/${group.pageId}`}
            className="text-dark-500 hover:text-brand-400 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-dark-500 hover:text-dark-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-dark-700 px-4 pb-3 pt-2 space-y-2">
          {group.links.map((link) => (
            <div
              key={link.anchorText}
              onClick={() => !applied && toggleLink(link.anchorText)}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all',
                applied
                  ? 'bg-emerald-500/5 border-emerald-500/20 cursor-default'
                  : selected.has(link.anchorText)
                  ? 'bg-brand-500/10 border-brand-500/25 cursor-pointer'
                  : 'bg-dark-700/30 border-dark-600 cursor-pointer opacity-60'
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all',
                selected.has(link.anchorText) || applied
                  ? 'bg-brand-500 border-brand-500'
                  : 'border-dark-600'
              )}>
                {(selected.has(link.anchorText) || applied) && (
                  <CheckCircle className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono bg-dark-700 text-brand-300 px-1.5 py-0.5 rounded">
                    &quot;{link.anchorText}&quot;
                  </span>
                  <span className="text-xs text-dark-500">→</span>
                  <span className="text-xs text-dark-300 truncate max-w-[200px]">
                    {truncateUrl(link.targetUrl, 40)}
                  </span>
                </div>
                <p className="text-xs text-dark-500 mt-1">{link.reason}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-dark-600">{link.impressions} impr/mo</span>
                  <span className="text-xs text-dark-600">target pos: {link.targetPosition.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InternalLinksPage() {
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const queryClient = useQueryClient();
  const [appliedPages, setAppliedPages] = useState<Set<string>>(new Set());
  const [applyingPage, setApplyingPage] = useState<string | null>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list().then(r => r.data),
  });

  useEffect(() => {
    if (sitesData?.sites?.length && !selectedSiteId) {
      setSelectedSiteId(sitesData.sites[0].id);
    }
  }, [sitesData, selectedSiteId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['internal-links', selectedSiteId],
    queryFn: () => pagesApi.getInternalLinks(selectedSiteId).then(r => r.data),
    enabled: !!selectedSiteId,
    staleTime: 5 * 60 * 1000,
  });

  const applyMutation = useMutation({
    mutationFn: ({ pageId, links }: { pageId: string; links: InternalLinkSuggestion[] }) =>
      pagesApi.applyInternalLinks(pageId, links.map(l => ({
        anchorText: l.anchorText,
        targetUrl: l.targetUrl,
        targetTitle: l.targetTitle,
      }))).then(r => r.data),
    onSuccess: (result, { pageId }) => {
      if (result.success) {
        toast.success(`${result.appliedCount} internal link${result.appliedCount > 1 ? 's' : ''} added!`);
        setAppliedPages(prev => new Set([...prev, pageId]));
        queryClient.invalidateQueries({ queryKey: ['page', pageId] });
      } else {
        toast.error(result.message || 'Could not find link positions in content');
      }
      setApplyingPage(null);
    },
    onError: () => {
      toast.error('Failed to apply links');
      setApplyingPage(null);
    },
  });

  const handleApply = (pageId: string, links: InternalLinkSuggestion[]) => {
    setApplyingPage(pageId);
    applyMutation.mutate({ pageId, links });
  };

  const groups = groupBySourcePage(data?.suggestions || []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-5 h-5 text-brand-400" />
          <h1 className="text-xl font-bold text-dark-100">Internal Links</h1>
        </div>
        <p className="text-sm text-dark-400">
          Automatically find and inject internal links between pages based on keyword overlap.
          Internal links pass authority and help Google understand your site structure.
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          loading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-dark-100">{data.total}</p>
              <p className="text-xs text-dark-400 mt-0.5">Opportunities found</p>
            </div>
          </Card>
          <Card className="border-brand-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-brand-400">{groups.length}</p>
              <p className="text-xs text-dark-400 mt-0.5">Pages to update</p>
            </div>
          </Card>
          <Card className="border-emerald-500/20">
            <div className="text-center py-1">
              <p className="text-2xl font-bold text-emerald-400">{appliedPages.size}</p>
              <p className="text-xs text-dark-400 mt-0.5">Pages updated</p>
            </div>
          </Card>
        </div>
      )}

      {/* How it works banner */}
      {data && data.total > 0 && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-500/5 border border-brand-500/20 mb-5">
          <Zap className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
          <p className="text-xs text-dark-300 leading-relaxed">
            <strong className="text-dark-100">How auto-apply works:</strong> Each link is injected into the
            first paragraph-level occurrence of the anchor text — never inside headings or existing links.
            Links are added to whichever content exists (optimized first, then original).
            Review each suggestion below before applying.
          </p>
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

      {data?.message && (
        <Card>
          <p className="text-sm text-dark-400 text-center py-6">{data.message}</p>
        </Card>
      )}

      {data && data.total === 0 && !data.message && (
        <Card>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-dark-200 font-medium">All internal link opportunities are covered!</p>
            <p className="text-sm text-dark-400 mt-1">
              Pages on {data.domain} already link to each other for shared keywords.
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {groups.map(group => (
          <SourcePageCard
            key={group.pageId}
            group={group}
            onApply={handleApply}
            applying={applyingPage === group.pageId}
            applied={appliedPages.has(group.pageId)}
          />
        ))}
      </div>
    </div>
  );
}
