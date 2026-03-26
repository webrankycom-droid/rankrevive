import { google, searchconsole_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { query, queryOne, cacheGet, cacheSet } from '../db';

const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.FRONTEND_URL}/api/auth/callback/google-gsc`
);

export interface GSCPage {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCKeyword {
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageWithKeywords extends GSCPage {
  keywords: GSCKeyword[];
}

export function getAuthUrl(userId: string): string {
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: userId,
    prompt: 'consent',
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from Google');
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

function getOAuthClientForSite(accessToken: string, refreshToken: string): OAuth2Client {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.FRONTEND_URL}/api/auth/callback/google-gsc`
  );
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return client;
}

export async function listProperties(
  accessToken: string,
  refreshToken: string
): Promise<string[]> {
  const client = getOAuthClientForSite(accessToken, refreshToken);
  const searchConsole = google.searchconsole({ version: 'v1', auth: client });

  const response = await searchConsole.sites.list();
  const sites = response.data.siteEntry || [];
  return sites.map((s) => s.siteUrl || '').filter(Boolean);
}

export async function fetchAllPages(
  siteId: string,
  accessToken: string,
  refreshToken: string,
  gscProperty: string
): Promise<GSCPage[]> {
  const cacheKey = `gsc:pages:${siteId}`;
  const cached = await cacheGet<GSCPage[]>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClientForSite(accessToken, refreshToken);
  const searchConsole = google.searchconsole({ version: 'v1', auth: client });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90); // Last 3 months

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const response = await searchConsole.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['page'],
      rowLimit: 1000,
      dataState: 'final',
    } as searchconsole_v1.Schema$SearchAnalyticsQueryRequest,
  });

  const pages: GSCPage[] = (response.data.rows || []).map((row) => ({
    url: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

  await cacheSet(cacheKey, pages, 1800); // Cache 30 minutes
  return pages;
}

export async function fetchKeywordsForPage(
  pageUrl: string,
  gscProperty: string,
  accessToken: string,
  refreshToken: string
): Promise<GSCKeyword[]> {
  const cacheKey = `gsc:keywords:${encodeURIComponent(pageUrl)}`;
  const cached = await cacheGet<GSCKeyword[]>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClientForSite(accessToken, refreshToken);
  const searchConsole = google.searchconsole({ version: 'v1', auth: client });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const response = await searchConsole.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['query'],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'equals',
              expression: pageUrl,
            },
          ],
        },
      ],
      rowLimit: 100,
      dataState: 'final',
    } as searchconsole_v1.Schema$SearchAnalyticsQueryRequest,
  });

  const allKeywords: GSCKeyword[] = (response.data.rows || []).map((row) => ({
    keyword: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));

  // Filter keywords in position 1-20 (ranking but potentially declining)
  const filteredKeywords = allKeywords
    .filter((k) => k.position >= 1 && k.position <= 20)
    .sort((a, b) => b.impressions - a.impressions);

  await cacheSet(cacheKey, filteredKeywords, 1800);
  return filteredKeywords;
}

export interface GSCDailyTraffic {
  date: string;
  clicks: number;
  impressions: number;
}

export async function fetchDailyTraffic(
  siteId: string,
  accessToken: string,
  refreshToken: string,
  gscProperty: string,
  days = 30
): Promise<GSCDailyTraffic[]> {
  const cacheKey = `gsc:daily:${siteId}:${days}`;
  const cached = await cacheGet<GSCDailyTraffic[]>(cacheKey);
  if (cached) return cached;

  const client = getOAuthClientForSite(accessToken, refreshToken);
  const searchConsole = google.searchconsole({ version: 'v1', auth: client });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const response = await searchConsole.searchanalytics.query({
    siteUrl: gscProperty,
    requestBody: {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      dimensions: ['date'],
      rowLimit: days + 5,
      dataState: 'final',
    } as searchconsole_v1.Schema$SearchAnalyticsQueryRequest,
  });

  const data: GSCDailyTraffic[] = (response.data.rows || []).map((row) => ({
    date: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
  }));

  await cacheSet(cacheKey, data, 1800);
  return data;
}

export async function syncSitePages(siteId: string): Promise<{ synced: number; errors: number }> {
  const site = await queryOne<{
    gsc_property: string;
    gsc_access_token: string;
    gsc_refresh_token: string;
  }>('SELECT gsc_property, gsc_access_token, gsc_refresh_token FROM sites WHERE id = $1', [siteId]);

  if (!site || !site.gsc_property || !site.gsc_access_token) {
    throw new Error('Site not configured with Google Search Console');
  }

  const pages = await fetchAllPages(
    siteId,
    site.gsc_access_token,
    site.gsc_refresh_token,
    site.gsc_property
  );

  let synced = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      // Upsert page
      await query(
        `INSERT INTO pages (site_id, url, status, last_synced_at)
         VALUES ($1, $2, 'pending', NOW())
         ON CONFLICT (site_id, url) DO UPDATE
         SET last_synced_at = NOW()`,
        [siteId, page.url]
      );

      const dbPage = await queryOne<{ id: string }>(
        'SELECT id FROM pages WHERE site_id = $1 AND url = $2',
        [siteId, page.url]
      );

      if (dbPage) {
        // Fetch and store keywords
        const keywords = await fetchKeywordsForPage(
          page.url,
          site.gsc_property,
          site.gsc_access_token,
          site.gsc_refresh_token
        );

        // Delete old keywords for this page
        await query('DELETE FROM keywords WHERE page_id = $1', [dbPage.id]);

        // Insert new keywords
        for (const kw of keywords) {
          await query(
            `INSERT INTO keywords (page_id, keyword, impressions, clicks, ctr, position, date_range)
             VALUES ($1, $2, $3, $4, $5, $6, '90d')`,
            [dbPage.id, kw.keyword, kw.impressions, kw.clicks, kw.ctr, kw.position]
          );
        }
      }

      synced++;
    } catch (err) {
      console.error(`Error syncing page ${page.url}:`, err);
      errors++;
    }
  }

  return { synced, errors };
}

export const gscService = {
  getAuthUrl,
  exchangeCodeForTokens,
  listProperties,
  fetchAllPages,
  fetchDailyTraffic,
  fetchKeywordsForPage,
  syncSitePages,
};
