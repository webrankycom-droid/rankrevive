import { Router, Response } from 'express';
import { query, queryOne, camelizeKeys } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { contentScorer } from '../services/contentScorer';

const router = Router();

// GET /api/pages - List all pages for user's sites
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId, status, search, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE s.user_id = $1';
  const params: unknown[] = [req.user!.userId];
  let paramIndex = 2;

  if (siteId) {
    whereClause += ` AND p.site_id = $${paramIndex++}`;
    params.push(siteId);
  }

  if (status) {
    whereClause += ` AND p.status = $${paramIndex++}`;
    params.push(status);
  }

  if (search) {
    whereClause += ` AND (p.url ILIKE $${paramIndex} OR p.title ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  const pages = await query<{
    id: string;
    url: string;
    title: string;
    status: string;
    content_score: number;
    last_synced_at: Date;
    last_optimized_at: Date;
    created_at: Date;
    site_id: string;
    domain: string;
    keyword_count: string;
    total_impressions: string;
    total_clicks: string;
    avg_position: string;
  }>(
    `SELECT p.id, p.url, p.title, p.status, p.content_score, p.last_synced_at,
            p.last_optimized_at, p.created_at, p.site_id,
            s.domain,
            COUNT(DISTINCT k.id) as keyword_count,
            COALESCE(SUM(k.impressions), 0) as total_impressions,
            COALESCE(SUM(k.clicks), 0) as total_clicks,
            COALESCE(AVG(k.position), 0) as avg_position
     FROM pages p
     JOIN sites s ON p.site_id = s.id
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
});

// GET /api/pages/:id - Get single page with keywords
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const page = await queryOne<{
    id: string;
    url: string;
    title: string;
    current_content: string;
    optimized_content: string;
    status: string;
    content_score: number;
    last_synced_at: Date;
    last_optimized_at: Date;
    site_id: string;
    domain: string;
    wp_url: string;
  }>(
    `SELECT p.*, s.domain, s.wp_url
     FROM pages p
     JOIN sites s ON p.site_id = s.id
     WHERE p.id = $1 AND s.user_id = $2`,
    [id, req.user!.userId]
  );

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const keywords = await query<{
    id: string;
    keyword: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>(
    'SELECT id, keyword, impressions, clicks, ctr, position FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 50',
    [id]
  );

  const optimizations = await query<{
    id: string;
    ai_provider: string;
    content_score_before: number;
    content_score_after: number;
    status: string;
    created_at: Date;
    published_at: Date;
  }>(
    'SELECT id, ai_provider, content_score_before, content_score_after, status, created_at, published_at FROM optimizations WHERE page_id = $1 ORDER BY created_at DESC LIMIT 10',
    [id]
  );

  res.json({
    ...camelizeKeys(page as Record<string, unknown>),
    keywords,
    optimizations: optimizations.map((o) => camelizeKeys(o as Record<string, unknown>)),
  });
});

// POST /api/pages/sites - Create site
router.post('/sites', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { domain, wpUrl, wpUsername, wpAppPassword } = req.body;

  if (!domain) {
    res.status(422).json({ error: 'Domain is required' });
    return;
  }

  const [site] = await query<{ id: string; domain: string }>(
    `INSERT INTO sites (user_id, domain, wp_url, wp_username, wp_app_password)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, domain`,
    [req.user!.userId, domain, wpUrl || null, wpUsername || null, wpAppPassword || null]
  );

  res.status(201).json(camelizeKeys(site as Record<string, unknown>));
});

// GET /api/pages/sites/list - List user's sites
router.get('/sites/list', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const sites = await query(
    `SELECT s.id, s.domain, s.gsc_property, s.wp_url, s.created_at,
            COUNT(p.id) as page_count
     FROM sites s
     LEFT JOIN pages p ON p.site_id = s.id
     WHERE s.user_id = $1
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [req.user!.userId]
  );
  res.json({ sites: sites.map((s) => camelizeKeys(s as Record<string, unknown>)) });
});

// PUT /api/pages/:id/content - Update page content
router.put('/:id/content', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { currentContent, optimizedContent } = req.body;

  const page = await queryOne(
    `SELECT p.id FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
    [id, req.user!.userId]
  );

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const keywords = await query<{ keyword: string }>(
    'SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 10',
    [id]
  );
  const kwList = keywords.map((k) => k.keyword);

  let scoreData = null;
  if (optimizedContent) {
    scoreData = contentScorer.scoreContent(optimizedContent, kwList);
  }

  await query(
    `UPDATE pages SET
       current_content = COALESCE($1, current_content),
       optimized_content = COALESCE($2, optimized_content),
       content_score = COALESCE($3, content_score),
       updated_at = NOW()
     WHERE id = $4`,
    [
      currentContent || null,
      optimizedContent || null,
      scoreData?.total || null,
      id,
    ]
  );

  res.json({ success: true, contentScore: scoreData?.total });
});

// DELETE /api/pages/:id - Remove page
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const page = await queryOne(
    `SELECT p.id FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
    [id, req.user!.userId]
  );

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  await query('DELETE FROM pages WHERE id = $1', [id]);
  res.json({ success: true });
});

export default router;
