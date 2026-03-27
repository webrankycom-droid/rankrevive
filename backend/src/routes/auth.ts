import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { supabase } from '../db';
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

      // Check existing user
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const { data: user, error } = await supabase
        .from('users')
        .insert({ email, name, password_hash: passwordHash, plan: 'starter' })
        .select('id, email, is_admin')
        .single();

      if (error || !user) {
        console.error('[REGISTER ERROR]', error?.message);
        res.status(500).json({ error: 'Registration failed', detail: error?.message });
        return;
      }

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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).json({ errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      const { data: user } = await supabase
        .from('users')
        .select('id, email, name, password_hash, is_admin, plan, avatar_url')
        .eq('email', email)
        .maybeSingle();

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
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[LOGIN ERROR]', error.message);
      res.status(500).json({ error: 'Login failed', detail: error.message });
    }
  }
);

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email, name, plan, is_admin, avatar_url, pages_used_this_month, created_at')
      .eq('id', req.user!.userId)
      .single();

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
  } catch (err: unknown) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, avatarUrl } = req.body;
  await supabase
    .from('users')
    .update({ ...(name && { name }), ...(avatarUrl && { avatar_url: avatarUrl }) })
    .eq('id', req.user!.userId);
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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(422).json({ errors: errors.array() });
        return;
      }

      const { currentPassword, newPassword } = req.body;
      const { data: user } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', req.user!.userId)
        .single();

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
      await supabase.from('users').update({ password_hash: newHash }).eq('id', req.user!.userId);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
);

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleId, email, name, avatarUrl } = req.body;

    if (!googleId || !email) {
      res.status(422).json({ error: 'googleId and email are required' });
      return;
    }

    let { data: user } = await supabase
      .from('users')
      .select('id, email, name, plan, is_admin, avatar_url')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ email, name: name || email.split('@')[0], avatar_url: avatarUrl || null, plan: 'starter' })
        .select('id, email, name, plan, is_admin, avatar_url')
        .single();

      if (error || !newUser) {
        res.status(500).json({ error: 'Failed to create user' });
        return;
      }
      user = newUser;
    } else if (avatarUrl && !user.avatar_url) {
      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', user.id);
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
  } catch (err: unknown) {
    res.status(500).json({ error: 'Google auth failed' });
  }
});

export default router;
