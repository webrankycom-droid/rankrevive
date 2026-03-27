'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FileText, Globe, TrendingUp, DollarSign, Search, Settings, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
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

const SETTING_FIELDS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', placeholder: 'sk-ant-...', group: 'AI Keys' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', placeholder: 'sk-...', group: 'AI Keys' },
  { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key', placeholder: 'sk_live_...', group: 'Stripe' },
  { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook Secret', placeholder: 'whsec_...', group: 'Stripe' },
  { key: 'STRIPE_STARTER_PRICE_ID', label: 'Starter Price ID', placeholder: 'price_...', group: 'Stripe Prices' },
  { key: 'STRIPE_PRO_PRICE_ID', label: 'Pro Price ID', placeholder: 'price_...', group: 'Stripe Prices' },
  { key: 'STRIPE_AGENCY_PRICE_ID', label: 'Agency Price ID', placeholder: 'price_...', group: 'Stripe Prices' },
];

function ConfigurationTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const toSave = Object.entries(values)
        .filter(([, v]) => v.trim())
        .map(([key, value]) => ({ key, value }));
      return adminApi.updateSettings(toSave);
    },
    onSuccess: () => {
      toast.success('Settings saved successfully');
      setValues({});
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const settings = settingsData?.settings || [];
  const settingMap = new Map(settings.map((s) => [s.key, s]));

  const groups = ['AI Keys', 'Stripe', 'Stripe Prices'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-dark-100">API Configuration</h2>
          <p className="text-xs text-dark-500 mt-0.5">
            Set API keys below. Environment variables take priority over DB values.
          </p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          loading={saveMutation.isPending}
          disabled={Object.values(values).every((v) => !v.trim())}
          size="sm"
        >
          Save Changes
        </Button>
      </div>

      {groups.map((group) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{group}</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {SETTING_FIELDS.filter((f) => f.group === group).map((field) => {
              const s = settingMap.get(field.key);
              const inputVal = values[field.key] ?? '';
              const show = showKeys[field.key];

              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-dark-300">{field.label}</label>
                    <div className="flex items-center gap-2">
                      {isLoading ? (
                        <div className="h-4 w-16 bg-dark-700 rounded animate-pulse" />
                      ) : s?.isSet ? (
                        <span className="flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          {s.source === 'env' ? 'via env' : 'saved'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <AlertCircle className="w-3 h-3" />
                          not set
                        </span>
                      )}
                    </div>
                  </div>

                  {s?.isSet && !inputVal && (
                    <div className="mb-2 flex items-center gap-2">
                      <code className="text-xs text-dark-400 bg-dark-800 px-2 py-1 rounded flex-1 font-mono">
                        {show ? (s.source === 'env' ? '(from environment variable)' : s.maskedValue) : s.maskedValue}
                      </code>
                      <button
                        onClick={() => setShowKeys((p) => ({ ...p, [field.key]: !show }))}
                        className="text-dark-500 hover:text-dark-300"
                      >
                        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setValues((p) => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={s?.isSet ? 'Enter new value to update...' : field.placeholder}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 placeholder-dark-600 focus:outline-none focus:border-brand-500/50 font-mono"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'config'>('overview');
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
        {/* Tabs */}
        <div className="flex gap-1 bg-dark-800 p-1 rounded-lg w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'config', label: 'Configuration', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as 'overview' | 'config')}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === id
                  ? 'bg-dark-700 text-dark-100'
                  : 'text-dark-400 hover:text-dark-200'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'config' && <ConfigurationTab />}

        {activeTab === 'overview' && (
          <>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resetUsageMutation.mutate()}
                    loading={resetUsageMutation.isPending}
                  >
                    Reset Usage
                  </Button>
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
          </>
        )}
      </div>
    </div>
  );
}
