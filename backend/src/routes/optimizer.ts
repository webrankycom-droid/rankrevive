import { Router, Response } from 'express';
import { query, queryOne, camelizeKeys } from '../db';
import { authenticate, requireActiveSubscription, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { optimizeContent, AIProvider, generateMetaTags } from '../services/aiService';
import { contentScorer } from '../services/contentScorer';

const router = Router();

// POST /api/optimizer/:pageId/optimize - Run AI optimization
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

      if (!page) {
              res.status(404).json({ error: 'Page not found' });
              return;
      }

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

      // Run AI optimization with proper error handling
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
              `INSERT INTO optimizations
                       (page_id, user_id, original_content, optimized_content, ai_provider,
                                 content_score_before, content_score_after, status)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
                                               RETURNING id`,
              [
                        pageId,
                        req.user!.userId,
                        page.current_content,
                        result.optimizedContent,
                        result.provider,
                        originalScore.total,
                        optimizedScore.total,
                      ]
            );

      await query(
              `UPDATE pages SET
                       optimized_content = $1,
                                content_score = $2,
                                         last_optimized_at = NOW(),
                                                  status = 'optimized'
                                                         WHERE id = $3`,
              [result.optimizedContent, optimizedScore.total, pageId]
            );

      await query(
              'UPDATE users SET pages_used_this_month = pages_used_this_month + 1 WHERE id = $1',
              [req.user!.userId]
            );

      res.json({
              optimizationId: optimization.id,
              optimizedContent: result.optimizedContent,
              originalContent: page.current_content,
              provider: result.provider,
              suggestions: result.suggestions,
              targetedKeywords: result.targetedKeywords,
              scoreBreakdown: {
                        before: originalScore,
                        after: optimizedScore,
                        improvement: optimizedScore.total - originalScore.total,
              },
              tokensUsed: result.tokensUsed,
      });
    }
  );

// GET /api/optimizer/:pageId/score - Score existing content
router.get('/:pageId/score', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
    const { pageId } = req.params;
    const { contentType = 'current' } = req.query as { contentType?: 'current' | 'optimized' };

             const page = await queryOne<{
                   current_content: string;
                   optimized_content: string;
             }>(
                   `SELECT p.current_content, p.optimized_content
                        FROM pages p
                             JOIN sites s ON p.site_id = s.id
                                  WHERE p.id = $1 AND s.user_id = $2`,
                   [pageId, req.user!.userId]
                 );

             if (!page) {
                   res.status(404).json({ error: 'Page not found' });
                   return;
             }

             const content = contentType === 'optimized' ? page.optimized_content : page.current_content;
    if (!content) {
          res.status(400).json({ error: 'No content available to score' });
          return;
    }

             const keywords = await query<{ keyword: string }>(
                   'SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 10',
                   [pageId]
                 );
    const kwList = keywords.map((k) => k.keyword);

             const score = contentScorer.scoreContent(content, kwList);
    res.json(score);
});

// POST /api/optimizer/:pageId/meta-tags - Generate meta tags
router.post(
    '/:pageId/meta-tags',
    authenticate,
    async (req: AuthRequest, res: Response): Promise<void> => {
          const { pageId } = req.params;

      const page = await queryOne<{ current_content: string; optimized_content: string; title: string }>(
              `SELECT p.current_content, p.optimized_content, p.title
                     FROM pages p
                            JOIN sites s ON p.site_id = s.id
                                   WHERE p.id = $1 AND s.user_id = $2`,
              [pageId, req.user!.userId]
            );

      if (!page) {
              res.status(404).json({ error: 'Page not found' });
              return;
      }

      const content = page.optimized_content || page.current_content;
          if (!content) {
                  res.status(400).json({ error: 'No content available' });
                  return;
          }

      const keywords = await query<{ keyword: string }>(
              'SELECT keyword FROM keywords WHERE page_id = $1 ORDER BY impressions DESC LIMIT 1',
              [pageId]
            );
          const primaryKw = keywords[0]?.keyword || '';

      const metaTags = await generateMetaTags(content, primaryKw, page.title);
          res.json(metaTags);
    }
  );

// PUT /api/optimizer/:optimizationId/publish - Publish to WordPress
router.put(
    '/:optimizationId/publish',
    authenticate,
    async (req: AuthRequest, res: Response): Promise<void> => {
          const { optimizationId } = req.params;
          const { status = 'draft' } = req.body as { status?: 'publish' | 'draft' };

      const optimization = await queryOne<{
              id: string;
              page_id: string;
              optimized_content: string;
              user_id: string;
      }>(
              'SELECT id, page_id, optimized_content, user_id FROM optimizations WHERE id = $1 AND user_id = $2',
              [optimizationId, req.user!.userId]
            );

      if (!optimization) {
              res.status(404).json({ error: 'Optimization not found' });
              return;
      }

      const page = await queryOne<{ site_id: string }>(
              'SELECT site_id FROM pages WHERE id = $1',
              [optimization.page_id]
            );

      if (!page) {
              res.status(404).json({ error: 'Page not found' });
              return;
      }

      const { wordpressService } = await import('../services/w
