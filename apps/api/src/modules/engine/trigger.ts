// Dispatcher central de eventos del CRM.
// Lo llama logActivity() automáticamente, así cualquier mutación en el sistema
// dispara evaluación de scoring + automatizaciones sin tocar cada endpoint.
//
// Diseño: el verb de la activity se traduce a un eventType normalizado
// (ej. activity verb 'created' sobre entity 'deal' → 'deal_created').
// Esto le da al engine vocabulario estable.

import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { scoringRules, automations, contacts, deals } from '../../db/schema.js';
import { matchesCondition, type ConditionInput } from './condition.js';
import { runActions, type ActionContext } from './actions.js';

export interface TriggerEvent {
  orgId: Buffer;
  actorId: Buffer | null;
  eventType: string; // ej. 'deal_won', 'contact_created'
  entityType: 'contact' | 'company' | 'deal' | 'task' | 'note' | 'pipeline';
  entityId: Buffer;
  payload?: Record<string, unknown>;
}

// Mapa de (activity verb, entity type) → eventType para reglas/automations.
// Si no hay match en este mapa, no se dispara nada (verbos genéricos como 'updated' los ignoramos por ahora).
function deriveEventType(entityType: string, verb: string): string | null {
  const key = `${entityType}_${verb}`;
  const VALID = new Set([
    'contact_created', 'contact_updated', 'contact_deleted',
    'company_created', 'company_updated', 'company_deleted',
    'deal_created', 'deal_updated', 'deal_moved', 'deal_won', 'deal_lost', 'deal_reopened',
    'note_created',
    'task_created', 'task_completed',
    'tag_assigned',
  ]);
  return VALID.has(key) ? key : null;
}

// API pública: invocada desde logActivity (que vive en crm/helpers.ts).
export async function dispatchActivity(activity: {
  orgId: Buffer;
  actorId: Buffer | null;
  entityType: string;
  entityId: Buffer;
  verb: string;
  payload?: any;
}) {
  const eventType = deriveEventType(activity.entityType, activity.verb);
  if (!eventType) return;

  await processEvent({
    orgId: activity.orgId,
    actorId: activity.actorId,
    eventType,
    entityType: activity.entityType as any,
    entityId: activity.entityId,
    payload: activity.payload ?? {},
  }).catch((err) => {
    // No reventamos el endpoint si el engine falla — log y seguir.
    console.warn('[engine] dispatch fail', eventType, err);
  });
}

// MariaDB devuelve columnas JSON como string; parsear si hace falta.
function parseJsonField<T>(v: any): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v as T;
}

async function processEvent(ev: TriggerEvent) {
  // Hidratar input de condición desde payload + entidad cuando aplique.
  const condInput = await buildConditionInput(ev);

  // 1) Scoring rules
  const rules = await db
    .select()
    .from(scoringRules)
    .where(and(
      eq(scoringRules.orgId, ev.orgId),
      eq(scoringRules.trigger, ev.eventType),
      eq(scoringRules.enabled, true),
    ));

  for (const rule of rules) {
    const cond = parseJsonField<Record<string, unknown>>(rule.conditionJson);
    if (!matchesCondition(cond, condInput)) continue;
    await applyScoreDelta(ev, rule.delta);
  }

  // 2) Automations
  const autos = await db
    .select()
    .from(automations)
    .where(and(
      eq(automations.orgId, ev.orgId),
      eq(automations.trigger, ev.eventType),
      eq(automations.enabled, true),
    ));

  for (const auto of autos) {
    const cond = parseJsonField<Record<string, unknown>>(auto.conditionJson);
    if (!matchesCondition(cond, condInput)) continue;
    const actions = parseJsonField<any[]>(auto.actionsJson) || [];
    if (!Array.isArray(actions) || !actions.length) continue;
    const ctx: ActionContext = { orgId: ev.orgId, actorId: ev.actorId, sourceEvent: ev };
    await runActions(actions, ctx);
    await db.update(automations)
      .set({ runsCount: auto.runsCount + 1, lastRunAt: new Date() })
      .where(eq(automations.id, auto.id));
  }
}

async function buildConditionInput(ev: TriggerEvent): Promise<ConditionInput> {
  const input: ConditionInput = { verb: ev.eventType };
  const p = ev.payload || {};

  if (typeof p.amount === 'number') input.amount = p.amount;
  if (typeof p.amount === 'string') input.amount = Number(p.amount);
  if (typeof p.stageName === 'string') input.stageName = p.stageName;
  if (typeof p.tagName === 'string') input.tagName = p.tagName;
  if (typeof p.status === 'string') input.status = p.status;
  if (typeof p.currency === 'string') input.currency = p.currency;

  // Para deal_*: si el payload no trae amount/status, lo hidratamos del deal.
  if (ev.entityType === 'deal' && (input.amount === undefined || input.status === undefined)) {
    const [row] = await db.select({ amount: deals.amount, status: deals.status, currency: deals.currency })
      .from(deals).where(eq(deals.id, ev.entityId)).limit(1);
    if (row) {
      if (input.amount === undefined) input.amount = Number(row.amount);
      if (input.status === undefined) input.status = row.status;
      if (input.currency === undefined) input.currency = row.currency;
    }
  }

  return input;
}

// Aplica delta de score al CONTACTO involucrado en el evento.
// Para eventos de deal: al contacto del deal (si existe).
// Para eventos de contact: al contacto mismo.
// Resto: no aplica (no hay score a tocar).
async function applyScoreDelta(ev: TriggerEvent, delta: number) {
  let contactId: Buffer | null = null;

  if (ev.entityType === 'contact') {
    contactId = ev.entityId;
  } else if (ev.entityType === 'deal') {
    const [row] = await db.select({ contactId: deals.contactId }).from(deals)
      .where(eq(deals.id, ev.entityId)).limit(1);
    contactId = row?.contactId ?? null;
  } else if (ev.entityType === 'note') {
    // Si la nota es sobre un contact, sumar al contact.
    const targetType = (ev.payload as any)?.on?.type;
    const targetId = (ev.payload as any)?.on?.id;
    if (targetType === 'contact' && typeof targetId === 'string') {
      try {
        const { idFromString } = await import('../../lib/uuid.js');
        contactId = idFromString(targetId);
      } catch {}
    }
  }

  if (!contactId) return;
  // UPDATE atómico, capeado entre 0 y 1000.
  await db.update(contacts)
    .set({ score: sql`GREATEST(0, LEAST(1000, ${contacts.score} + ${delta}))` })
    .where(and(eq(contacts.id, contactId), eq(contacts.orgId, ev.orgId)));
}
