import Stripe from 'stripe';
import { Request, Response } from 'express';
import { query, queryOne } from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const PLANS = {
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
    price: 29,
    pagesPerMonth: 10,
    features: ['10 pages/month', 'GSC integration', 'AI optimization', 'Basic analytics'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID || '',
    price: 79,
    pagesPerMonth: 100,
    features: ['100 pages/month', 'GSC integration', 'Claude + GPT-4', 'Advanced analytics', 'WP auto-publish'],
  },
  agency: {
    name: 'Agency',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID || '',
    price: 249,
    pagesPerMonth: 500,
    features: ['500 pages/month', 'Multiple sites', 'Priority AI', 'White-label reports', 'API access'],
  },
} as const;

export type PlanName = keyof typeof PLANS;

export async function createOrGetCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const user = await queryOne<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  if (user?.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { userId },
  });

  await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [
    customer.id,
    userId,
  ]);

  return customer.id;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  planName: PlanName,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const plan = PLANS[planName];
  if (!plan) throw new Error('Invalid plan');

  const customerId = await createOrGetCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, planName },
    subscription_data: {
      metadata: { userId, planName },
    },
    allow_promotion_codes: true,
  });

  return session.url!;
}

export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  const user = await queryOne<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );

  if (!user?.stripe_customer_id) {
    throw new Error('No Stripe customer found');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}

async function handleSubscriptionUpserted(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) return;

  const planName = subscription.metadata.planName as PlanName | undefined;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  await query(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, status, current_period_end)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stripe_subscription_id) DO UPDATE
     SET status = $4, current_period_end = $5, plan = $3`,
    [userId, subscription.id, planName || 'starter', status, currentPeriodEnd]
  );

  if (status === 'active' && planName) {
    await query('UPDATE users SET plan = $1 WHERE id = $2', [planName, userId]);
  } else if (status === 'canceled' || status === 'unpaid') {
    await query('UPDATE users SET plan = $1 WHERE id = $2', ['starter', userId]);
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const error = err as Error;
    res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpserted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata.userId;
        if (userId) {
          await query('UPDATE users SET plan = $1 WHERE id = $2', ['starter', userId]);
          await query(
            'UPDATE subscriptions SET status = $1 WHERE stripe_subscription_id = $2',
            ['canceled', sub.id]
          );
        }
        break;

      case 'invoice.payment_failed':
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for customer:', invoice.customer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
    return;
  }

  res.json({ received: true });
}

export async function getSubscriptionStatus(userId: string): Promise<{
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  pagesUsed: number;
  pagesLimit: number;
}> {
  const user = await queryOne<{ plan: string; pages_used_this_month: number }>(
    'SELECT plan, pages_used_this_month FROM users WHERE id = $1',
    [userId]
  );

  const subscription = await queryOne<{ status: string; current_period_end: Date }>(
    'SELECT status, current_period_end FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  const plan = (user?.plan || 'starter') as PlanName;
  const pagesLimit = PLANS[plan]?.pagesPerMonth ?? 10;

  return {
    plan,
    status: subscription?.status || 'inactive',
    currentPeriodEnd: subscription?.current_period_end || null,
    pagesUsed: user?.pages_used_this_month || 0,
    pagesLimit,
  };
}

export const stripeService = {
  createOrGetCustomer,
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getSubscriptionStatus,
  PLANS,
};
