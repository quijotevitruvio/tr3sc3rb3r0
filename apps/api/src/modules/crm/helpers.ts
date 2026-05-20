// Helpers compartidos del módulo CRM: activity logger, paginación.
import { db } from '../../db/client.js';
import { activities } from '../../db/schema.js';
import { newId, idFromString, idToString } from '../../lib/uuid.js';

type EntityType = 'contact' | 'company' | 'deal' | 'task' | 'note' | 'pipeline';

interface LogActivityInput {
  orgId: Buffer;
  actorId: Buffer | null;
  actorKind?: 'user' | 'system' | 'ai';
  entityType: EntityType;
  entityId: Buffer;
  verb: string;
  payload?: Record<string, unknown>;
}

export async function logActivity(input: LogActivityInput) {
  await db.insert(activities).values({
    id: newId(),
    orgId: input.orgId,
    actorId: input.actorId,
    actorKind: input.actorKind ?? 'user',
    entityType: input.entityType,
    entityId: input.entityId,
    verb: input.verb,
    payload: input.payload as any,
  });
}

// Parsea un UUID string a Buffer; devuelve null si inválido (en vez de throw).
export function tryParseId(s: string | undefined | null): Buffer | null {
  if (!s) return null;
  try {
    return idFromString(s);
  } catch {
    return null;
  }
}

// Parsea ?page=N&pageSize=N con límites razonables.
export function parsePagination(q: Record<string, string>) {
  const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || '20', 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export { idToString };
