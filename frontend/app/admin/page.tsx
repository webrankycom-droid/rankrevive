'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FileText, Globe, TrendingUp, DollarSign, Search } from 'lucide-react';
import Header from '@/components/dashboard/Header';
import StatsCard from '@/components/dashboard/StatsCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { adminApi, apiClient } from '@/lib/api';
import { formatDate, formatNumber, getPlanBadgeClass } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats().then((r) => r.data),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', userSearch],
    queryFn: () => adminApi.listUsers({ search: userSearch || undefined, limit: 30 }).then((r) => r.data),
  });

  const { data: revenueData } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => adminApi.getRevenue().then((r) => r.data),
  });

  const resetUsageMutation = useMutation({
    mutationFn: () => apiClient.post('/admin/reset-monthly-usage'),
    onSuccess: () => {
      toast.success('Monthly usage reset for all users');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: () => toast.error('Failed to reset usage'),
  });

  const users = (usersData as { users?: unknown[] })?.users || [];

  return (
    <div>
      <Header title="Admin Panel" subtitle="Platform overview and user management" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={formatNumber(stats?.users.total || 0)}
            icon={Users}
            subtitle={`${stats?.users.newToday || 0} new today`}
            loading={statsLoading}
            variant="brand"
          />
          <StatsCard
            title="Total Pages"
            value={formatNumber(stats?.pages.total || 0)}
            icon={FileText}
            subtitle={`${stats?.pages.optimized || 0} optimized`}
            loading={statsLoading}
          />
          <StatsCard
            title="Total Sites"
            value={formatNumber(stats?.sites.total || 0)}
            icon={Globe}
            loading={statsLoading}
          />
          <StatsCard
            title="MRR"
            value={`$${formatNumber(revenueData?.mrr || 0)}`}
            icon={DollarSign}
            subtitle={`$${formatNumber(revenueData?.arr || 0)} ARR`}
            variant="success"
            loading={!revenueData}
          />
        </div>

        {/* Plan distribution */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Plan Distribution</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-4">
              {[
                { plan: 'Starter', count: stats.users.starter, color: 'bg-dark-400' },
                { plan: 'Pro', count: stats.users.pro, color: 'bg-brand-400' },
                { plan: 'Agency', count: stats.users.agency, color: 'bg-purple-400' },
              ].map((p) => {
                const pct = stats.users.total > 0
                  ? Math.round((p.count / stats.users.total) * 100)
                  : 0;
                return (
                  <div key={p.plan} className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">{p.count}</div>
                    <div className="text-sm text-dark-400 mb-2">{p.plan}</div>
                    <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', p.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs text-dark-500 mt-1">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Users table */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-700">
            <CardTitle>Users</CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="pl-8 pr-3 py-1.5 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-brand-500/50 w-48"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Plan</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Pages Used</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Joined</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-dark-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading
                  ? [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-dark-700/50">
                        {[...Array(5)].map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-dark-700 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (users as Array<{
                      id: string;
                      email: string;
                      name: string;
                      plan: string;
                      pages_used_this_month: number;
                      created_at: string;
                      is_admin: boolean;
                    }>).map((user) => (
                      <tr key={user.id} className="border-b border-dark-700/50 hover:bg-dark-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-dark-200">{user.name || '—'}</p>
                          <p className="text-xs text-dark-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full border font-medium capitalize',
                            getPlanBadgeClass(user.plan)
                          )}>
                            {user.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-dark-300 tabular-nums">
                          {user.pages_used_this_month}
                        </td>
                        <td className="px-4 py-3 text-xs text-dark-400">
                          {formatDate(user.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {['starter', 'pro', 'agency'].map((plan) => (
                              plan !== user.plan && (
                                <button
                                  key={plan}
                                  onClick={() => adminApi.updateUser(user.id, { plan }).then(() => {
                                    toast.success(`User upgraded to ${plan}`);
                                    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
                                  })}
                                  className="text-xs px-2 py-1 rounded bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 capitalize"
                                >
                                  → {plan}
                                </button>
                              )
                            ))}
                          </div>
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
