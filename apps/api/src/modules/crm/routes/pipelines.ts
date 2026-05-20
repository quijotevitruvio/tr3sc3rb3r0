// Pipelines + Stages. Cuota por tier: 1 Básico, 5 Pro, ilimitado Max.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc, isNull, count, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { pipelines, stages } from '../../../db/schema.js';
import { newId, idToString, idFromString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId } from '../helpers.js';
import { pipelineCreateSchema, stageCreateSchema, stageUpdateSchema, stagesReorderSchema } from '../schemas.js';

const PIPELINE_LIMIT_BY_TIER: Record<string, number> = {
  demo: 5,
  basico: 1,
  pro: 5,
  max: 999,
};

export const pipelineRoutes = new Hono();
pipelineRoutes.use('*', ...authedOrg);

// ─── LIST pipelines de la org ────────────────────────────────────
pipelineRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const rows = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)))
    .orderBy(asc(pipelines.createdAt));

  return c.json({
    pipelines: rows.map((p) => ({
      id: idToString(p.id),
      name: p.name,
      isDefault: p.isDefault,
      createdAt: p.createdAt,
    })),
  });
});

// ─── GET pipeline con sus stages ─────────────────────────────────
pipelineRoutes.get('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)))
    .limit(1);

  if (!pipeline) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.pipelineId, id))
    .orderBy(asc(stages.position));

  return c.json({
    pipeline: {
      id: idToString(pipeline.id),
      name: pipeline.name,
      isDefault: pipeline.isDefault,
      stages: stageRows.map((s) => ({
        id: idToString(s.id),
        name: s.name,
        position: s.position,
        winProbability: s.winProbability,
      })),
    },
  });
});

// ─── CREATE pipeline ─────────────────────────────────────────────
pipelineRoutes.post('/', zValidator('json', pipelineCreateSchema), async (c) => {
  const { orgId, tier } = c.get('org');
  const limit = PIPELINE_LIMIT_BY_TIER[tier] ?? 1;

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(pipelines)
    .where(and(eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)));

  if (existing >= limit) {
    return c.json(
      {
        error: {
          code: 'TIER_LIMIT',
          message: `Tu plan ${tier.toUpperCase()} permite ${limit} pipeline(s). Subí a Pro o Max para más.`,
          current: existing,
          limit,
        },
      },
      402,
    );
  }

  const { name } = c.req.valid('json');
  const id = newId();
  await db.insert(pipelines).values({ id, orgId, name, isDefault: existing === 0 });
  await logActivity({
    orgId,
    actorId: c.get('user')!.id,
    entityType: 'pipeline',
    entityId: id,
    verb: 'created',
    payload: { name },
  });

  return c.json({ pipeline: { id: idToString(id), name, isDefault: existing === 0 } }, 201);
});

// ─── STAGES dentro de un pipeline ────────────────────────────────
pipelineRoutes.post('/:id/stages', zValidator('json', stageCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const pipelineId = tryParseId(c.req.param('id'));
  if (!pipelineId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  // Confirmar que el pipeline es de esta org.
  const [owned] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)))
    .limit(1);
  if (!owned) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const { name, position, winProbability } = c.req.valid('json');
  const id = newId();
  await db.insert(stages).values({ id, pipelineId, name, position, winProbability });

  return c.json({ stage: { id: idToString(id), name, position, winProbability } }, 201);
});

pipelineRoutes.patch('/:id/stages/:stageId', zValidator('json', stageUpdateSchema), async (c) => {
  const { orgId } = c.get('org');
  const pipelineId = tryParseId(c.req.param('id'));
  const stageId = tryParseId(c.req.param('stageId'));
  if (!pipelineId || !stageId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  // Validar ownership vía pipeline.
  const [owned] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId)))
    .limit(1);
  if (!owned) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const patch = c.req.valid('json');
  if (Object.keys(patch).length === 0) return c.json({ ok: true });

  await db.update(stages).set(patch).where(and(eq(stages.id, stageId), eq(stages.pipelineId, pipelineId)));
  return c.json({ ok: true });
});

pipelineRoutes.delete('/:id/stages/:stageId', async (c) => {
  const { orgId } = c.get('org');
  const pipelineId = tryParseId(c.req.param('id'));
  const stageId = tryParseId(c.req.param('stageId'));
  if (!pipelineId || !stageId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [owned] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId)))
    .limit(1);
  if (!owned) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  await db.delete(stages).where(and(eq(stages.id, stageId), eq(stages.pipelineId, pipelineId)));
  return c.json({ ok: true });
});

// Reordenar stages: recibe un array de IDs en el orden deseado.
pipelineRoutes.post('/:id/stages/reorder', zValidator('json', stagesReorderSchema), async (c) => {
  const { orgId } = c.get('org');
  const pipelineId = tryParseId(c.req.param('id'));
  if (!pipelineId) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [owned] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId)))
    .limit(1);
  if (!owned) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const { order } = c.req.valid('json');
  const ids = order.map(idFromString);

  // Validar que todos los stages pertenecen al pipeline.
  const existing = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.pipelineId, pipelineId), inArray(stages.id, ids)));
  if (existing.length !== ids.length) {
    return c.json({ error: { code: 'STAGE_MISMATCH', message: 'Algunos stages no pertenecen al pipeline.' } }, 400);
  }

  // Update positions secuencialmente. Pocos stages (<10 típico), no warrant batch SQL complejo.
  for (let i = 0; i < ids.length; i++) {
    await db.update(stages).set({ position: i }).where(eq(stages.id, ids[i]));
  }

  return c.json({ ok: true });
});
