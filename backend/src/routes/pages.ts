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
