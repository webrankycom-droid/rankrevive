import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { stripeService } from '../services/stripeService';

const router = Router();

// GET /api/billing/status - Get subscription status
router.get('/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = await stripeService.getSubscriptionStatus(req.user!.userId);
    res.json(status);
  } catch (err) {
    console.error('Get billing status error:', err);
    res.status(500).json({ error: 'Failed to get subscription status' });
  }
});

// POST /api/billing/checkout - Create Stripe checkout session
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { plan } = req.body;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!plan || !['starter', 'pro', 'agency'].includes(plan)) {
    res.status(422).json({ error: 'Invalid plan. Must be starter, pro, or agency.' });
    return;
  }

  try {
    const url = await stripeService.createCheckoutSession(
      req.user!.userId,
      req.user!.email,
      plan as 'starter' | 'pro' | 'agency',
      `${frontendUrl}/dashboard/settings?billing=success`,
      `${frontendUrl}/dashboard/settings?billing=cancel`
    );
    res.json({ url });
  } catch (err) {
    console.error('Create checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal - Create Stripe billing portal session
router.post('/portal', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  try {
    const url = await stripeService.createPortalSession(
      req.user!.userId,
      `${frontendUrl}/dashboard/settings`
    );
    res.json({ url });
  } catch (err) {
    console.error('Create portal session error:', err);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

export default router;
