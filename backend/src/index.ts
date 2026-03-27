import 'dotenv/config';
import dns from 'dns';
// Force IPv4 — Railway cannot reach Supabase via IPv6
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import gscRoutes from './routes/gsc';
import pagesRoutes from './routes/pages';
import optimizerRoutes from './routes/optimizer';
import wordpressRoutes from './routes/wordpress';
import adminRoutes from './routes/admin';
import billingRoutes from './routes/billing';
import { errorHandler } from './middleware/auth';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Trust Railway's proxy (fixes X-Forwarded-For for rate limiting)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS — allow Vercel domains + localhost
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  /\.vercel\.app$/,
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Temporary debug endpoint
app.get('/debug-db', async (_req, res) => {
  try {
    const { supabase } = await import('./db');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      res.json({ status: 'failed', error: error.message, hint: error.hint });
    } else {
      res.json({ status: 'connected', supabaseUrl: process.env.SUPABASE_URL || 'https://neksmycluzwhmvsfowxy.supabase.co', data });
    }
  } catch (err: unknown) {
    const error = err as Error;
    res.json({ status: 'error', error: error.message });
  }
});

// Stripe webhook (raw body required)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const { stripeService } = await import('./services/stripeService');
  try {
    await stripeService.handleWebhook(req, res);
  } catch (err) {
    console.error('Stripe webhook error:', err);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/gsc', gscRoutes);
app.use('/api/pages', pagesRoutes);
app.use('/api/optimizer', optimizerRoutes);
app.use('/api/wordpress', wordpressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`RankRevive API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
