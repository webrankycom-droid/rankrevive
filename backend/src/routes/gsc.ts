import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { gscService } from '../services/gscService';
import { query, queryOne } from '../db';

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://frontend-omega-tan-81.vercel.app';

// GET /api/gsc/auth-url - Get Google OAuth URL
router.get('/auth-url', authenticate, (req: AuthRequest, res: Response): void => {
  const { siteId } = req.query as { siteId: string };
  if (!siteId) {
    res.status(400).json({ error: 'siteId is required' });
    return;
  }
  const url = gscService.getAuthUrl(req.user!.userId, siteId);
  res.json({ url });
});

// GET /api/gsc/callback - OAuth callback (no auth middleware — Google redirects here directly)
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state, error } = req.query as { code: string; state: string; error?: string };

  if (error) {
    console.error('GSC OAuth error from Google:', error);
    res.redirect(`${FRONTEND_URL}/dashboard/settings?section=gsc&gsc=error`);
    return;
  }

  try {
    const { userId, siteId } = JSON.parse(state);
    const { accessToken, refreshToken } = await gscService.exchangeCodeForTokens(code);

    if (siteId && userId) {
      // Auto-select GSC property by matching the site's domain
      let gscProperty: string | null = null;
      try {
        const site = await queryOne<{ domain: string }>(
          'SELECT domain FROM sites WHERE id = $1 AND user_id = $2',
          [siteId, userId]
        );
        if (site?.domain) {
          const properties = await gscService.listProperties(accessToken, refreshToken);
          const domain = site.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
          // Try sc-domain: prefix first, then https/http URL variants
          gscProperty =
            properties.find((p) => p === `sc-domain:${domain}`) ||
            properties.find((p) => p === `https://${domain}/`) ||
            properties.find((p) => p === `https://${domain}`) ||
            properties.find((p) => p === `http://${domain}/`) ||
            properties.find((p) => p.includes(domain)) ||
            properties[0] ||
            null;
        }
      } catch (propErr) {
        console.error('GSC property auto-select error (non-fatal):', propErr);
      }

      await query(
        `UPDATE sites
         SET gsc_access_token = $1,
             gsc_refresh_token = $2,
             gsc_property = COALESCE($3, gsc_property)
         WHERE id = $4 AND user_id = $5`,
        [accessToken, refreshToken, gscProperty, siteId, userId]
      );
    }

    res.redirect(`${FRONTEND_URL}/dashboard/settings?section=gsc&gsc=success`);
  } catch (err) {
    console.error('GSC OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/dashboard/settings?section=gsc&gsc=error`);
  }
});

// GET /api/gsc/properties - List GSC properties
router.get('/properties', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.query as { siteId: string };

  const site = await queryOne<{ gsc_access_token: string; gsc_refresh_token: string }>(
    'SELECT gsc_access_token, gsc_refresh_token FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site?.gsc_access_token) {
    res.status(400).json({ error: 'Google Search Console not connected for this site' });
    return;
  }

  try {
    const properties = await gscService.listProperties(site.gsc_access_token, site.gsc_refresh_token);
    res.json({ properties });
  } catch (err) {
    console.error('List GSC properties error:', err);
    res.status(500).json({ error: 'Failed to fetch GSC properties' });
  }
});

// POST /api/gsc/sync/:siteId - Sync pages from GSC
router.post('/sync/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.params;

  // Verify ownership
  const site = await queryOne(
    'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  try {
    const result = await gscService.syncSitePages(siteId);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GSC sync error:', err);
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

// GET /api/gsc/keywords/:pageId - Get keywords for a page
router.get('/keywords/:pageId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { pageId } = req.params;

  const page = await queryOne<{ url: string; site_id: string }>(
    `SELECT p.url, p.site_id FROM pages p
     JOIN sites s ON p.site_id = s.id
     WHERE p.id = $1 AND s.user_id = $2`,
    [pageId, req.user!.userId]
  );

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const site = await queryOne<{
    gsc_property: string;
    gsc_access_token: string;
    gsc_refresh_token: string;
  }>(
    'SELECT gsc_property, gsc_access_token, gsc_refresh_token FROM sites WHERE id = $1',
    [page.site_id]
  );

  if (!site?.gsc_access_token) {
    res.status(400).json({ error: 'GSC not configured' });
    return;
  }

  try {
    const keywords = await gscService.fetchKeywordsForPage(
      page.url,
      site.gsc_property,
      site.gsc_access_token,
      site.gsc_refresh_token
    );
    res.json({ keywords });
  } catch (err) {
    console.error('Fetch keywords error:', err);
    res.status(500).json({ error: 'Failed to fetch keywords' });
  }
});

// GET /api/gsc/overview/:siteId - Traffic overview
router.get('/overview/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.params;

  const site = await queryOne<{
    gsc_property: string;
    gsc_access_token: string;
    gsc_refresh_token: string;
  }>(
    'SELECT gsc_property, gsc_access_token, gsc_refresh_token FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site?.gsc_access_token) {
    res.status(400).json({ error: 'GSC not configured' });
    return;
  }

  try {
    const pages = await gscService.fetchAllPages(
      siteId,
      site.gsc_access_token,
      site.gsc_refresh_token,
      site.gsc_property
    );

    const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);
    const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
    const avgPosition = pages.length > 0
      ? pages.reduce((sum, p) => sum + p.position, 0) / pages.length
      : 0;

    res.json({
      totalClicks,
      totalImpressions,
      avgPosition: parseFloat(avgPosition.toFixed(1)),
      totalPages: pages.length,
      topPages: pages.slice(0, 10),
    });
  } catch (err) {
    console.error('GSC overview error:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
});

// GET /api/gsc/daily/:siteId - Get 30-day daily traffic data for chart
router.get('/daily/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.params;
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);

  const site = await queryOne<{
    gsc_property: string;
    gsc_access_token: string;
    gsc_refresh_token: string;
  }>(
    'SELECT gsc_property, gsc_access_token, gsc_refresh_token FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site?.gsc_access_token) {
    res.status(400).json({ error: 'GSC not configured' });
    return;
  }

  try {
    const data = await gscService.fetchDailyTraffic(
      siteId,
      site.gsc_access_token,
      site.gsc_refresh_token,
      site.gsc_property,
      days
    );
    res.json({ data });
  } catch (err) {
    console.error('GSC daily traffic error:', err);
    res.status(500).json({ error: 'Failed to fetch daily traffic data' });
  }
});

export default router;
