import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { query, queryOne } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

function signToken(userId: string, email: string, isAdmin: boolean): string {
  return jwt.sign(
    { userId, email, isAdmin },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).json({ errors: errors.array() });
        return;
      }

      const { email, password, name } = req.body;

      const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const [user] = await query<{ id: string; email: string; is_admin: boolean }>(
        'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, is_admin',
        [email, name, passwordHash]
      );

      const token = signToken(user.id, user.email, user.is_admin);
      res.status(201).json({ token, user: { id: user.id, email: user.email, name, plan: 'starter' } });
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[REGISTER ERROR]', error.message);
      res.status(500).json({ error: 'Registration failed', detail: error.message });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    const user = await queryOne<{
      id: string;
      email: string;
      name: string;
      password_hash: string;
      is_admin: boolean;
      plan: string;
      avatar_url: string;
    }>('SELECT id, email, name, password_hash, is_admin, plan, avatar_url FROM users WHERE email = $1', [email]);

    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id, user.email, user.is_admin);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        avatarUrl: user.avatar_url,
        isAdmin: user.is_admin,
      },
    });
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await queryOne<{
    id: string;
    email: string;
    name: string;
    plan: string;
    is_admin: boolean;
    avatar_url: string;
    pages_used_this_month: number;
    created_at: Date;
  }>(
    'SELECT id, email, name, plan, is_admin, avatar_url, pages_used_this_month, created_at FROM users WHERE id = $1',
    [req.user!.userId]
  );

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    isAdmin: user.is_admin,
    avatarUrl: user.avatar_url,
    pagesUsedThisMonth: user.pages_used_this_month,
    createdAt: user.created_at,
  });
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, avatarUrl } = req.body;
  await query('UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE id = $3', [
    name || null,
    avatarUrl || null,
    req.user!.userId,
  ]);
  res.json({ success: true });
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ errors: errors.array() });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (!user?.password_hash) {
      res.status(400).json({ error: 'No password set (OAuth account)' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.userId]);
    res.json({ success: true });
  }
);

// POST /api/auth/google - Google OAuth sign-in via NextAuth
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const { googleId, email, name, avatarUrl } = req.body;

  if (!googleId || !email) {
    res.status(422).json({ error: 'googleId and email are required' });
    return;
  }

  // Find existing user by email
  let user = await queryOne<{
    id: string;
    email: string;
    name: string;
    plan: string;
    is_admin: boolean;
    avatar_url: string;
  }>('SELECT id, email, name, plan, is_admin, avatar_url FROM users WHERE email = $1', [email]);

  if (!user) {
    // Create new user from Google
    const [newUser] = await query<{
      id: string;
      email: string;
      name: string;
      plan: string;
      is_admin: boolean;
      avatar_url: string;
    }>(
      'INSERT INTO users (email, name, avatar_url, plan) VALUES ($1, $2, $3, $4) RETURNING id, email, name, plan, is_admin, avatar_url',
      [email, name || email.split('@')[0], avatarUrl || null, 'starter']
    );
    user = newUser;
  } else if (avatarUrl && user && !user.avatar_url) {
    // Update avatar if not set
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, user.id]);
  }

  if (!user) {
    res.status(500).json({ error: 'Failed to create or find user' });
    return;
  }

  const token = signToken(user.id, user.email, user.is_admin);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      isAdmin: user.is_admin,
      avatarUrl: user.avatar_url || avatarUrl,
    },
  });
});

export default router;
