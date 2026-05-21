// Endpoints "self-service" del cliente final: ver sus propias API keys, setearlas (solo Max).
// NO requiere superadmin — el cliente Max es dueño de su cuota IA con BYOK.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { orgApiKeys } from '../../db/schema.js';
import { authedOrg } from '../../middleware/org-context.js';
import { encryptSecret, maskKeyHint } from '../../lib/crypto.js';

export const meRoutes = new Hono();
meRoutes.use('*', ...authedOrg);

// Solo Max accede a BYOK self-service. Demo/Básico/Pro usan keys del admin.
function requireMax(tier: string) {
  return tier === 'max';
}

// ─── LIST MIS API KEYS ───────────────────────────────────────────
meRoutes.get('/api-keys', async (c) => {
  const { orgId, tier } = c.get('org');
  if (!requireMax(tier)) {
    return c.json({
      error: { code: 'TIER_REQUIRED', message: 'BYOK self-service es exclusivo del plan Max.', required: 'max', current: tier },
    }, 402);
  }
  const rows = await db
    .select({ provider: orgApiKeys.provider, hint: orgApiKeys.keyHint, updatedAt: orgApiKeys.updatedAt })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId));
  return c.json({
    keys: rows.reduce((acc: Record<string, any>, k) => {
      acc[k.provider] = { hint: k.hint, updatedAt: k.updatedAt };
      return acc;
    }, {}),
  });
});

// ─── SET/UPDATE una key propia ───────────────────────────────────
const setKeySchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter']),
  key: z.string().trim().min(10, 'Key demasiado corta').max(500),
  priority: z.number().int().min(0).max(99).default(0),
});

meRoutes.post('/api-keys', zValidator('json', setKeySchema), async (c) => {
  const { orgId, tier } = c.get('org');
  const user = c.get('user')!;
  if (!requireMax(tier)) {
    return c.json({ error: { code: 'TIER_REQUIRED', message: 'Plan Max requerido.', required: 'max', current: tier } }, 402);
  }

  const { provider, key, priority } = c.req.valid('json');
  const keyCiphertext = encryptSecret(key);
  const keyHint = maskKeyHint(key);

  const [existing] = await db
    .select({ orgId: orgApiKeys.orgId })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.provider, provider)))
    .limit(1);

  if (existing) {
    await db.update(orgApiKeys)
      .set({ keyCiphertext, keyHint, priority, setBy: user.id })
      .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.provider, provider)));
  } else {
    await db.insert(orgApiKeys).values({
      orgId, provider, keyCiphertext, keyHint, priority, setBy: user.id,
    });
  }
  return c.json({ ok: true, provider, hint: keyHint });
});

meRoutes.delete('/api-keys/:provider', async (c) => {
  const { orgId, tier } = c.get('org');
  if (!requireMax(tier)) {
    return c.json({ error: { code: 'TIER_REQUIRED', message: 'Plan Max requerido.', required: 'max', current: tier } }, 402);
  }
  const provider = c.req.param('provider');
  if (!['anthropic', 'openai', 'gemini', 'openrouter'].includes(provider)) {
    return c.json({ error: { code: 'INVALID_PROVIDER' } }, 400);
  }
  await db.delete(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.provider, provider as any)));
  return c.json({ ok: true });
});
