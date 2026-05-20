// Activities: log read-only de eventos del CRM. Sirve al timeline en UI y a auditoría.
// Filtros: por entidad (entityType+entityId) o feed global de la org.
import { Hono } from 'hono';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { activities, users } from '../../../db/schema.js';
import { idToString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { tryParseId, parsePagination } from '../helpers.js';

export const activityRoutes = new Hono();
activityRoutes.use('*', ...authedOrg);

activityRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);

  const filters = [eq(activities.orgId, orgId)];
  if (q.entityType) {
    if (!['contact', 'company', 'deal', 'task', 'note', 'pipeline'].includes(q.entityType)) {
      return c.json({ error: { code: 'INVALID_ENTITY_TYPE' } }, 400);
    }
    filters.push(eq(activities.entityType, q.entityType as any));
  }
  if (q.entityId) {
    const eid = tryParseId(q.entityId);
    if (!eid) return c.json({ error: { code: 'INVALID_ENTITY_ID' } }, 400);
    filters.push(eq(activities.entityId, eid));
  }

  const where = and(...filters);

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: activities.id,
        actorId: activities.actorId,
        actorKind: activities.actorKind,
        actorEmail: users.email,
        actorName: users.displayName,
        entityType: activities.entityType,
        entityId: activities.entityId,
        verb: activities.verb,
        payload: activities.payload,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(where)
      .orderBy(desc(activities.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(activities).where(where),
  ]);

  return c.json({
    activities: rows.map((r) => ({
      id: idToString(r.id),
      actor: r.actorId
        ? { id: idToString(r.actorId), email: r.actorEmail, name: r.actorName, kind: r.actorKind }
        : { kind: r.actorKind }, // system/ai sin actor concreto
      entityType: r.entityType,
      entityId: idToString(r.entityId),
      verb: r.verb,
      payload: r.payload,
      createdAt: r.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});
