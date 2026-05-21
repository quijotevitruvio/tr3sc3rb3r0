// Endpoints CRUD para reglas, automatizaciones y plantillas de email.
// Solo admin_org puede modificar; cualquier user_org puede leer.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scoringRules, automations, emailTemplates, RULE_TRIGGERS } from '../../db/schema.js';
import { newId, idToString } from '../../lib/uuid.js';
import { authedOrg } from '../../middleware/org-context.js';
import { tryParseId } from '../crm/helpers.js';

export const engineRoutes = new Hono();
engineRoutes.use('*', ...authedOrg);

// ─── SCORING RULES ───────────────────────────────────────────────
const ruleSchema = z.object({
  name: z.string().trim().min(1).max(150),
  trigger: z.enum(RULE_TRIGGERS),
  delta: z.number().int().min(-1000).max(1000),
  conditionJson: z.record(z.any()).nullable().optional(),
  enabled: z.boolean().default(true),
});

engineRoutes.get('/rules', async (c) => {
  const { orgId } = c.get('org');
  const rows = await db.select().from(scoringRules)
    .where(eq(scoringRules.orgId, orgId)).orderBy(desc(scoringRules.createdAt));
  return c.json({ rules: rows.map((r) => ({ ...r, id: idToString(r.id) })) });
});

engineRoutes.post('/rules', zValidator('json', ruleSchema), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const data = c.req.valid('json');
  const id = newId();
  await db.insert(scoringRules).values({ id, orgId, ...data });
  return c.json({ rule: { id: idToString(id), ...data } }, 201);
});

engineRoutes.patch('/rules/:id', zValidator('json', ruleSchema.partial()), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.update(scoringRules).set(c.req.valid('json') as any)
    .where(and(eq(scoringRules.id, id), eq(scoringRules.orgId, orgId)));
  return c.json({ ok: true });
});

engineRoutes.delete('/rules/:id', async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.delete(scoringRules).where(and(eq(scoringRules.id, id), eq(scoringRules.orgId, orgId)));
  return c.json({ ok: true });
});

// ─── AUTOMATIONS ─────────────────────────────────────────────────
const automationSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().max(500).optional(),
  trigger: z.enum(RULE_TRIGGERS),
  conditionJson: z.record(z.any()).nullable().optional(),
  actionsJson: z.array(z.record(z.any())).min(1, 'Al menos 1 acción'),
  enabled: z.boolean().default(true),
});

engineRoutes.get('/automations', async (c) => {
  const { orgId } = c.get('org');
  const rows = await db.select().from(automations)
    .where(eq(automations.orgId, orgId)).orderBy(desc(automations.createdAt));
  return c.json({ automations: rows.map((r) => ({ ...r, id: idToString(r.id) })) });
});

engineRoutes.post('/automations', zValidator('json', automationSchema), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const data = c.req.valid('json');
  const id = newId();
  await db.insert(automations).values({ id, orgId, ...data, description: data.description ?? null });
  return c.json({ automation: { id: idToString(id), ...data } }, 201);
});

engineRoutes.patch('/automations/:id', zValidator('json', automationSchema.partial()), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.update(automations).set(c.req.valid('json') as any)
    .where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
  return c.json({ ok: true });
});

engineRoutes.delete('/automations/:id', async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.delete(automations).where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
  return c.json({ ok: true });
});

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────
const templateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20_000),
  category: z.enum(['welcome', 'follow_up', 'proposal', 'reminder', 'custom']).default('custom'),
});

engineRoutes.get('/templates', async (c) => {
  const { orgId } = c.get('org');
  const rows = await db.select().from(emailTemplates)
    .where(eq(emailTemplates.orgId, orgId)).orderBy(desc(emailTemplates.updatedAt));
  return c.json({ templates: rows.map((r) => ({ ...r, id: idToString(r.id) })) });
});

engineRoutes.post('/templates', zValidator('json', templateSchema), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const data = c.req.valid('json');
  const id = newId();
  await db.insert(emailTemplates).values({ id, orgId, ...data });
  return c.json({ template: { id: idToString(id), ...data } }, 201);
});

engineRoutes.patch('/templates/:id', zValidator('json', templateSchema.partial()), async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.update(emailTemplates).set(c.req.valid('json') as any)
    .where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId)));
  return c.json({ ok: true });
});

engineRoutes.delete('/templates/:id', async (c) => {
  const { orgId, role } = c.get('org');
  if (role !== 'admin_org') return c.json({ error: { code: 'FORBIDDEN' } }, 403);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);
  await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId)));
  return c.json({ ok: true });
});

// ─── METADATA (para que la UI ofrezca opciones) ──────────────────
engineRoutes.get('/meta', async (c) => {
  return c.json({
    triggers: RULE_TRIGGERS,
    actionTypes: ['create_task', 'add_tag', 'move_deal_to_stage'],
    templateCategories: ['welcome', 'follow_up', 'proposal', 'reminder', 'custom'],
    conditionFields: ['amountMin', 'amountMax', 'stageName', 'tagName', 'tagIs', 'status', 'currency', 'sourceContains'],
  });
});
