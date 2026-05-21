// Ejecuta acciones de una automatización.
// Cada action es un objeto { type, ...params }. Aplica sobre la entidad fuente del evento
// (la del activity que disparó el trigger), o sobre el contact asociado si aplica.
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { tasks, tags, entityTags, deals, stages } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';
import type { TriggerEvent } from './trigger.js';

export interface ActionContext {
  orgId: Buffer;
  actorId: Buffer | null; // null si lo dispara el sistema (cron, parser)
  sourceEvent: TriggerEvent;
}

type Action =
  | { type: 'create_task'; title: string; description?: string; dueOffsetDays?: number; attachToSource?: boolean }
  | { type: 'add_tag'; tagName: string }
  | { type: 'move_deal_to_stage'; stageName: string };

// Logger de actions (no falla todo si una action rompe, sólo esa).
export async function runActions(actions: Action[], ctx: ActionContext) {
  for (const a of actions) {
    try {
      await runOne(a, ctx);
    } catch (err) {
      console.warn('[engine] action fail', a, err);
    }
  }
}

async function runOne(action: Action, ctx: ActionContext) {
  switch (action.type) {
    case 'create_task': return doCreateTask(action, ctx);
    case 'add_tag': return doAddTag(action, ctx);
    case 'move_deal_to_stage': return doMoveDealToStage(action, ctx);
    default:
      console.warn('[engine] action type desconocido', (action as any).type);
  }
}

async function doCreateTask(a: { type: 'create_task'; title: string; description?: string; dueOffsetDays?: number; attachToSource?: boolean }, ctx: ActionContext) {
  const dueAt = a.dueOffsetDays
    ? new Date(Date.now() + a.dueOffsetDays * 86400 * 1000)
    : null;

  const attachToSource = a.attachToSource !== false; // default true
  const validEntities = ['contact', 'company', 'deal'] as const;
  const isAttachable = attachToSource && (validEntities as readonly string[]).includes(ctx.sourceEvent.entityType);

  await db.insert(tasks).values({
    id: newId(),
    orgId: ctx.orgId,
    createdBy: ctx.actorId ?? ctx.sourceEvent.actorId ?? Buffer.alloc(16), // fallback raro pero NOT NULL
    assignedTo: ctx.actorId,
    entityType: isAttachable ? (ctx.sourceEvent.entityType as any) : 'none',
    entityId: isAttachable ? ctx.sourceEvent.entityId : null,
    title: a.title,
    description: a.description ?? null,
    dueAt,
  });
}

async function doAddTag(a: { type: 'add_tag'; tagName: string }, ctx: ActionContext) {
  const validEntities = ['contact', 'company', 'deal'] as const;
  if (!(validEntities as readonly string[]).includes(ctx.sourceEvent.entityType)) return;

  const name = a.tagName.toLowerCase().trim();
  if (!name) return;

  // Upsert tag
  const [existing] = await db.select({ id: tags.id }).from(tags)
    .where(and(eq(tags.orgId, ctx.orgId), eq(tags.name, name))).limit(1);
  let tagId: Buffer;
  if (existing) {
    tagId = existing.id;
  } else {
    tagId = newId();
    await db.insert(tags).values({ id: tagId, orgId: ctx.orgId, name, category: 'custom' });
  }

  // Asignar (ignorar dup)
  try {
    await db.insert(entityTags).values({
      orgId: ctx.orgId,
      tagId,
      entityType: ctx.sourceEvent.entityType as any,
      entityId: ctx.sourceEvent.entityId,
      assignedBy: null, // automatización
    });
  } catch (e: any) {
    if (e?.code !== 'ER_DUP_ENTRY') throw e;
  }
}

async function doMoveDealToStage(a: { type: 'move_deal_to_stage'; stageName: string }, ctx: ActionContext) {
  if (ctx.sourceEvent.entityType !== 'deal') return;
  // Encontrar stage por nombre dentro del pipeline del deal
  const [deal] = await db.select({ pipelineId: deals.pipelineId, status: deals.status })
    .from(deals).where(eq(deals.id, ctx.sourceEvent.entityId)).limit(1);
  if (!deal || deal.status !== 'open') return;
  const [stage] = await db.select({ id: stages.id }).from(stages)
    .where(and(eq(stages.pipelineId, deal.pipelineId), eq(stages.name, a.stageName))).limit(1);
  if (!stage) return;
  await db.update(deals).set({ stageId: stage.id }).where(eq(deals.id, ctx.sourceEvent.entityId));
}
