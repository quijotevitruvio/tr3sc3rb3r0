// Panel superadmin: lista de orgs cliente + gestión de API keys de LLM por org.
// Solo accesible para users con is_superadmin = true.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, isNull, count, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { organizations, orgMembers, users, orgApiKeys, contacts, companies, deals } from '../../db/schema.js';
import { idToString } from '../../lib/uuid.js';
import { requireSuperadmin } from '../../middleware/auth.js';
import { encryptSecret, maskKeyHint } from '../../lib/crypto.js';
import { tryParseId } from '../crm/helpers.js';

export const adminRoutes = new Hono();
adminRoutes.use('*', requireSuperadmin);

// ─── LIST orgs con stats + keys configuradas ─────────────────────
adminRoutes.get('/orgs', async (c) => {
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      tier: organizations.tier,
      createdAt: organizations.createdAt,
      deletedAt: organizations.deletedAt,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  // Para cada org, traer member count, llaves configuradas, y conteos básicos.
  const enriched = await Promise.all(orgs.map(async (org) => {
    const [[{ value: memberCount }], keys, [{ value: contactCount }], [{ value: dealCount }]] = await Promise.all([
      db.select({ value: count() }).from(orgMembers).where(eq(orgMembers.orgId, org.id)),
      db.select({
        provider: orgApiKeys.provider,
        hint: orgApiKeys.keyHint,
        updatedAt: orgApiKeys.updatedAt,
      }).from(orgApiKeys).where(eq(orgApiKeys.orgId, org.id)),
      db.select({ value: count() }).from(contacts).where(and(eq(contacts.orgId, org.id), isNull(contacts.deletedAt))),
      db.select({ value: count() }).from(deals).where(and(eq(deals.orgId, org.id), isNull(deals.deletedAt))),
    ]);

    return {
      id: idToString(org.id),
      name: org.name,
      slug: org.slug,
      tier: org.tier,
      createdAt: org.createdAt,
      deleted: !!org.deletedAt,
      members: memberCount,
      contacts: contactCount,
      deals: dealCount,
      apiKeys: keys.reduce((acc: Record<string, any>, k) => {
        acc[k.provider] = { hint: k.hint, updatedAt: k.updatedAt };
        return acc;
      }, {}),
    };
  }));

  return c.json({ orgs: enriched });
});

// ─── GET miembros de una org (para superadmin) ───────────────────
adminRoutes.get('/orgs/:id/members', async (c) => {
  const orgId = tryParseId(c.req.param('id'));
  if (!orgId) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      role: orgMembers.role,
      joinedAt: orgMembers.createdAt,
    })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));
  return c.json({ members: rows.map((m) => ({ ...m, userId: idToString(m.userId) })) });
});

// ─── SET/UPDATE API key de un proveedor para una org ─────────────
const setKeySchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'openrouter']),
  key: z.string().trim().min(10, 'Key demasiado corta').max(500),
  priority: z.number().int().min(0).max(99).default(0),
});

adminRoutes.post('/orgs/:id/api-keys', zValidator('json', setKeySchema), async (c) => {
  const orgId = tryParseId(c.req.param('id'));
  if (!orgId) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  const user = c.get('user')!;

  // Validar que la org existe.
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return c.json({ error: { code: 'ORG_NOT_FOUND' } }, 404);

  const { provider, key, priority } = c.req.valid('json');
  const keyCiphertext = encryptSecret(key);
  const keyHint = maskKeyHint(key);

  // Upsert: si ya existe (orgId+provider), reemplaza.
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

// ─── DELETE API key ──────────────────────────────────────────────
adminRoutes.delete('/orgs/:id/api-keys/:provider', async (c) => {
  const orgId = tryParseId(c.req.param('id'));
  if (!orgId) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  const provider = c.req.param('provider');
  if (!['anthropic', 'openai', 'gemini', 'openrouter'].includes(provider)) {
    return c.json({ error: { code: 'INVALID_PROVIDER' } }, 400);
  }
  await db.delete(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.provider, provider as any)));
  return c.json({ ok: true });
});

// ─── PROMOTE/DEMOTE superadmin ───────────────────────────────────
const promoteSchema = z.object({ isSuperadmin: z.boolean() });
adminRoutes.post('/users/:id/superadmin', zValidator('json', promoteSchema), async (c) => {
  const userId = tryParseId(c.req.param('id'));
  if (!userId) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  const { isSuperadmin } = c.req.valid('json');
  await db.update(users).set({ isSuperadmin }).where(eq(users.id, userId));
  return c.json({ ok: true });
});
