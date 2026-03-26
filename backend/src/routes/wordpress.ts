import { Router, Response } from 'express';
import { query, queryOne } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { wordpressService } from '../services/wordpressService';

const router = Router();

// POST /api/wordpress/connect - Connect WordPress site
router.post('/connect', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId, wpUrl, wpUsername, wpAppPassword } = req.body;

  if (!siteId || !wpUrl || !wpUsername || !wpAppPassword) {
    res.status(422).json({ error: 'siteId, wpUrl, wpUsername, and wpAppPassword are required' });
    return;
  }

  // Verify ownership
  const site = await queryOne(
    'SELECT id FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  // Test connection
  const test = await wordpressService.testConnection(wpUrl, wpUsername, wpAppPassword);
  if (!test.success) {
    res.status(400).json({ error: test.error });
    return;
  }

  // Save credentials
  await query(
    'UPDATE sites SET wp_url = $1, wp_username = $2, wp_app_password = $3 WHERE id = $4',
    [wpUrl, wpUsername, wpAppPassword, siteId]
  );

  res.json({ success: true, siteTitle: test.siteTitle });
});

// GET /api/wordpress/test/:siteId - Test WordPress connection
router.get('/test/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.params;

  const site = await queryOne<{ wp_url: string; wp_username: string; wp_app_password: string }>(
    'SELECT wp_url, wp_username, wp_app_password FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }

  if (!site.wp_url) {
    res.status(400).json({ error: 'WordPress not configured for this site' });
    return;
  }

  const result = await wordpressService.testConnection(
    site.wp_url,
    site.wp_username,
    site.wp_app_password
  );

  res.json(result);
});

// GET /api/wordpress/posts/:siteId - List recent WP posts
router.get('/posts/:siteId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { siteId } = req.params;
  const { limit = 20 } = req.query;

  const site = await queryOne<{ wp_url: string; wp_username: string; wp_app_password: string }>(
    'SELECT wp_url, wp_username, wp_app_password FROM sites WHERE id = $1 AND user_id = $2',
    [siteId, req.user!.userId]
  );

  if (!site?.wp_url) {
    res.status(400).json({ error: 'WordPress not configured' });
    return;
  }

  try {
    const posts = await wordpressService.listRecentPosts(
      site.wp_url,
      site.wp_username,
      site.wp_app_password,
      Number(limit)
    );
    res.json({ posts });
  } catch (err) {
    console.error('List WP posts error:', err);
    res.status(500).json({ error: 'Failed to fetch WordPress posts' });
  }
});

// POST /api/wordpress/fetch-content - Fetch content from WP for a page
router.post('/fetch-content', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { pageId } = req.body;

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

  const site = await queryOne<{ wp_url: string; wp_username: string; wp_app_password: string }>(
    'SELECT wp_url, wp_username, wp_app_password FROM sites WHERE id = $1',
    [page.site_id]
  );

  if (!site?.wp_url) {
    res.status(400).json({ error: 'WordPress not configured' });
    return;
  }

  try {
    const wpPost = await wordpressService.getPostByUrl(
      site.wp_url,
      site.wp_username,
      site.wp_app_password,
      page.url
    );

    if (!wpPost) {
      res.status(404).json({ error: 'Post not found in WordPress' });
      return;
    }

    const content = wpPost.content.rendered;
    const title = wpPost.title.rendered;

    await query(
      'UPDATE pages SET current_content = $1, title = $2, last_synced_at = NOW() WHERE id = $3',
      [content, title, pageId]
    );

    res.json({ success: true, content, title, wpPostId: wpPost.id });
  } catch (err) {
    console.error('Fetch WP content error:', err);
    res.status(500).json({ error: 'Failed to fetch content from WordPress' });
  }
});

export default router;
