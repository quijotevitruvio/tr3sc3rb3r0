// Deals CRUD + move stage + close (won/lost).
// Activity log automático en create, update, move, close.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, isNull, count, desc, like } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { deals, pipelines, stages, contacts, companies } from '../../../db/schema.js';
import { newId, idToString, idFromString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId, parsePagination } from '../helpers.js';
import { dealCreateSchema, dealUpdateSchema, dealMoveStageSchema, dealCloseSchema } from '../schemas.js';

export const dealRoutes = new Hono();
dealRoutes.use('*', ...authedOrg);

// Helper: validar que (pipeline, stage) son de la org y consistentes entre sí.
async function assertPipelineStage(orgId: Buffer, pipelineId: Buffer, stageId: Buffer) {
  const [pipe] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)))
    .limit(1);
  if (!pipe) return { ok: false as const, code: 'PIPELINE_NOT_FOUND' };

  const [stage] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.id, stageId), eq(stages.pipelineId, pipelineId)))
    .limit(1);
  if (!stage) return { ok: false as const, code: 'STAGE_NOT_IN_PIPELINE' };

  return { ok: true as const };
}

// ─── LIST deals (paginado, filtros opcionales) ───────────────────
// Soporta: ?pipelineId=...&stageId=...&status=open|won|lost&q=...
dealRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);

  const filters = [eq(deals.orgId, orgId), isNull(deals.deletedAt)];

  if (q.pipelineId) {
    const pid = tryParseId(q.pipelineId);
    if (pid) filters.push(eq(deals.pipelineId, pid));
  }
  if (q.stageId) {
    const sid = tryParseId(q.stageId);
    if (sid) filters.push(eq(deals.stageId, sid));
  }
  if (q.status && ['open', 'won', 'lost'].includes(q.status)) {
    filters.push(eq(deals.status, q.status as 'open' | 'won' | 'lost'));
  }
  if (q.q) {
    filters.push(like(deals.title, `%${q.q.trim()}%`));
  }

  const where = and(...filters);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: deals.id,
        title: deals.title,
        amount: deals.amount,
        currency: deals.currency,
        status: deals.status,
        stageId: deals.stageId,
        stageName: stages.name,
        pipelineId: deals.pipelineId,
        contactId: deals.contactId,
        contactName: contacts.firstName,
        contactLastName: contacts.lastName,
        companyId: deals.companyId,
        companyName: companies.name,
        assignedTo: deals.assignedTo,
        expectedCloseDate: deals.expectedCloseDate,
        createdAt: deals.createdAt,
      })
      .from(deals)
      .leftJoin(stages, eq(deals.stageId, stages.id))
      .leftJoin(contacts, eq(deals.contactId, contacts.id))
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .where(where)
      .orderBy(desc(deals.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(deals).where(where),
  ]);

  return c.json({
    deals: rows.map((r) => ({
      id: idToString(r.id),
      title: r.title,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      pipelineId: idToString(r.pipelineId),
      stage: r.stageId ? { id: idToString(r.stageId), name: r.stageName } : null,
      contact: r.contactId ? { id: idToString(r.contactId), name: `${r.contactName ?? ''} ${r.contactLastName ?? ''}`.trim() } : null,
      company: r.companyId ? { id: idToString(r.companyId), name: r.companyName } : null,
      assignedTo: r.assignedTo ? idToString(r.assignedTo) : null,
      expectedCloseDate: r.expectedCloseDate,
      createdAt: r.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ─── GET deal ────────────────────────────────────────────────────
dealRoutes.get('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [row] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  return c.json({
    deal: {
      ...row,
      id: idToString(row.id),
      pipelineId: idToString(row.pipelineId),
      stageId: idToString(row.stageId),
      contactId: row.contactId ? idToString(row.contactId) : null,
      companyId: row.companyId ? idToString(row.companyId) : null,
      assignedTo: row.assignedTo ? idToString(row.assignedTo) : null,
    },
  });
});

// ─── CREATE ──────────────────────────────────────────────────────
dealRoutes.post('/', zValidator('json', dealCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const input = c.req.valid('json');

  const pipelineId = idFromString(input.pipelineId);
  const stageId = idFromString(input.stageId);

  const ps = await assertPipelineStage(orgId, pipelineId, stageId);
  if (!ps.ok) return c.json({ error: { code: ps.code } }, 400);

  const contactId = input.contactId ? idFromString(input.contactId) : null;
  const companyId = input.companyId ? idFromString(input.companyId) : null;
  const assignedTo = input.assignedTo ? idFromString(input.assignedTo) : null;

  const id = newId();
  await db.insert(deals).values({
    id,
    orgId,
    pipelineId,
    stageId,
    contactId,
    companyId,
    assignedTo,
    title: input.title,
    amount: String(input.amount), // decimal field acepta string
    currency: input.currency,
    expectedCloseDate: input.expectedCloseDate ?? null,
  });
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: 'created',
    payload: { title: input.title, amount: input.amount, stageId: input.stageId },
  });

  return c.json({ deal: { id: idToString(id), ...input } }, 201);
});

