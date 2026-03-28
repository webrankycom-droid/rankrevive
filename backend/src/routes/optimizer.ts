import { Router, Response } from 'express';
import { query, queryOne, camelizeKeys } from '../db';
import { authenticate, requireActiveSubscription, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { optimizeContent, AIProvider, generateMetaTags } from '../services/aiService';
import { contentScorer } from '../services/contentScorer';

const router = Router();

router.post(
  '/:pageId/optimize',
  authenticate,
  requireActiveSubscription,
  aiLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { pageId } = req.params;
    const { provider = 'claude' } = req.body as { provider?: AIProvider };

    const page = await queryOne<{
      id: string;
      url: string;
      title: string;
      current_content: string;
      site_id: string;
    }>(
      `SELECT p.id, p.url, p.title, p.current_content, p.site_id
       FROM pages p
       JOIN sites s ON p.site_id = s.id
       WHERE p.id = $1 AND s.user_id = $2`,
      [pageId, req.user!.userId]
    );

    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
    if (!page.current_content) {
      res.status(400).json({ error: 'Page has no content to optimize. Fetch content from WordPress first.' });
      return;
    }

    const keywords = await query<{ keyword: string; position: number; impressions: number }>(
      'SELECT keyword, position, impressions FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 20',
      [pageId]
    );
    const kwList = keywords.map((k) => k.keyword);
    const originalScore = contentScorer.scoreContent(page.current_content, kwList);

    // Run AI optimization
    let result;
    try {
      result = await optimizeContent(
        {
          content: page.current_content,
          keywords: kwList,
          pageUrl: page.url,
          pageTitle: page.title,
        },
        provider
      );
    } catch (aiErr: unknown) {
      const msg = (aiErr as Error)?.message || 'AI optimization failed';
      res.status(500).json({ error: msg });
      return;
    }

    const optimizedScore = contentScorer.scoreContent(result.optimizedContent, kwList);

    const [optimization] = await query<{ id: string }>(
      `INSERT INTO optimizations (page_id, user_id, original_content, optimized_content, ai_provider, content_score_before, content_score_after, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING id`,
      [pageId, req.user!.userId, page.current_content, result.optimizedContent, result.provider, originalScore.total, optimizedScore.total]
    );

    await query(
      `UPDATE pages SET optimized_content = $1, content_score = $2, last_optimized_at = NOW(), status = 'optimized' WHERE id = $3`,
      [result.optimizedContent, optimizedScore.total, pageId]
    );
    await query('UPDATE users SET pages_used_this_month = pages_used_this_month + 1 WHERE id = $1', [req.user!.userId]);

    res.json({
      optimizationId: optimization.id,
      optimizedContent: result.optimizedContent,
      originalContent: page.current_content,
      provider: result.provider,
      suggestions: result.suggestions,
      targetedKeywords: result.targetedKeywords,
      scoreBreakdown: { before: originalScore, after: optimizedScore, improvement: optimizedScore.total - originalScore.total },
      tokensUsed: result.tokensUsed,
    });
  }
);

router.get('/:pageId/score', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { pageId } = req.params;
  const { contentType = 'current' } = req.query as { contentType?: 'current' | 'optimized' };
  const page = await queryOne<{ current_content: string; optimized_content: string }>(
    `SELECT p.current_content, p.optimized_content FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
    [pageId, req.user!.userId]
  );
  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
  const content = contentType === 'optimized' ? page.optimized_content : page.current_content;
  if (!content) { res.status(400).json({ error: 'No content available to score' }); return; }
  const keywords = await query<{ keyword: string }>('SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 10', [pageId]);
  const kwList = keywords.map((k) => k.keyword);
  res.json(contentScorer.scoreContent(content, kwList));
});

router.post('/:pageId/meta-tags', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { pageId } = req.params;
  const page = await queryOne<{ current_content: string; optimized_content: string; title: string }>(
    `SELECT p.current_content, p.optimized_content, p.title FROM pages p JOIN sites s ON p.site_id = s.id WHERE p.id = $1 AND s.user_id = $2`,
    [pageId, req.user!.userId]
  );
  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
  const content = page.optimized_content || page.current_content;
  if (!content) { res.status(400).json({ error: 'No content available' }); return; }
  const keywords = await query<{ keyword: string }>('SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 1', [pageId]);
  const metaTags = await generateMetaTags(content, keywords[0]?.keyword || '', page.title);
  res.json(metaTags);
});

router.put('/:optimizationId/publish', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { optimizationId } = req.params;
  const { status = 'draft' } = req.body as { status?: 'publish' | 'draft' };
  const optimization = await queryOne<{ id: string; page_id: string; optimized_content: string; user_id: string }>(
    'SELECT id, page_id, optimized_content, user_id FROM optimizations WHERE id = $1 AND user_id = $2',
    [optimizationId, req.user!.userId]
  );
  if (!optimization) { res.status(404).json({ error: 'Optimization not found' }); return; }
  const page = await queryOne<{ site_id: string }>('SELECT site_id FROM pages WHERE id = $1', [optimization.page_id]);
  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
  const { wordpressService } = await import('../services/wordpressService');
  const result = await wordpressService.publishOptimizationToWordPress(page.site_id, optimization.page_id, optimization.optimized_content, status);
  if (!result.success) { res.status(500).json({ error: result.error || 'Failed to publish to WordPress' }); return; }
  await query('UPDATE optimizations SET status = $1, published_at = NOW(), wp_post_id = $2 WHERE id = $3',
    [status === 'publish' ? 'published' : 'draft_wp', result.wpPostId, optimizationId]);
  if (status === 'publish') { await query('UPDATE pages SET status = $1 WHERE id = $2', ['published', optimization.page_id]); }
  res.json({ success: true, wpPostId: result.wpPostId, link: result.link });
});

router.get('/history/list', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const optimizations = await query(
    `SELECT o.id, o.page_id, o.ai_provider, o.content_score_before, o.content_score_after,
            o.status, o.created_at, o.published_at, o.wp_post_id,
            p.url as page_url, p.title as page_title, s.domain
     FROM optimizations o JOIN pages p ON o.page_id = p.id JOIN sites s ON p.site_id = s.id
     WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
    [req.user!.userId, Number(limit), offset]
  );
  const countResult = await queryOne<{ count: string }>('SELECT COUNT(*) as count FROM optimizations WHERE user_id = $1', [req.user!.userId]);
  res.json({
    optimizations: optimizations.map((o) => camelizeKeys(o as Record<string, unknown>)),
    total: parseInt(countResult?.count || '0'),
    page: Number(page),
    limit: Number(limit),
  });
});

export default router;
