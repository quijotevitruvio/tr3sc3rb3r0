// Tags CRUD + asignación a entidades.
// El parser de notas también crea tags; este módulo expone CRUD manual.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc, desc, inArray, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client.js';
import { tags, entityTags, contacts, companies, deals } from '../../../db/schema.js';
import { newId, idToString, idFromString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { tryParseId } from '../helpers.js';

export const tagRoutes = new Hono();
tagRoutes.use('*', ...authedOrg);

const tagCreateSchema = z.object({
  name: z.string().trim().toLowerCase().min(1).max(80).regex(/^[a-z0-9_\-áéíóúñ]+$/, 'Solo letras, números, guión y guión bajo'),
  category: z.enum(['interest', 'behavior', 'segment', 'custom']).default('custom'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#39ff14'),
});

const assignSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

// ─── LIST tags (con conteo de uso) ────────────────────────────────
tagRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      category: tags.category,
      color: tags.color,
      usage: count(entityTags.tagId),
    })
    .from(tags)
    .leftJoin(entityTags, eq(tags.id, entityTags.tagId))
    .where(eq(tags.orgId, orgId))
    .groupBy(tags.id)
    .orderBy(desc(count(entityTags.tagId)), asc(tags.name));

  return c.json({
    tags: rows.map((r) => ({
      id: idToString(r.id),
      name: r.name,
      category: r.category,
      color: r.color,
      usage: r.usage,
    })),
  });
});

tagRoutes.post('/', zValidator('json', tagCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const { name, category, color } = c.req.valid('json');

  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.orgId, orgId), eq(tags.name, name)))
    .limit(1);
  if (existing) {
    return c.json({ tag: { id: idToString(existing.id), name, category, color }, existing: true });
  }

  const id = newId();
  await db.insert(tags).values({ id, orgId, name, category, color });
  return c.json({ tag: { id: idToString(id), name, category, color } }, 201);
});

tagRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  // Borra primero asignaciones, después el tag.
  await db.delete(entityTags).where(and(eq(entityTags.orgId, orgId), eq(entityTags.tagId, id)));
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.orgId, orgId)));
  return c.json({ ok: true });
});

// ─── ASSIGN tags a una entidad (reemplaza set completo) ──────────
// POST /api/crm/tags/assign/:type/:id  body { tagIds: [...] }
tagRoutes.post('/assign/:type/:id', zValidator('json', assignSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const type = c.req.param('type');
  if (!['contact', 'company', 'deal'].includes(type)) {
    return c.json({ error: { code: 'INVALID_TYPE' } }, 400);
  }
  const entityId = tryParseId(c.req.param('id'));
  if (!entityId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  // Validar ownership de la entidad.
  const table = type === 'contact' ? contacts : type === 'company' ? companies : deals;
  const [owned] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.orgId, orgId)))
    .limit(1);
  if (!owned) return c.json({ error: { code: 'ENTITY_NOT_FOUND' } }, 404);

  const { tagIds } = c.req.valid('json');
  const tagBufs = tagIds.map(idFromString);

  // Validar que todos los tags son de la org.
  if (tagBufs.length) {
    const validTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.orgId, orgId), inArray(tags.id, tagBufs)));
    if (validTags.length !== tagBufs.length) {
      return c.json({ error: { code: 'TAG_NOT_FOUND' } }, 404);
    }
  }

  // Reemplazo total: delete + insert. Aceptable para sets pequeños (<50 tags por entidad).
  await db.delete(entityTags).where(and(
    eq(entityTags.orgId, orgId),
    eq(entityTags.entityType, type as any),
    eq(entityTags.entityId, entityId),
  ));
  for (const tagId of tagBufs) {
    await db.insert(entityTags).values({
      orgId,
      tagId,
      entityType: type as any,
      entityId,
      assignedBy: user.id,
    });
  }

  return c.json({ ok: true, assigned: tagIds.length });
});

// ─── GET tags de una entidad ─────────────────────────────────────
tagRoutes.get('/of/:type/:id', async (c) => {
  const { orgId } = c.get('org');
  const type = c.req.param('type');
  if (!['contact', 'company', 'deal'].includes(type)) {
    return c.json({ error: { code: 'INVALID_TYPE' } }, 400);
  }
  const entityId = tryParseId(c.req.param('id'));
  if (!entityId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const rows = await db
    .select({ id: tags.id, name: tags.name, category: tags.category, color: tags.color })
    .from(entityTags)
    .innerJoin(tags, eq(entityTags.tagId, tags.id))
    .where(and(
      eq(entityTags.orgId, orgId),
      eq(entityTags.entityType, type as any),
      eq(entityTags.entityId, entityId),
    ))
    .orderBy(asc(tags.name));

  return c.json({ tags: rows.map((t) => ({ ...t, id: idToString(t.id) })) });
});