// ─── UPDATE (campos varios; mover stage tiene endpoint propio) ───
dealRoutes.patch('/:id', zValidator('json', dealUpdateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const patch = c.req.valid('json');
  if (Object.keys(patch).length === 0) return c.json({ ok: true });

  const set: Record<string, unknown> = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.amount !== undefined) set.amount = String(patch.amount);
  if (patch.currency !== undefined) set.currency = patch.currency;
  if (patch.expectedCloseDate !== undefined) set.expectedCloseDate = patch.expectedCloseDate ?? null;
  if (patch.contactId !== undefined) set.contactId = patch.contactId ? idFromString(patch.contactId) : null;
  if (patch.companyId !== undefined) set.companyId = patch.companyId ? idFromString(patch.companyId) : null;
  if (patch.assignedTo !== undefined) set.assignedTo = patch.assignedTo ? idFromString(patch.assignedTo) : null;

  // Si patch.stageId viene acá (cambio sin mover formal), validar consistencia con pipeline.
  if (patch.stageId !== undefined) {
    const newStageId = idFromString(patch.stageId);
    const pid = patch.pipelineId ? idFromString(patch.pipelineId) : existing.pipelineId;
    const ps = await assertPipelineStage(orgId, pid, newStageId);
    if (!ps.ok) return c.json({ error: { code: ps.code } }, 400);
    set.stageId = newStageId;
    if (patch.pipelineId) set.pipelineId = pid;
  }

  await db.update(deals).set(set as any).where(and(eq(deals.id, id), eq(deals.orgId, orgId)));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: 'updated',
    payload: { fields: Object.keys(patch) },
  });

  return c.json({ ok: true });
});

// ─── MOVE STAGE (atajo dedicado para drag&drop en kanban) ────────
dealRoutes.post('/:id/move', zValidator('json', dealMoveStageSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({
      id: deals.id,
      pipelineId: deals.pipelineId,
      stageId: deals.stageId,
      status: deals.status,
    })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (existing.status !== 'open') {
    return c.json({ error: { code: 'DEAL_CLOSED', message: 'Deal cerrado no se puede mover.' } }, 409);
  }

  const newStageId = idFromString(c.req.valid('json').stageId);
  const ps = await assertPipelineStage(orgId, existing.pipelineId, newStageId);
  if (!ps.ok) return c.json({ error: { code: ps.code } }, 400);

  if (Buffer.compare(existing.stageId, newStageId) === 0) {
    return c.json({ ok: true, unchanged: true });
  }

  await db.update(deals).set({ stageId: newStageId }).where(eq(deals.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: 'moved',
    payload: { fromStageId: idToString(existing.stageId), toStageId: idToString(newStageId) },
  });

  return c.json({ ok: true });
});

// ─── CLOSE (won/lost) ────────────────────────────────────────────
dealRoutes.post('/:id/close', zValidator('json', dealCloseSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: deals.id, status: deals.status })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (existing.status !== 'open') {
    return c.json({ error: { code: 'ALREADY_CLOSED', message: 'Deal ya está cerrado.' } }, 409);
  }

  const { outcome, lostReason } = c.req.valid('json');
  await db
    .update(deals)
    .set({
      status: outcome,
      closedAt: new Date(),
      lostReason: outcome === 'lost' ? lostReason ?? null : null,
    })
    .where(eq(deals.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: outcome,
    payload: outcome === 'lost' ? { reason: lostReason } : undefined,
  });

  return c.json({ ok: true });
});

// ─── REOPEN (vuelve a open desde won/lost) ───────────────────────
dealRoutes.post('/:id/reopen', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: deals.id, status: deals.status })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);
  if (existing.status === 'open') return c.json({ ok: true, unchanged: true });

  await db
    .update(deals)
    .set({ status: 'open', closedAt: null, lostReason: null })
    .where(eq(deals.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: 'reopened',
  });

  return c.json({ ok: true });
});

// ─── SOFT DELETE ─────────────────────────────────────────────────
dealRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  await db.update(deals).set({ deletedAt: new Date() }).where(eq(deals.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'deal',
    entityId: id,
    verb: 'deleted',
  });

  return c.json({ ok: true });
});
