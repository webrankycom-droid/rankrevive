'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import {
  Globe, Search, Plug, CreditCard, User,
  Check, Link2, Shield, ExternalLink
} from 'lucide-react';
import Header from '@/components/dashboard/Header';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { sitesApi, gscApi, wordpressApi, authApi, billingApi } from '@/lib/api';
import { PLANS } from '@/lib/constants';
import toast from 'react-hot-toast';
import type { Site } from '@/types';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [activeSection, setActiveSection] = useState('sites');

  // New site form
  const [newDomain, setNewDomain] = useState('');
  const [addingSite, setAddingSite] = useState(false);

  // WP connection form
  const [wpForm, setWpForm] = useState({
    siteId: '',
    wpUrl: '',
    wpUsername: '',
    wpAppPassword: '',
  });
  const [testingWP, setTestingWP] = useState(false);

  // Account form
  const [accountForm, setAccountForm] = useState({
    name: session?.user?.name || '',
  });
  const [savingAccount, setSavingAccount] = useState(false);

  // Billing state
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesApi.list().then((r) => r.data),
  });

  const { data: billingStatus } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => billingApi.getStatus().then((r) => r.data),
    enabled: activeSection === 'billing',
  });

  const sites: Site[] = sitesData?.sites || [];
  const currentPlan = billingStatus?.plan || session?.user?.plan || 'starter';

  async function handleAddSite() {
    if (!newDomain.trim()) return;
    setAddingSite(true);
    try {
      await sitesApi.create({ domain: newDomain.trim() });
      toast.success('Site added!');
      setNewDomain('');
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch {
      toast.error('Failed to add site');
    } finally {
      setAddingSite(false);
    }
  }

  async function handleConnectGSC(siteId: string) {
    const { data } = await gscApi.getAuthUrl(siteId);
    if (data.url) window.location.href = data.url;
  }

  async function handleTestWP() {
    if (!wpForm.siteId || !wpForm.wpUrl) {
      toast.error('Fill in all WordPress fields');
      return;
    }
    setTestingWP(true);
    try {
      const res = await wordpressApi.test(wpForm.siteId);
      if (res.data.success) {
        toast.success(`Connected to "${res.data.siteTitle}"!`);
      } else {
        toast.error(res.data.error || 'Connection failed');
      }
    } catch {
      toast.error('Failed to test connection');
    } finally {
      setTestingWP(false);
    }
  }

  async function handleSaveWP() {
    try {
      await wordpressApi.connect(
        wpForm.siteId,
        wpForm.wpUrl,
        wpForm.wpUsername,
        wpForm.wpAppPassword
      );
      toast.success('WordPress connected successfully!');
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch {
      toast.error('Failed to save WordPress settings');
    }
  }

  async function handleSaveAccount() {
    if (!accountForm.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    setSavingAccount(true);
    try {
      await authApi.updateProfile({ name: accountForm.name.trim() });
      toast.success('Account updated');
    } catch {
      toast.error('Failed to update account');
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleCheckout(plan: string) {
    setCheckoutLoading(plan);
    try {
      const res = await billingApi.createCheckout(plan);
      if (res.data.url) window.location.href = res.data.url;
    } catch {
      toast.error('Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await billingApi.createPortal();
      if (res.data.url) window.location.href = res.data.url;
    } catch {
      toast.error('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const sections = [
    { id: 'sites', label: 'Sites', icon: Globe },
    { id: 'gsc', label: 'Search Console', icon: Search },
    { id: 'wordpress', label: 'WordPress', icon: Plug },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'account', label: 'Account', icon: User },
  ];

  return (
    <div>
      <Header title="Settings" subtitle="Manage your sites, integrations, and account" />

      <div className="p-6 flex gap-6">
        {/* Left nav */}
        <nav className="w-48 shrink-0">
          <ul className="space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActiveSection(s.id)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? 'bg-brand-500/15 text-brand-300'
                      : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                  }`}
                >
                  <s.icon className="w-4 h-4 shrink-0" />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-5">
          {/* Sites */}
          {activeSection === 'sites' && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Add New Site</CardTitle>
                </CardHeader>
                <div className="flex gap-3">
                  <Input
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    leftIcon={<Globe className="w-4 h-4" />}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSite()}
                  />
                  <Button onClick={handleAddSite} loading={addingSite}>
                    Add Site
                  </Button>
                </div>
              </Card>

              <Card padding="none">
                <div className="px-5 py-4 border-b border-dark-700">
                  <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wide">
                    Your Sites ({sites.length})
                  </h3>
                </div>
                <ul className="divide-y divide-dark-700/50">
                  {sitesLoading
                    ? [...Array(3)].map((_, i) => (
                        <li key={i} className="px-5 py-4">
                          <div className="h-4 bg-dark-700 rounded animate-pulse w-48" />
                        </li>
                      ))
                    : sites.map((site) => (
                        <li key={site.id} className="flex items-center gap-4 px-5 py-4">
                          <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-dark-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-dark-200">{site.domain}</p>
                            <p className="text-xs text-dark-500">{site.pageCount || 0} pages tracked</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {site.gscProperty ? (
                              <Badge variant="success" dot>GSC Connected</Badge>
                            ) : (
                              <Badge variant="default" dot>GSC Not Connected</Badge>
                            )}
                            {site.wpUrl ? (
                              <Badge variant="success" dot>WP Connected</Badge>
                            ) : (
                              <Badge variant="default" dot>WP Not Connected</Badge>
                            )}
                          </div>
                        </li>
                      ))}
                  {!sitesLoading && sites.length === 0 && (
                    <li className="px-5 py-8 text-center">
                      <p className="text-dark-400 text-sm">No sites added yet</p>
                    </li>
                  )}
                </ul>
              </Card>
            </>
          )}

          {/* GSC */}
          {activeSection === 'gsc' && (
            <Card>
              <CardHeader>
                <CardTitle>Google Search Console</CardTitle>
                <Badge variant="info">OAuth2</Badge>
              </CardHeader>
              <p className="text-sm text-dark-400 mb-5">
                Connect Google Search Console to automatically import pages, keywords, and performance data.
              </p>
              <div className="space-y-3">
                {sites.map((site) => (
                  <div key={site.id} className="flex items-center gap-4 p-3 rounded-lg bg-dark-900 border border-dark-700">
                    <Globe className="w-4 h-4 text-dark-500 shrink-0" />
                    <span className="text-sm text-dark-200 flex-1">{site.domain}</span>
                    {site.gscProperty ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="success" dot>Connected</Badge>
                        <span className="text-xs text-dark-500">{site.gscProperty}</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleConnectGSC(site.id)}
                        leftIcon={<Link2 className="w-3.5 h-3.5" />}
                      >
                        Connect GSC
                      </Button>
                    )}
                  </div>
                ))}
                {sites.length === 0 && (
                  <p className="text-dark-500 text-sm text-center py-4">Add a site first to connect GSC</p>
                )}
              </div>
            </Card>
          )}

          {/* WordPress */}
          {activeSection === 'wordpress' && (
            <Card>
              <CardHeader>
                <CardTitle>WordPress Integration</CardTitle>
                <Badge variant="default">REST API</Badge>
              </CardHeader>
              <p className="text-sm text-dark-400 mb-5">
                Connect WordPress to fetch content and publish optimizations directly. Uses Application Passwords (WP 5.6+).
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-dark-300 mb-1.5 block">Select Site</label>
                  <select
                    value={wpForm.siteId}
                    onChange={(e) => setWpForm({ ...wpForm, siteId: e.target.value })}
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3.5 py-2.5 text-sm text-dark-100 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    <option value="">Select site...</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.domain}</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="WordPress URL"
                  value={wpForm.wpUrl}
                  onChange={(e) => setWpForm({ ...wpForm, wpUrl: e.target.value })}
                  placeholder="https://yoursite.com"
                  leftIcon={<Globe className="w-4 h-4" />}
                />
                <Input
                  label="Username"
                  value={wpForm.wpUsername}
                  onChange={(e) => setWpForm({ ...wpForm, wpUsername: e.target.value })}
                  placeholder="admin"
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Application Password"
                  type="password"
                  value={wpForm.wpAppPassword}
                  onChange={(e) => setWpForm({ ...wpForm, wpAppPassword: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  leftIcon={<Shield className="w-4 h-4" />}
                  hint="Generate from WP Admin → Users → Profile → Application Passwords"
                />
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" onClick={handleTestWP} loading={testingWP}>
                    Test Connection
                  </Button>
                  <Button size="sm" onClick={handleSaveWP}>
                    Save WordPress Settings
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Billing */}
          {activeSection === 'billing' && (
            <div className="space-y-4">
              {billingStatus && billingStatus.status === 'active' && (
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-dark-200">
                        Current Plan: <span className="text-emerald-400 capitalize">{billingStatus.plan}</span>
                      </p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {billingStatus.pagesUsed} / {billingStatus.pagesLimit} pages used this month
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleBillingPortal}
                      loading={portalLoading}
                      leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                    >
                      Manage Billing
                    </Button>
                  </div>
                </Card>
              )}
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(PLANS).map(([key, plan]) => {
                  const isCurrent = key === currentPlan;
                  return (
                    <Card
                      key={key}
                      className={key === 'pro' ? 'border-brand-500/40' : isCurrent ? 'border-emerald-500/30' : ''}
                    >
                      {key === 'pro' && (
                        <div className="mb-3">
                          <Badge variant="info">Most Popular</Badge>
                        </div>
                      )}
                      {isCurrent && key !== 'pro' && (
                        <div className="mb-3">
                          <Badge variant="success">Current Plan</Badge>
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">${plan.price}</span>
                        <span className="text-dark-400 text-sm">/mo</span>
                      </div>
                      <ul className="space-y-2 mb-5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-dark-300">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant={key === 'pro' ? 'primary' : 'secondary'}
                        className="w-full"
                        size="sm"
                        disabled={isCurrent}
                        loading={checkoutLoading === key}
                        onClick={() => !isCurrent && handleCheckout(key)}
                      >
                        {isCurrent ? 'Current Plan' : `Upgrade to ${plan.name}`}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account */}
          {activeSection === 'account' && (
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <div className="space-y-4 max-w-sm">
                <Input
                  label="Display Name"
                  value={accountForm.name || session?.user?.name || ''}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  placeholder="Your name"
                  leftIcon={<User className="w-4 h-4" />}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={session?.user?.email || ''}
                  disabled
                  placeholder="you@company.com"
                  hint="Email cannot be changed here"
                />
                <Button onClick={handleSaveAccount} loading={savingAccount}>
                  Save Changes
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
