import { Router, Response } from 'express';
import { query, queryOne } from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/stats - Platform stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  const [userStats] = await query<{
    total_users: string;
    starter_users: string;
    pro_users: string;
    agency_users: string;
    new_today: string;
  }>(
    `SELECT
       COUNT(*) as total_users,
       COUNT(*) FILTER (WHERE plan = 'starter') as starter_users,
       COUNT(*) FILTER (WHERE plan = 'pro') as pro_users,
       COUNT(*) FILTER (WHERE plan = 'agency') as agency_users,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as new_today
     FROM users WHERE is_admin = false`
  );

  const [pageStats] = await query<{
    total_pages: string;
    optimized_pages: string;
    published_pages: string;
    total_optimizations: string;
  }>(
    `SELECT
       COUNT(*) as total_pages,
       COUNT(*) FILTER (WHERE status = 'optimized') as optimized_pages,
       COUNT(*) FILTER (WHERE status = 'published') as published_pages,
       (SELECT COUNT(*) FROM optimizations) as total_optimizations
     FROM pages`
  );

  const [siteStats] = await query<{ total_sites: string }>(
    'SELECT COUNT(*) as total_sites FROM sites'
  );

  const recentOptimizations = await query(
    `SELECT o.id, o.ai_provider, o.content_score_before, o.content_score_after,
            o.status, o.created_at, u.email as user_email, p.url as page_url
     FROM optimizations o
     JOIN users u ON o.user_id = u.id
     JOIN pages p ON o.page_id = p.id
     ORDER BY o.created_at DESC
     LIMIT 10`
  );

  res.json({
    users: {
      total: parseInt(userStats.total_users),
      starter: parseInt(userStats.starter_users),
      pro: parseInt(userStats.pro_users),
      agency: parseInt(userStats.agency_users),
      newToday: parseInt(userStats.new_today),
    },
    pages: {
      total: parseInt(pageStats.total_pages),
      optimized: parseInt(pageStats.optimized_pages),
      published: parseInt(pageStats.published_pages),
      totalOptimizations: parseInt(pageStats.total_optimizations),
    },
    sites: {
      total: parseInt(siteStats.total_sites),
    },
    recentOptimizations,
  });
});

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = 1, limit = 50, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let whereClause = 'WHERE is_admin = false';
  const params: unknown[] = [];
  let paramIndex = 1;

  if (search) {
    whereClause += ` AND (email ILIKE $${paramIndex} OR name ILIKE $${paramIndex})`;
    params.push(`%${search}%`);
    paramIndex++;
  }

  const users = await query(
    `SELECT id, email, name, plan, is_admin, pages_used_this_month, created_at, stripe_customer_id
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, Number(limit), offset]
  );

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM users ${whereClause}`,
    params
  );

  res.json({
    users,
    total: parseInt(countResult?.count || '0'),
    page: Number(page),
    limit: Number(limit),
  });
});

// PATCH /api/admin/users/:id - Update user plan/status
router.patch('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { plan, isAdmin, pagesUsedThisMonth } = req.body;

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (plan !== undefined) { updates.push(`plan = $${idx++}`); values.push(plan); }
  if (isAdmin !== undefined) { updates.push(`is_admin = $${idx++}`); values.push(isAdmin); }
  if (pagesUsedThisMonth !== undefined) { updates.push(`pages_used_this_month = $${idx++}`); values.push(pagesUsedThisMonth); }

  if (updates.length === 0) {
    res.status(422).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  res.json({ success: true });
});

// POST /api/admin/reset-monthly-usage - Reset monthly page counts
router.post('/reset-monthly-usage', async (_req: AuthRequest, res: Response): Promise<void> => {
  await query('UPDATE users SET pages_used_this_month = 0');
  res.json({ success: true, message: 'Monthly usage reset for all users' });
});

// GET /api/admin/revenue - Revenue overview
router.get('/revenue', async (_req: AuthRequest, res: Response): Promise<void> => {
  const subscriptions = await query(
    `SELECT plan, status, COUNT(*) as count
     FROM subscriptions
     WHERE status = 'active'
     GROUP BY plan, status`
  );

  const planPrices: Record<string, number> = { starter: 29, pro: 79, agency: 249 };
  let mrr = 0;

  for (const sub of subscriptions as Array<{ plan: string; count: string }>) {
    mrr += (planPrices[sub.plan] || 0) * parseInt(sub.count);
  }

  res.json({ subscriptions, mrr, arr: mrr * 12 });
});

export default router;
