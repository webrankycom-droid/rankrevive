'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText, Sparkles, TrendingUp, Eye,
  RefreshCw, Globe, Plus, ArrowRight,
} from 'lucide-react';
import Header from '@/components/dashboard/Header';
import StatsCard from '@/components/dashboard/StatsCard';
import PageTable from '@/components/dashboard/PageTable';
import TrafficChart from '@/components/charts/TrafficChart';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { pagesApi, gscApi, sitesApi } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function DashboardPage() {
  const [syncing, setSyncing] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list().then((r) => r.data),
  });

  const sites = sitesData?.sites || [];

  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const { data: pagesData, isLoading: pagesLoading, refetch: refetchPages } = useQuery({
    queryKey: ['pages', selectedSiteId],
    queryFn: () => pagesApi.list({ siteId: selectedSiteId || undefined, limit: 10 }).then((r) => r.data),
    enabled: !!selectedSiteId,
  });

  const { data: gscOverview, isLoading: overviewLoading } = useQuery({
    queryKey: ['gsc-overview', selectedSiteId],
    queryFn: () => gscApi.getOverview(selectedSiteId!).then((r) => r.data),
    enabled: !!selectedSiteId,
  });

  const { data: dailyTrafficData, isLoading: trafficLoading } = useQuery({
    queryKey: ['gsc-daily', selectedSiteId],
    queryFn: () => gscApi.getDailyTraffic(selectedSiteId!).then((r) => r.data),
    enabled: !!selectedSiteId,
  });

  async function handleSync() {
    if (!selectedSiteId) return;
    setSyncing(true);
    try {
      const result = await gscApi.syncSite(selectedSiteId).then((r) => r.data);
      toast.success(`Synced ${result.synced} pages from Google Search Console`);
      refetchPages();
    } catch {
      toast.error('Sync failed. Check your GSC connection.');
    } finally {
      setSyncing(false);
    }
  }

  const pages = pagesData?.pages || [];
  const totalPages = pagesData?.total || 0;
  const optimizedPages = pages.filter((p) => p.status === 'optimized' || p.status === 'published').length;

  const chartData = dailyTrafficData?.data || [];

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle={selectedSiteId ? sites.find(s => s.id === selectedSiteId)?.domain : undefined}
        action={
          selectedSiteId
            ? { label: 'Sync GSC', onClick: handleSync, loading: syncing }
            : undefined
        }
      />

      <div className="p-6 space-y-6">
        {/* No sites CTA */}
        {sites.length === 0 && (
          <Card className="border-brand-500/20 bg-brand-500/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-brand-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Connect your first site</h3>
                <p className="text-dark-400 text-sm mt-0.5">
                  Add your website and connect Google Search Console to start recovering rankings.
                </p>
              </div>
              <Link href="/dashboard/settings">
                <Button rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Get Started
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Site selector */}
        {sites.length > 1 && (
          <div className="flex items-center gap-2">
            {sites.map((site) => (
              <button
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedSiteId === site.id
                    ? 'bg-brand-500/15 text-brand-300 border-brand-500/30'
                    : 'bg-dark-800 text-dark-400 border-dark-700 hover:text-dark-200'
                }`}
              >
                {site.domain}
              </button>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Total Pages"
            value={formatNumber(totalPages)}
            icon={FileText}
            subtitle="Tracked from GSC"
            loading={pagesLoading}
          />
          <StatsCard
            title="Avg Position"
            value={gscOverview?.avgPosition?.toFixed(1) ?? '—'}
            icon={TrendingUp}
            variant="brand"
            subtitle="Last 90 days"
            loading={overviewLoading}
          />
          <StatsCard
            title="Pages Optimized"
            value={formatNumber(optimizedPages)}
            icon={Sparkles}
            variant="success"
            subtitle={`of ${totalPages} total`}
            loading={pagesLoading}
          />
          <StatsCard
            title="Total Impressions"
            value={formatNumber(gscOverview?.totalImpressions ?? 0)}
            icon={Eye}
            variant="warning"
            subtitle="Last 90 days"
            loading={overviewLoading}
          />
        </div>

        {/* Traffic Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic Overview</CardTitle>
            <span className="text-xs text-dark-500">Last 30 days</span>
          </CardHeader>
          <TrafficChart data={chartData} loading={trafficLoading} />
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-dark-700">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-400" />
              <span className="text-xs text-dark-400">Clicks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-xs text-dark-400">Impressions</span>
            </div>
          </div>
        </Card>

        {/* Pages Table */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
            <div>
              <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wide">
                Pages
              </h3>
              <p className="text-xs text-dark-500 mt-0.5">
                {totalPages} total · showing {pages.length}
              </p>
            </div>
            <Link href="/dashboard/pages">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View all
              </Button>
            </Link>
          </div>
          <PageTable
            pages={pages}
            loading={pagesLoading}
            onSync={() => handleSync()}
          />
        </Card>
      </div>
    </div>
  );
}
