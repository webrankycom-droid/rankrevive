import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db';

export interface JwtPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('plan, pages_used_this_month')
    .eq('id', req.user.userId)
    .maybeSingle();

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const planLimits: Record<string, number> = {
    starter: 10,
    pro: 100,
    agency: 500,
  };

  const limit = planLimits[user.plan] ?? 10;
  if (user.pages_used_this_month >= limit) {
    res.status(402).json({
      error: 'Monthly page limit reached',
      limit,
      used: user.pages_used_this_month,
      plan: user.plan,
    });
    return;
  }

  next();
}

export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
