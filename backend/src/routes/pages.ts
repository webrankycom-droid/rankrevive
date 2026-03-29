import { Router, Response } from 'express';
import { query, queryOne, camelizeKeys } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { contentScorer } from '../services/contentScorer';

const router = Router();

// GET /api/pages - List all pages for user's sites
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { siteId, status, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = 'WHERE s.user_id = $1';
    const params: unknown[] = [req.user!.userId];
    let paramIndex = 2;

    if (siteId) { whereClause += ` AND p.site_id = $${paramIndex++}`; params.push(siteId); }
    if (status) { whereClause += ` AND p.status = $${paramIndex++}`; params.push(status); }
    if (search) {
      whereClause += ` AND (p.url ILIKE $${paramIndex} OR p.title ILIKE $${paramIndex})`;
      params.push(`%${search}%`); paramIndex++;
    }

    const pages = await query(
      `SELECT p.id, p.url, p.title, p.status, p.content_score, p.last_synced_at,
              p.last_optimized_at, p.created_at, p.site_id, s.domain,
              COUNT(DISTINCT k.id) as keyword_count,
              COALESCE(SUM(k.impressions), 0) as total_impressions,
              COALESCE(SUM(k.clicks), 0) as total_clicks,
              COALESCE(AVG(k.position), 0) as avg_position
       FROM pages p JOIN sites s ON p.site_id = s.id
       LEFT JOIN keywords k ON k.page_id = p.id
       ${whereClause}
       GROUP BY p.id, s.domain
       ORDER BY p.last_synced_at DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, Number(limit), offset]
    );

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id) as count FROM pages p JOIN sites s ON p.site_id = s.id ${whereClause}`,
      params
    );

    res.json({
      pages: pages.map((p) => camelizeKeys(p as Record<string, unknown>)),
      total: parseInt(countResult?.count || '0'),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (err: unknown) {
    console.error('[PAGES LIST ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// GET /api/pages/sites/list - List user's sites (must be before /:id)
router.get('/sites/list', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const sites = await query(
      `SELECT s.id, s.domain, s.gsc_property, s.wp_url, s.created_at,
              COUNT(p.id) as page_count
       FROM sites s LEFT JOIN pages p ON p.site_id = s.id
       WHERE s.user_id = $1
       GROUP BY s.id ORDER BY s.created_at DESC`,
      [req.user!.userId]
    );
    res.json({ sites: sites.map((s) => camelizeKeys(s as Record<string, unknown>)) });
  } catch (err: unknown) {
    console.error('[SITES LIST ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch sites' });
  }
});

// POST /api/pages/sites - Create site
router.post('/sites', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { domain, wpUrl, wpUsername, wpAppPassword } = req.body;
    if (!domain) { res.status(422).json({ error: 'Domain is required' }); return; }

    const results = await query<{ id: string; domain: string }>(
      `INSERT INTO sites (user_id, domain, wp_url, wp_username, wp_app_password)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, domain`,
      [req.user!.userId, domain, wpUrl || null, wpUsername || null, wpAppPassword || null]
    );

    if (!results[0]) { res.status(500).json({ error: 'Failed to create site' }); return; }
    res.status(201).json(camelizeKeys(results[0] as Record<string, unknown>));
  } catch (err: unknown) {
    console.error('[ADD SITE ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to add site', detail: (err as Error).message });
  }
});

// ─── Keyword Cannibalization Detector ────────────────────────────────────────
// Finds keywords where 2+ pages on the same site compete for the same ranking.
// Cannibalization splits Google's ranking signals and hurts all involved pages.

