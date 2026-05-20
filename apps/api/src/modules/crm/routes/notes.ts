// Notes polimórficas: contact/company/deal. Sin FK, validamos en código.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { notes, contacts, companies, deals } from '../../../db/schema.js';
import { newId, idToString, idFromString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId } from '../helpers.js';
import { noteCreateSchema } from '../schemas.js';
import { parseNoteBody } from '../note-parser.js';

export const noteRoutes = new Hono();
noteRoutes.use('*', ...authedOrg);

// Verifica que la entidad polimórfica pertenece a la org.
async function assertEntityOwnership(orgId: Buffer, type: 'contact' | 'company' | 'deal', entityId: Buffer) {
  const table = type === 'contact' ? contacts : type === 'company' ? companies : deals;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.orgId, orgId), isNull(table.deletedAt)))
    .limit(1);
  return !!row;
}

// ─── LIST notes de una entidad ───────────────────────────────────
// GET /api/crm/notes?entityType=contact&entityId=...
noteRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const q = c.req.query();
  if (!q.entityType || !['contact', 'company', 'deal'].includes(q.entityType)) {
    return c.json({ error: { code: 'INVALID_ENTITY_TYPE' } }, 400);
  }
  const entityId = tryParseId(q.entityId || '');
  if (!entityId) return c.json({ error: { code: 'INVALID_ENTITY_ID' } }, 400);

  const owned = await assertEntityOwnership(orgId, q.entityType as any, entityId);
  if (!owned) return c.json({ error: { code: 'ENTITY_NOT_FOUND' } }, 404);

  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.orgId, orgId), eq(notes.entityType, q.entityType as any), eq(notes.entityId, entityId)))
    .orderBy(desc(notes.createdAt));

  return c.json({
    notes: rows.map((n) => ({
      id: idToString(n.id),
      authorId: idToString(n.authorId),
      body: n.body,
      isAiGenerated: n.isAiGenerated,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
  });
});

// ─── CREATE note ─────────────────────────────────────────────────
noteRoutes.post('/', zValidator('json', noteCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const { entityType, entityId, body } = c.req.valid('json');

  const eid = idFromString(entityId);
  const owned = await assertEntityOwnership(orgId, entityType, eid);
  if (!owned) return c.json({ error: { code: 'ENTITY_NOT_FOUND' } }, 404);

  const id = newId();
  await db.insert(notes).values({
    id,
    orgId,
    authorId: user.id,
    entityType,
    entityId: eid,
    body,
  });
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'note',
    entityId: id,
    verb: 'created',
    payload: { on: { type: entityType, id: entityId } },
  });

  // Parser Obsidian-style: extrae #hashtags → tags y [[wikilinks]] → entity_links.
  const parsed = await parseNoteBody({ orgId, noteId: id, entityType, entityId: eid, body });

  return c.json({ note: { id: idToString(id), body, entityType, entityId }, parsed }, 201);
});

// ─── DELETE note (solo el autor puede borrar; en Fase 4 add admin override) ──
noteRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: notes.id, authorId: notes.authorId })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.orgId, orgId)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (Buffer.compare(existing.authorId, user.id) !== 0) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'Solo el autor puede borrar la nota.' } }, 403);
  }

  await db.delete(notes).where(eq(notes.id, id));
  return c.json({ ok: true });
});
