// Cuotas mensuales de IA generativa por tier.
// Demo y Max usan caps muy distintos. Básico no tiene IA generativa (devuelve error).
// Pro = 500 acciones / mes / usuario.
import { eq, and, gte, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { iaUsage } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';

type Tier = 'demo' | 'basico' | 'pro' | 'max';

// "Acción" = una llamada IA completa, sin importar tokens. Lo simple primero.
const MONTHLY_QUOTA_PER_USER: Record<Tier, number> = {
  demo: 30,     // 30 acciones totales en los 30 días del demo
  basico: 0,    // sin IA generativa
  pro: 500,     // por usuario
  max: 999_999, // ilimitado en la práctica
};

// Pricing aprox Haiku 4.5 (USD por millón de tokens). Para tracking interno.
const COSTS_PER_M_TOKENS = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
};

export function getMonthlyQuota(tier: Tier): number {
  return MONTHLY_QUOTA_PER_USER[tier] ?? 0;
}

export interface QuotaCheck {
  allowed: boolean;
  used: number;
  limit: number;
  tier: Tier;
  reason?: string;
}

// Cuenta uso desde el día 1 del mes en curso.
function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function checkQuota(orgId: Buffer, userId: Buffer, tier: Tier): Promise<QuotaCheck> {
  const limit = MONTHLY_QUOTA_PER_USER[tier];
  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0, tier, reason: 'Tu plan no incluye IA generativa. Subí a Pro o Max.' };
  }

  const [{ value: used }] = await db
    .select({ value: count() })
    .from(iaUsage)
    .where(and(
      eq(iaUsage.orgId, orgId),
      eq(iaUsage.userId, userId),
      gte(iaUsage.createdAt, startOfMonth()),
    ));

  return {
    allowed: used < limit,
    used,
    limit,
    tier,
    reason: used >= limit ? `Alcanzaste el límite de ${limit} acciones IA este mes.` : undefined,
  };
}

// Registra la llamada IA después de ejecutarla. Calcula el costo aproximado.
export async function recordUsage(input: {
  orgId: Buffer;
  userId: Buffer;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  entityType?: string;
  entityId?: Buffer | null;
}) {
  const c = COSTS_PER_M_TOKENS[input.model as keyof typeof COSTS_PER_M_TOKENS];
  let costMicros = 0;
  if (c) {
    // costo en millonésimas de USD = (tokens * USD_por_M_tokens)
    costMicros = Math.round((input.inputTokens * c.input + input.outputTokens * c.output));
  }

  await db.insert(iaUsage).values({
    id: newId(),
    orgId: input.orgId,
    userId: input.userId,
    feature: input.feature,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    costMicrosUsd: costMicros,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
  });
}
