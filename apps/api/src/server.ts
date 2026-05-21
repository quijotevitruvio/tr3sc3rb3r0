// Hono entry. CORS estricto, healthcheck, mount de módulos.
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { logger as honoLogger } from 'hono/logger';
import pino from 'pino';
import { env, corsOrigins, isProd } from './config/env.js';
import { authRoutes } from './modules/auth/routes.js';
import { crmRoutes } from './modules/crm/index.js';
import { chatRoutes } from './modules/chat/routes.js';
import { adminRoutes } from './modules/admin/routes.js';
import { engineRoutes } from './modules/engine/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { demoRoutes } from './modules/demo/routes.js';
import { meRoutes } from './modules/me/routes.js';
import { sessionMiddleware } from './middleware/auth.js';
import { purgeRateLimitBuckets } from './middleware/rate-limit.js';
import { purgeExpiredSessions } from './lib/sessions.js';

const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});

const app = new Hono();

app.use('*', secureHeaders());
app.use('*', honoLogger());
app.use(
  '*',
  cors({
    origin: (origin) => (origin && corsOrigins.includes(origin) ? origin : corsOrigins[0]),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);

// sessionMiddleware global: parsea cookie en TODOS los endpoints así requireAuth
// funciona desde cualquier módulo (auth tenía su propio use que solo cubría /api/auth/*).
app.use('*', sessionMiddleware);

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));
app.get('/ready', async (c) => {
  // Ping DB para que Hostinger sepa si está listo de verdad.
  try {
    const { pool } = await import('./db/client.js');
    await pool.query('SELECT 1');
    return c.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'ready check fail');
    return c.json({ ok: false }, 503);
  }
});

app.route('/api/auth', authRoutes);
app.route('/api/crm', crmRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/engine', engineRoutes);
app.route('/api/ai', aiRoutes);
app.route('/api/demo', demoRoutes);
app.route('/api/me', meRoutes);

app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Endpoint no existe.' } }, 404));

app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, 'unhandled');
  return c.json(
    { error: { code: 'INTERNAL', message: isProd ? 'Error interno.' : err.message } },
    500,
  );
});

// GC periódico de buckets de rate-limit + sesiones expiradas (cada 10 min).
setInterval(async () => {
  purgeRateLimitBuckets();
  try {
    const n = await purgeExpiredSessions();
    if (n > 0) logger.debug({ purged: n }, 'sesiones expiradas purgadas');
  } catch (err) {
    logger.warn({ err }, 'purge sesiones fail');
  }
}, 10 * 60 * 1000).unref();

const port = env.PORT;
serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port, env: env.NODE_ENV }, '[api] Tr3sC3rb3r0 listening');
});
