import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession } from 'next-auth/react';
import type {
  Page,
  Keyword,
  Optimization,
  OptimizationResult,
  ContentScoreBreakdown,
  ContentBrief,
  Site,
  GSCOverview,
  SubscriptionStatus,
  AdminStats,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  client.interceptors.request.use(async (config) => {
    const session = await getSession();
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err: AxiosError) => {
      if (err.response?.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(err);
    }
  );

  return client;
}

export const apiClient = createApiClient();

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; user: Record<string, unknown> }>('/auth/login', { email, password }),

  register: (email: string, password: string, name: string) =>
    apiClient.post<{ token: string; user: Record<string, unknown> }>('/auth/register', { email, password, name }),

  me: () => apiClient.get('/auth/me'),

  updateProfile: (data: { name?: string; avatarUrl?: string }) =>
    apiClient.put('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
};

// ─── Sites ────────────────────────────────────────────────────────────────────

export const sitesApi = {
  list: () => apiClient.get<{ sites: Site[] }>('/pages/sites/list'),

  create: (data: { domain: string; wpUrl?: string; wpUsername?: string; wpAppPassword?: string }) =>
    apiClient.post<Site>('/pages/sites', data),
};

// ─── Pages ───────────────────────────────────────────────────────────────────

export const pagesApi = {
  list: (params?: { siteId?: string; status?: string; search?: string; page?: number; limit?: number }) =>
    apiClient.get<{ pages: Page[]; total: number }>('/pages', { params }),

  getById: (id: string) =>
    apiClient.get<Page & { keywords: Keyword[]; optimizations: Optimization[] }>(`/pages/${id}`),

  updateContent: (id: string, data: { currentContent?: string; optimizedContent?: string }) =>
    apiClient.put(`/pages/${id}/content`, data),

  delete: (id: string) => apiClient.delete(`/pages/${id}`),
};

// ─── GSC ─────────────────────────────────────────────────────────────────────

export const gscApi = {
  getAuthUrl: (siteId: string) => apiClient.get<{ url: string }>('/gsc/auth-url', { params: { siteId } }),

  listProperties: (siteId: string) =>
    apiClient.get<{ properties: string[] }>('/gsc/properties', { params: { siteId } }),

  disconnect: (siteId: string) =>
    apiClient.delete<{ success: boolean }>(`/gsc/disconnect/${siteId}`),

  syncSite: (siteId: string) =>
    apiClient.post<{ success: boolean; synced: number; errors: number }>(`/gsc/sync/${siteId}`),

  getKeywords: (pageId: string) =>
    apiClient.get<{ keywords: Keyword[] }>(`/gsc/keywords/${pageId}`),

  getOverview: (siteId: string) =>
    apiClient.get<GSCOverview>(`/gsc/overview/${siteId}`),

  getDailyTraffic: (siteId: string, days = 30) =>
    apiClient.get<{ data: Array<{ date: string; clicks: number; impressions: number }> }>(
      `/gsc/daily/${siteId}`,
      { params: { days } }
    ),
};

// ─── Optimizer ───────────────────────────────────────────────────────────────

export const optimizerApi = {
  optimize: (pageId: string, provider: 'claude' | 'openai' = 'claude') =>
    apiClient.post<OptimizationResult>(`/optimizer/${pageId}/optimize`, { provider }),

  getBrief: (pageId: string) =>
    apiClient.get<ContentBrief>(`/optimizer/${pageId}/brief`),

  score: (pageId: string, contentType: 'current' | 'optimized' = 'current') =>
    apiClient.get<ContentScoreBreakdown>(`/optimizer/${pageId}/score`, { params: { contentType } }),

  generateMetaTags: (pageId: string) =>
    apiClient.post<{ title: string; description: string; ogTitle: string; ogDescription: string }>(
      `/optimizer/${pageId}/meta-tags`
    ),

  publish: (optimizationId: string, status: 'publish' | 'draft' = 'draft') =>
    apiClient.put<{ success: boolean; wpPostId: number; link: string }>(
      `/optimizer/${optimizationId}/publish`,
      { status }
    ),

  getHistory: (page = 1, limit = 20) =>
    apiClient.get<{ optimizations: Optimization[]; total: number }>(
      '/optimizer/history/list',
      { params: { page, limit } }
    ),
};

// ─── WordPress ───────────────────────────────────────────────────────────────

export const wordpressApi = {
  connect: (siteId: string, wpUrl: string, wpUsername: string, wpAppPassword: string) =>
    apiClient.post('/wordpress/connect', { siteId, wpUrl, wpUsername, wpAppPassword }),

  testDirect: (wpUrl: string, wpUsername: string, wpAppPassword: string) =>
    apiClient.post<{ success: boolean; siteTitle?: string; error?: string }>(
      '/wordpress/test-direct',
      { wpUrl, wpUsername, wpAppPassword }
    ),

  test: (siteId: string) =>
    apiClient.get<{ success: boolean; siteTitle?: string; error?: string }>(
      `/wordpress/test/${siteId}`
    ),

  listPosts: (siteId: string, limit = 20) =>
    apiClient.get(`/wordpress/posts/${siteId}`, { params: { limit } }),

  fetchContent: (
    pageId: string,
    prefetched?: { content: string; title: string; wpPostId: number }
  ) =>
    apiClient.post<{ success: boolean; content: string; title: string; wpPostId: number }>(
      '/wordpress/fetch-content',
      { pageId, ...prefetched }
    ),
};

// ─── Billing ─────────────────────────────────────────────────────────────────

export const billingApi = {
  getStatus: () => apiClient.get<SubscriptionStatus>('/billing/status'),

  createCheckout: (plan: string) =>
    apiClient.post<{ url: string }>('/billing/checkout', { plan }),

  createPortal: () => apiClient.post<{ url: string }>('/billing/portal'),
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export const adminApi = {
  getStats: () => apiClient.get<AdminStats>('/admin/stats'),

  listUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get('/admin/users', { params }),

  updateUser: (id: string, data: { plan?: string; isAdmin?: boolean; pagesUsedThisMonth?: number }) =>
    apiClient.patch(`/admin/users/${id}`, data),

  getRevenue: () => apiClient.get('/admin/revenue'),

  getSettings: () =>
    apiClient.get<{
      settings: Array<{ key: string; label: string; maskedValue: string; source: string; isSet: boolean }>;
    }>('/admin/settings'),

  updateSettings: (settings: Array<{ key: string; value: string }>) =>
    apiClient.put<{ success: boolean }>('/admin/settings', { settings }),
};
