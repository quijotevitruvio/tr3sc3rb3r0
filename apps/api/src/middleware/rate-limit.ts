// Rate limit in-memory por IP+key. Sliding window simple.
// Sin Redis: si el proceso reinicia, se pierde el contador (aceptable hasta Fase 12).
// En dev: límites x10 para no bloquearnos durante smoke tests.
import { createMiddleware } from 'hono/factory';
import { isProd } from '../config/env.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

export function rateLimit(opts: { key: string; max: number; windowMs: number }) {
  const max = isProd ? opts.max : opts.max * 10;
  return createMiddleware(async (c, next) => {
    const ip = getIp(c);
    const fullKey = `${opts.key}:${ip}`;
    const now = Date.now();
    const b = buckets.get(fullKey);
    if (!b || b.resetAt < now) {
      buckets.set(fullKey, { count: 1, resetAt: now + opts.windowMs });
    } else if (b.count >= max) {
      const retryAfter = Math.ceil((b.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: { code: 'RATE_LIMITED', message: `Demasiados intentos. Reintentá en ${retryAfter}s.` } },
        429,
      );
    } else {
      b.count++;
    }
    return next();
  });
}

// GC ocasional para evitar Map gigante. Llamar cada 10 min vía setInterval en server.ts.
export function purgeRateLimitBuckets(): number {
  const now = Date.now();
  let purged = 0;
  for (const [k, b] of buckets.entries()) {
    if (b.resetAt < now) {
      buckets.delete(k);
      purged++;
    }
  }
  return purged;
}
