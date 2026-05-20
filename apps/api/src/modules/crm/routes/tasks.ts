// Tasks: pendientes con due date. Asignables a usuario y opcionalmente a entidad.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, asc, isNull, lte, gte, count } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { tasks, contacts, companies, deals } from '../../../db/schema.js';
import { newId, idToString, idFromString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId, parsePagination } from '../helpers.js';
import { taskCreateSchema, taskUpdateSchema } from '../schemas.js';

export const taskRoutes = new Hono();
taskRoutes.use('*', ...authedOrg);

// Helper polimórfico
async function assertEntityOwnership(orgId: Buffer, type: 'contact' | 'company' | 'deal', entityId: Buffer) {
  const table = type === 'contact' ? contacts : type === 'company' ? companies : deals;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, entityId), eq(table.orgId, orgId), isNull(table.deletedAt)))
    .limit(1);
  return !!row;
}

// ─── LIST tasks (filtros: status, assignedToMe, dueBy=YYYY-MM-DD) ──
taskRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);

  const filters = [eq(tasks.orgId, orgId)];

  if (q.status && ['todo', 'done'].includes(q.status)) {
    filters.push(eq(tasks.status, q.status as 'todo' | 'done'));
  }
  if (q.assignedToMe === 'true') {
    filters.push(eq(tasks.assignedTo, user.id));
  } else if (q.assignedTo) {
    const uid = tryParseId(q.assignedTo);
    if (uid) filters.push(eq(tasks.assignedTo, uid));
  }
  if (q.dueBy) {
    const d = new Date(q.dueBy);
    if (!isNaN(d.getTime())) filters.push(lte(tasks.dueAt, d));
  }
  if (q.dueFrom) {
    const d = new Date(q.dueFrom);
    if (!isNaN(d.getTime())) filters.push(gte(tasks.dueAt, d));
  }
  if (q.entityType && q.entityId) {
    const eid = tryParseId(q.entityId);
    if (eid) {
      filters.push(eq(tasks.entityType, q.entityType as any));
      filters.push(eq(tasks.entityId, eid));
    }
  }

  const where = and(...filters);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(where)
      .orderBy(asc(tasks.dueAt), desc(tasks.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(tasks).where(where),
  ]);

  return c.json({
    tasks: rows.map((t) => ({
      id: idToString(t.id),
      title: t.title,
      description: t.description,
      status: t.status,
      dueAt: t.dueAt,
      completedAt: t.completedAt,
      assignedTo: t.assignedTo ? idToString(t.assignedTo) : null,
      createdBy: idToString(t.createdBy),
      entityType: t.entityType,
      entityId: t.entityId ? idToString(t.entityId) : null,
      createdAt: t.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ─── CREATE ──────────────────────────────────────────────────────
taskRoutes.post('/', zValidator('json', taskCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const input = c.req.valid('json');

  let entityIdBuf: Buffer | null = null;
  if (input.entityType !== 'none') {
    if (!input.entityId) return c.json({ error: { code: 'ENTITY_ID_REQUIRED' } }, 400);
    entityIdBuf = idFromString(input.entityId);
    const owned = await assertEntityOwnership(orgId, input.entityType as any, entityIdBuf);
    if (!owned) return c.json({ error: { code: 'ENTITY_NOT_FOUND' } }, 404);
  }

  const id = newId();
  await db.insert(tasks).values({
    id,
    orgId,
    createdBy: user.id,
    assignedTo: input.assignedTo ? idFromString(input.assignedTo) : null,
    entityType: input.entityType,
    entityId: entityIdBuf,
    title: input.title,
    description: input.description ?? null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
  });
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'task',
    entityId: id,
    verb: 'created',
    payload: { title: input.title, dueAt: input.dueAt },
  });

  return c.json({ task: { id: idToString(id), ...input } }, 201);
});

// ─── UPDATE ──────────────────────────────────────────────────────
taskRoutes.patch('/:id', zValidator('json', taskUpdateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const patch = c.req.valid('json');
  if (Object.keys(patch).length === 0) return c.json({ ok: true });

  const set: Record<string, unknown> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description ?? null;
  if (patch.dueAt !== undefined) set.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
  if (patch.assignedTo !== undefined) set.assignedTo = patch.assignedTo ? idFromString(patch.assignedTo) : null;

  await db.update(tasks).set(set as any).where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'task',
    entityId: id,
    verb: 'updated',
    payload: { fields: Object.keys(patch) },
  });

  return c.json({ ok: true });
});

// ─── MARK DONE / UNDONE ──────────────────────────────────────────
taskRoutes.post('/:id/complete', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (existing.status === 'done') return c.json({ ok: true, unchanged: true });

  await db.update(tasks).set({ status: 'done', completedAt: new Date() }).where(eq(tasks.id, id));
  await logActivity({ orgId, actorId: user.id, entityType: 'task', entityId: id, verb: 'completed' });
  return c.json({ ok: true });
});

taskRoutes.post('/:id/uncomplete', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (existing.status === 'todo') return c.json({ ok: true, unchanged: true });

  await db.update(tasks).set({ status: 'todo', completedAt: null }).where(eq(tasks.id, id));
  await logActivity({ orgId, actorId: user.id, entityType: 'task', entityId: id, verb: 'reopened' });
  return c.json({ ok: true });
});

// ─── DELETE ──────────────────────────────────────────────────────
taskRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  await db.delete(tasks).where(eq(tasks.id, id));
  return c.json({ ok: true });
});
