'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Sparkles, Send, Download, RefreshCw,
  Globe, Zap, ChevronRight, Info
} from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import ContentEditor from '@/components/optimizer/ContentEditor';
import ContentScore from '@/components/optimizer/ContentScore';
import KeywordSuggestions from '@/components/optimizer/KeywordSuggestions';
import BeforeAfterPreview from '@/components/optimizer/BeforeAfterPreview';
import { Badge, PositionBadge, StatusBadge } from '@/components/ui/Badge';
import { pagesApi, optimizerApi, wordpressApi } from '@/lib/api';
import { truncateUrl, formatRelativeDate, getScoreColor } from '@/lib/utils';
import toast from 'react-hot-toast';
import type { AIProvider, OptimizationResult } from '@/types';

export default function OptimizerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [provider, setProvider] = useState<AIProvider>('claude');
  const [activeTab, setActiveTab] = useState<'editor' | 'comparison' | 'score'>('editor');

  // Fetch page data
  const { data: page, isLoading: pageLoading } = useQuery({
    queryKey: ['page', id],
    queryFn: () => pagesApi.getById(id).then((r) => r.data),
  });

  const keywords = page?.keywords || [];
  const targetedKeywords = optimizationResult?.targetedKeywords || [];

  // Fetch content score
  const { data: currentScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['score', id, 'current'],
    queryFn: () => optimizerApi.score(id, 'current').then((r) => r.data),
    enabled: !!page?.currentContent,
  });

  // Fetch content from WordPress
  // Tries client-side first (browser → WP, bypasses server IP blocks by Wordfence),
  // then falls back to server-side fetch.
  const fetchContentMutation = useMutation({
    mutationFn: async () => {
      // Client-side WP fetch: browser requests are not blocked by Wordfence IP rules
      if (page?.wpUrl && page?.url) {
        try {
          const slug = new URL(page.url).pathname.split('/').filter(Boolean).pop() || '';
          const baseURL = page.wpUrl.replace(/\/$/, '') + '/wp-json/wp/v2';

          let wpPost: { id: number; title: { rendered: string }; content: { rendered: string } } | null = null;

          // Try posts endpoint
          const postsRes = await fetch(`${baseURL}/posts?slug=${encodeURIComponent(slug)}&_embed=false`);
          if (postsRes.ok) {
            const posts = await postsRes.json();
            if (Array.isArray(posts) && posts.length > 0) wpPost = posts[0];
          }

          // Try pages endpoint if post not found
          if (!wpPost) {
            const pagesRes = await fetch(`${baseURL}/pages?slug=${encodeURIComponent(slug)}&_embed=false`);
            if (pagesRes.ok) {
              const pages = await pagesRes.json();
              if (Array.isArray(pages) && pages.length > 0) wpPost = pages[0];
            }
          }

          if (wpPost) {
            // Send pre-fetched content to backend to store
            return wordpressApi.fetchContent(id, {
              content: wpPost.content.rendered,
              title: wpPost.title.rendered,
              wpPostId: wpPost.id,
            });
          }
        } catch {
          // Client-side fetch failed, fall through to server-side
        }
      }
      // Server-side fallback
      return wordpressApi.fetchContent(id);
    },
    onSuccess: () => {
      toast.success('Content fetched from WordPress');
      queryClient.invalidateQueries({ queryKey: ['page', id] });
    },
    onError: () => toast.error('Failed to fetch content from WordPress'),
  });

  // AI Optimization
  const optimizeMutation = useMutation({
    mutationFn: () => optimizerApi.optimize(id, provider),
    onSuccess: (res) => {
      const result = res.data;
      setOptimizationResult(result);
      setEditedContent(result.optimizedContent);
      setActiveTab('editor');
      toast.success(
        `Optimization complete! Score improved ${result.scoreBreakdown.improvement > 0 ? '+' : ''}${result.scoreBreakdown.improvement} points`,
        { duration: 4000 }
      );
      queryClient.invalidateQueries({ queryKey: ['page', id] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error || 'Optimization failed');
    },
  });

  // Save edited content
  const saveContentMutation = useMutation({
    mutationFn: () =>
      pagesApi.updateContent(id, { optimizedContent: editedContent }),
    onSuccess: () => {
      toast.success('Content saved');
      queryClient.invalidateQueries({ queryKey: ['page', id] });
    },
    onError: () => toast.error('Failed to save content'),
  });

  // Publish to WordPress
  const publishMutation = useMutation({
    mutationFn: (wpStatus: 'publish' | 'draft') => {
      if (!optimizationResult) throw new Error('No optimization to publish');
      return optimizerApi.publish(optimizationResult.optimizationId, wpStatus);
    },
    onSuccess: (_, wpStatus) => {
      toast.success(wpStatus === 'publish' ? 'Published to WordPress!' : 'Saved as draft in WordPress');
      queryClient.invalidateQueries({ queryKey: ['page', id] });
    },
    onError: () => toast.error('Failed to publish to WordPress'),
  });

  if (pageLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-dark-800 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-96 bg-dark-800 rounded-xl animate-pulse" />
          <div className="h-96 bg-dark-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6 text-center">
        <p className="text-dark-300">Page not found</p>
        <Link href="/dashboard/pages" className="text-brand-400 text-sm mt-2 block">
          Back to pages
        </Link>
      </div>
    );
  }

  const displayedScore = optimizationResult?.scoreBreakdown.after || currentScore;
  const scoreImprovement = optimizationResult?.scoreBreakdown.improvement;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-dark-700 bg-dark-900/50 sticky top-0 z-10">
        <Link
          href="/dashboard/pages"
          className="flex items-center gap-1.5 text-dark-400 hover:text-dark-200 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Pages
        </Link>
        <ChevronRight className="w-3 h-3 text-dark-600" />
        <span className="text-dark-300 text-sm truncate max-w-xs">
          {truncateUrl(page.url, 50)}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={page.status} />
          {page.avgPosition && <PositionBadge position={Number(page.avgPosition)} />}
          {page.contentScore != null && (
            <span className={`text-sm font-bold ${getScoreColor(page.contentScore)}`}>
              {page.contentScore}/100
            </span>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Page info bar */}
        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-dark-800 border border-dark-700">
          <Globe className="w-4 h-4 text-dark-500 shrink-0" />
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-dark-300 hover:text-brand-300 truncate flex-1 transition-colors"
          >
            {page.url}
          </a>
          {page.lastOptimizedAt && (
            <span className="text-xs text-dark-500 shrink-0">
              Last optimized {formatRelativeDate(page.lastOptimizedAt)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main editor area */}
          <div className="xl:col-span-2 space-y-5">
            {/* Provider + Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex bg-dark-800 rounded-lg border border-dark-700 p-1 gap-1">
                {(['claude', 'openai'] as AIProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      provider === p
                        ? 'bg-dark-700 text-dark-100'
                        : 'text-dark-500 hover:text-dark-300'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    {p === 'claude' ? 'Claude 3.5' : 'GPT-4o'}
                  </button>
                ))}
              </div>

              {!page.currentContent && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchContentMutation.mutate()}
                  loading={fetchContentMutation.isPending}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Fetch from WP
                </Button>
              )}

              <Button
                onClick={() => optimizeMutation.mutate()}
                loading={optimizeMutation.isPending}
                disabled={!page.currentContent}
                leftIcon={<Sparkles className="w-4 h-4" />}
                size="sm"
              >
                {optimizeMutation.isPending ? 'Optimizing...' : 'Run AI Optimization'}
              </Button>

              {optimizationResult && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => saveContentMutation.mutate()}
                    loading={saveContentMutation.isPending}
                  >
                    Save Changes
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => publishMutation.mutate('draft')}
                    loading={publishMutation.isPending}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Save Draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => publishMutation.mutate('publish')}
                    loading={publishMutation.isPending}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                    variant="primary"
                    className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30"
                  >
                    Publish to WP
                  </Button>
                </>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-dark-900 rounded-lg border border-dark-700 p-1 w-fit">
              {[
                { key: 'editor', label: 'Editor' },
                { key: 'comparison', label: 'Before/After' },
                { key: 'score', label: 'Score Details' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-dark-700 text-dark-100'
                      : 'text-dark-500 hover:text-dark-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'editor' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card padding="none" className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide">
                      Original Content
                    </h3>
                    <Badge variant="default">Before</Badge>
                  </div>
                  <div className="p-4">
                    <ContentEditor
                      value={page.currentContent || ''}
                      onChange={() => {}}
                      readOnly
                      placeholder="No content yet. Click 'Fetch from WP' to load content from WordPress."
                    />
                  </div>
                </Card>

                <Card padding="none" className="overflow-hidden">
                  <div className="px-4 py-3 border-b border-dark-700 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wide">
                      Optimized Content
                    </h3>
                    {scoreImprovement != null && (
                      <Badge variant={scoreImprovement > 0 ? 'success' : 'default'}>
                        {scoreImprovement > 0 ? '+' : ''}{scoreImprovement} pts
                      </Badge>
                    )}
                  </div>
                  <div className="p-4">
                    <ContentEditor
                      value={editedContent || page.optimizedContent || ''}
                      onChange={setEditedContent}
                      placeholder="Run AI Optimization to generate optimized content..."
                    />
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'comparison' && (
              <Card>
                <BeforeAfterPreview
                  originalContent={page.currentContent || ''}
                  optimizedContent={editedContent || page.optimizedContent || ''}
                />
              </Card>
            )}

            {activeTab === 'score' && (
              <Card>
                <ContentScore
                  score={displayedScore || null}
                  loading={scoreLoading}
                />
              </Card>
            )}

            {/* AI Suggestions */}
            {optimizationResult?.suggestions && optimizationResult.suggestions.length > 0 && (
              <Card className="border-brand-500/15">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-brand-400" />
                      AI Optimization Notes
                    </div>
                  </CardTitle>
                  <Badge variant="info">{optimizationResult.provider}</Badge>
                </CardHeader>
                <ul className="space-y-1.5">
                  {optimizationResult.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-dark-300">
                      <span className="text-brand-400 mt-0.5">•</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Content Score */}
            <Card>
              <CardHeader>
                <CardTitle>Content Score</CardTitle>
                {optimizationResult && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-dark-500">
                      {optimizationResult.scoreBreakdown.before.total}
                    </span>
                    <span className="text-dark-600">→</span>
                    <span className={`text-xs font-bold ${getScoreColor(optimizationResult.scoreBreakdown.after.total)}`}>
                      {optimizationResult.scoreBreakdown.after.total}
                    </span>
                  </div>
                )}
              </CardHeader>
              <ContentScore
                score={displayedScore || null}
                loading={scoreLoading && !optimizationResult}
                compact={false}
              />
            </Card>

            {/* Keywords */}
            <Card>
              <CardHeader>
                <CardTitle>Target Keywords</CardTitle>
                <span className="text-xs text-dark-500">{keywords.length} found</span>
              </CardHeader>
              <KeywordSuggestions
                keywords={keywords}
                targeted={targetedKeywords}
              />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