router.get('/cannibalization/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { siteId } = req.params;
    const { minImpressions = 5 } = req.query;

    // Verify user owns this site
    const site = await queryOne<{ id: string; domain: string }>(
      'SELECT id, domain FROM sites WHERE id = $1 AND user_id = $2',
      [siteId, req.user!.userId]
    );
    if (!site) { res.status(404).json({ error: 'Site not found' }); return; }

    // Find keywords with 2+ pages competing
    const conflicts = await query<{
      keyword: string;
      page_count: string;
      total_impressions: string;
      total_clicks: string;
      best_position: string;
    }>(
      `SELECT k.keyword,
              COUNT(DISTINCT k.page_id) AS page_count,
              SUM(k.impressions) AS total_impressions,
              SUM(k.clicks) AS total_clicks,
              MIN(k.position) AS best_position
       FROM keywords k
       JOIN pages p ON k.page_id = p.id
       WHERE p.site_id = $1 AND k.impressions >= $2
       GROUP BY k.keyword
       HAVING COUNT(DISTINCT k.page_id) > 1
       ORDER BY SUM(k.impressions) DESC
       LIMIT 50`,
      [siteId, Number(minImpressions)]
    );

    if (!conflicts.length) {
      res.json({ siteId, domain: site.domain, conflicts: [], total: 0 });
      return;
    }

    // For each conflicting keyword, get the competing pages
    const keywords = conflicts.map(c => c.keyword);
    const pageDetails = await query<{
      keyword: string;
      page_id: string;
      page_url: string;
      page_title: string;
      impressions: number;
      clicks: number;
      position: number;
      content_score: number | null;
      status: string;
    }>(
      `SELECT k.keyword, p.id AS page_id, p.url AS page_url, p.title AS page_title,
              k.impressions, k.clicks, k.position, p.content_score, p.status
       FROM keywords k
       JOIN pages p ON k.page_id = p.id
       WHERE p.site_id = $1 AND k.keyword = ANY($2)
       ORDER BY k.keyword, k.impressions DESC`,
      [siteId, keywords]
    );

    // Group page details by keyword
    const pagesByKeyword: Record<string, typeof pageDetails> = {};
    for (const row of pageDetails) {
      if (!pagesByKeyword[row.keyword]) pagesByKeyword[row.keyword] = [];
      pagesByKeyword[row.keyword].push(row);
    }

    // Build structured conflict groups
    const result = conflicts.map(c => {
      const pages = pagesByKeyword[c.keyword] || [];
      const winner = pages[0]; // highest impressions = current "winner"
      const losers = pages.slice(1);

      // Calculate cannibalization severity
      const positionSpread = pages.length > 1
        ? Math.max(...pages.map(p => p.position)) - Math.min(...pages.map(p => p.position))
        : 0;

      const severity: 'high' | 'medium' | 'low' =
        Number(c.total_impressions) > 100 || pages.length >= 3 ? 'high' :
        Number(c.total_impressions) > 30 ? 'medium' : 'low';

      return {
        keyword: c.keyword,
        pageCount: Number(c.page_count),
        totalImpressions: Number(c.total_impressions),
        totalClicks: Number(c.total_clicks),
        bestPosition: Number(c.best_position),
        severity,
        positionSpread: Math.round(positionSpread),
        recommendation: pages.length >= 3
          ? `Consolidate into one authoritative page — ${pages.length} pages are splitting signals`
          : winner && Math.min(...pages.map(p => p.position)) <= 10
          ? `Canonical tag: keep "${winner.page_url}" as primary, add canonical from "${losers[0]?.page_url}"`
          : `Merge "${losers[0]?.page_url}" content into "${winner?.page_url}" and 301 redirect`,
        pages: pages.map(p => ({
          pageId: p.page_id,
          url: p.page_url,
          title: p.page_title,
          impressions: p.impressions,
          clicks: p.clicks,
          position: Number(p.position),
          contentScore: p.content_score,
          status: p.status,
        })),
      };
    });

    res.json({
      siteId,
      domain: site.domain,
      conflicts: result,
      total: result.length,
      summary: {
        high: result.filter(r => r.severity === 'high').length,
        medium: result.filter(r => r.severity === 'medium').length,
        low: result.filter(r => r.severity === 'low').length,
      },
    });
  } catch (err: unknown) {
    console.error('[CANNIBALIZATION ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to analyze cannibalization' });
  }
});

// GET /api/pages/:id - Get single page with keywords
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = await queryOne(
      `SELECT p.*, s.domain, s.wp_url FROM pages p JOIN sites s ON p.site_id = s.id
       WHERE p.id = $1 AND s.user_id = $2`,
      [id, req.user!.userId]
    );
    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }

    const keywords = await query(
      'SELECT id, keyword, impressions, clicks, ctr, position FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 50',
      [id]
    );
    const optimizations = await query(
      'SELECT id, ai_provider, content_score_before, content_score_after, status, created_at, published_at FROM optimizations WHERE page_id = $1 ORDER BY created_at DESC LIMIT 10',
      [id]
    );
    res.json({
      ...camelizeKeys(page as Record<string, unknown>),
      keywords,
      optimizations: optimizations.map((o) => camelizeKeys(o as Record<string, unknown>)),
    });
  } catch (err: unknown) {
    console.error('[PAGE GET ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// PUT /api/pages/:id/content - Update page content
router.put('/:id/content', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { currentContent, optimizedContent } = req.body;
    const page = await queryOne(
      `SELECT p.id FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
      [id, req.user!.userId]
    );
    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }

    const keywords = await query<{ keyword: string }>(
      'SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 10', [id]
    );
    const kwList = keywords.map((k) => k.keyword);
    const scoreData = optimizedContent ? contentScorer.scoreContent(optimizedContent, kwList) : null;

    await query(
      `UPDATE pages SET current_content = COALESCE($1, current_content),
       optimized_content = COALESCE($2, optimized_content),
       content_score = COALESCE($3, content_score), updated_at = NOW() WHERE id = $4`,
      [currentContent || null, optimizedContent || null, scoreData?.total || null, id]
    );
    res.json({ success: true, contentScore: scoreData?.total });
  } catch (err: unknown) {
    console.error('[PAGE UPDATE ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// DELETE /api/pages/:id - Remove page
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = await queryOne(
      `SELECT p.id FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
      [id, req.user!.userId]
    );
    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
    await query('DELETE FROM pages WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err: unknown) {
    console.error('[PAGE DELETE ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

export default router;
