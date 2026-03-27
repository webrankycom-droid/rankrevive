import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://neksmycluzwhmvsfowxy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Supabase client — uses HTTPS (PostgREST) instead of direct TCP PostgreSQL
// This avoids Railway's IPv6 limitation with Supabase direct connections
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Generic query helper using Supabase RPC for raw SQL
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query_text: text,
    query_params: params || [],
  });
  if (error) throw new Error(error.message);
  return (data as T[]) || [];
}

// Single row helper
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Transaction helper (basic — runs queries sequentially)
export async function withTransaction<T>(
  callback: (client: typeof supabase) => Promise<T>
): Promise<T> {
  return callback(supabase);
}

// Convert snake_case keys to camelCase
export function camelizeKeys<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

// Redis client (optional — gracefully degrades if not available)
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 2) return null;
    return Math.min(times * 100, 1000);
  },
});

redis.on('error', () => {
  // Redis is optional — silently ignore connection errors
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch { /* Redis optional */ }
}

export async function cacheDel(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* Redis optional */ }
}

// Keep pg pool as fallback export for compatibility
export default supabase;
