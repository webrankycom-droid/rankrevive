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

// ─── Internal Linking ─────────────────────────────────────────────────────────
// Finds opportunities to link between pages on the same site based on
// keyword overlap — pages that should be linked but aren't yet.

router.get('/internal-links/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { siteId } = req.params;
    const site = await queryOne<{ id: string; domain: string }>(
      'SELECT id, domain FROM sites WHERE id = $1 AND user_id = $2',
      [siteId, req.user!.userId]
    );
    if (!site) { res.status(404).json({ error: 'Site not found' }); return; }

    // Get all pages with content AND their top keywords
    const pages = await query<{ id: string; url: string; title: string; current_content: string }>(
      `SELECT id, url, title, current_content
       FROM pages WHERE site_id = $1 AND current_content IS NOT NULL AND length(current_content) > 100
       LIMIT 100`,
      [siteId]
    );

    if (pages.length < 2) {
      res.json({ siteId, domain: site.domain, suggestions: [], total: 0,
        message: 'Need at least 2 pages with content to find internal link opportunities.' });
      return;
    }

    // Get top keywords for each page
    const pageIds = pages.map(p => `'${p.id}'`).join(',');
    const keywords = await query<{ page_id: string; keyword: string; impressions: number; position: number }>(
      `SELECT page_id, keyword, impressions, position
       FROM keywords
       WHERE page_id IN (${pageIds}) AND impressions >= 5
       ORDER BY page_id, impressions DESC`,
      []
    );

    // Group top-3 keywords per page
    const kwByPage: Record<string, Array<{ keyword: string; impressions: number; position: number }>> = {};
    for (const kw of keywords) {
      if (!kwByPage[kw.page_id]) kwByPage[kw.page_id] = [];
      if (kwByPage[kw.page_id].length < 5) kwByPage[kw.page_id].push(kw);
    }

    const suggestions: Array<{
      sourcePageId: string;
      sourceUrl: string;
      sourceTitle: string;
      targetPageId: string;
      targetUrl: string;
      targetTitle: string;
      anchorText: string;
      impressions: number;
      targetPosition: number;
      reason: string;
    }> = [];

    // For each page B (source), check if it mentions top keywords of page A (target)
    for (const sourceP of pages) {
      const contentLower = sourceP.current_content.toLowerCase();

      for (const targetP of pages) {
        if (targetP.id === sourceP.id) continue;

        // Skip if source already links to target URL
        if (sourceP.current_content.includes(targetP.url)) continue;

        const targetKws = kwByPage[targetP.id] || [];
        for (const kw of targetKws) {
          const kwLower = kw.keyword.toLowerCase();
          // Check if keyword appears as plain text in source content
          if (contentLower.includes(kwLower)) {
            // Make sure it's not already inside an anchor pointing to target
            const alreadyLinked = new RegExp(
              `<a[^>]*>[^<]*${kw.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<\\/a>`,
              'i'
            ).test(sourceP.current_content);
            if (!alreadyLinked) {
              suggestions.push({
                sourcePageId: sourceP.id,
                sourceUrl: sourceP.url,
                sourceTitle: sourceP.title || sourceP.url,
                targetPageId: targetP.id,
                targetUrl: targetP.url,
                targetTitle: targetP.title || targetP.url,
                anchorText: kw.keyword,
                impressions: kw.impressions,
                targetPosition: kw.position,
                reason: `"${kw.keyword}" gets ${kw.impressions} impressions/mo and appears in this page's text — link it to the ranking page`,
              });
              break; // One suggestion per source→target pair
            }
          }
        }
      }
    }

    // Sort by impressions (highest impact first)
    suggestions.sort((a, b) => b.impressions - a.impressions);

    res.json({
      siteId,
      domain: site.domain,
      suggestions: suggestions.slice(0, 80),
      total: suggestions.length,
    });
  } catch (err: unknown) {
    console.error('[INTERNAL LINKS ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to analyze internal links' });
  }
});

// POST /api/pages/:pageId/apply-internal-links
// Auto-inject <a> tags into page content based on provided link suggestions.

router.post('/:pageId/apply-internal-links', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pageId } = req.params;
    const { links } = req.body as {
      links: Array<{ anchorText: string; targetUrl: string; targetTitle: string }>;
    };

    if (!links?.length) { res.status(400).json({ error: 'No links provided' }); return; }

    const page = await queryOne<{ id: string; current_content: string; optimized_content: string }>(
      `SELECT p.id, p.current_content, p.optimized_content
       FROM pages p JOIN sites s ON p.site_id = s.id
       WHERE p.id = $1 AND s.user_id = $2`,
      [pageId, req.user!.userId]
    );
    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }

    // Use optimized_content if available, otherwise current_content
    let content = page.optimized_content || page.current_content;
    if (!content) { res.status(400).json({ error: 'No content to apply links to' }); return; }

    let appliedCount = 0;
    const appliedLinks: string[] = [];

    for (const link of links) {
      const { anchorText, targetUrl } = link;
      if (!anchorText || !targetUrl) continue;

      const escaped = anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Only replace inside <p> tags — never in headings or existing anchors
      let applied = false;
      content = content.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
        if (applied) return match;
        // Skip if paragraph already links to this URL
        if (inner.includes(targetUrl)) return match;
        // Skip if anchor with this text already exists
        if (new RegExp(`<a[^>]*>[^<]*${escaped}[^<]*<\\/a>`, 'i').test(inner)) return match;

        // Replace first occurrence of plain text (not inside any HTML tag)
        const textRegex = new RegExp(
          `(?<![=\\w"'>-])(${escaped})(?![\\w"'<])`,
          'i'
        );
        const newInner = inner.replace(textRegex, (m: string) => {
          applied = true;
          return `<a href="${targetUrl}" title="${link.targetTitle}">${m}</a>`;
        });

        if (applied) return `<p${attrs}>${newInner}</p>`;
        return match;
      });

      if (applied) {
        appliedCount++;
        appliedLinks.push(`"${anchorText}" → ${targetUrl}`);
      }
    }

    if (appliedCount === 0) {
      res.json({ success: false, message: 'No link positions found in content', appliedCount: 0 });
      return;
    }

    // Save updated content
    const field = page.optimized_content ? 'optimized_content' : 'current_content';
    await query(`UPDATE pages SET ${field} = $1, updated_at = NOW() WHERE id = $2`, [content, pageId]);

    res.json({
      success: true,
      appliedCount,
      appliedLinks,
      updatedContent: content,
    });
  } catch (err: unknown) {
    console.error('[APPLY LINKS ERROR]', (err as Error).message);
    res.status(500).json({ error: 'Failed to apply internal links' });
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
