// Resuelve la org "activa" del usuario para endpoints multi-tenant.
// Por ahora: primera org por created_at (la del signup). Multi-org switcher viene después.
import type { MiddlewareHandler } from 'hono';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { orgMembers, organizations } from '../db/schema.js';
import { requireAuth, type AuthContext } from './auth.js';

type OrgContext = {
  orgId: Buffer;
  role: 'admin_org' | 'user_org';
  tier: 'demo' | 'basico' | 'pro' | 'max';
};

// Augmento global del ContextVariableMap: incluye user (auth) + org (este middleware).
// Esto evita que cada route file tenga que pasar generics tediosos.
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthContext['user'];
    org: OrgContext;
  }
}

export const requireOrg: MiddlewareHandler = async (c, next) => {
  // requireAuth ya valida sesión y setea c.var.user.
  const user = c.get('user');
  if (!user) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Sesión inválida.' } }, 401);
  }

  const rows = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      tier: organizations.tier,
      deletedAt: organizations.deletedAt,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id))
    .orderBy(asc(orgMembers.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row || row.deletedAt) {
    return c.json(
      { error: { code: 'NO_ORG', message: 'El usuario no pertenece a ninguna organización activa.' } },
      403,
    );
  }

  c.set('org', { orgId: row.orgId, role: row.role, tier: row.tier });
  return next();
};

// Helper para endpoints que requieren un tier mínimo
export function requireTier(min: 'basico' | 'pro' | 'max'): MiddlewareHandler {
  const rank = { demo: 1, basico: 2, pro: 3, max: 4 };
  return async (c, next) => {
    const org = c.get('org');
    if (!org) return c.json({ error: { code: 'NO_ORG' } }, 403);
    if (rank[org.tier] < rank[min]) {
      return c.json(
        {
          error: {
            code: 'TIER_REQUIRED',
            message: `Esta función requiere plan ${min.toUpperCase()} o superior.`,
            current: org.tier,
            required: min,
          },
        },
        402, // Payment Required — feature gated
      );
    }
    return next();
  };
}

// Composición común: requireAuth + requireOrg
export const authedOrg: MiddlewareHandler[] = [requireAuth, requireOrg];
