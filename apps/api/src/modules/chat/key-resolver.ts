// Resuelve la API key de Anthropic para una org.
// Prioridad: 1) key por org en DB (configurada por superadmin o, en Max, por el cliente)
//            2) ANTHROPIC_API_KEY del env (fallback global de Tr3sC3rb3r0)
// Devuelve null si no hay ninguna disponible.
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { orgApiKeys } from '../../db/schema.js';
import { decryptSecret } from '../../lib/crypto.js';
import { env } from '../../config/env.js';

export async function resolveAnthropicKey(orgId: Buffer): Promise<{ key: string; source: 'org' | 'global' } | null> {
  const [row] = await db
    .select({ keyCiphertext: orgApiKeys.keyCiphertext })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.orgId, orgId), eq(orgApiKeys.provider, 'anthropic')))
    .orderBy(asc(orgApiKeys.priority))
    .limit(1);

  if (row) {
    try {
      return { key: decryptSecret(row.keyCiphertext), source: 'org' };
    } catch {
      // Cifrado roto (master key rotada?) — caemos al fallback global.
    }
  }

  if (env.ANTHROPIC_API_KEY) {
    return { key: env.ANTHROPIC_API_KEY, source: 'global' };
  }

  return null;
}
