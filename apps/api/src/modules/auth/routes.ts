// Endpoints auth: register, login, logout, me.
// Multi-tenancy: cada usuario nuevo crea automáticamente una org y queda como admin_org.
// Verify-email + password-reset llegan en Turn 2 (schema ya está listo).
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users, organizations, orgMembers } from '../../db/schema.js';
import { env } from '../../config/env.js';
import { hashPassword, verifyPassword } from '../../lib/hash.js';
import { newId, sha256, idToString } from '../../lib/uuid.js';
import {
  createSession,
  invalidateSessionByToken,
} from '../../lib/sessions.js';
import { requireAuth, sessionMiddleware } from '../../middleware/auth.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { registerSchema, loginSchema, slugify } from './schemas.js';
import { bootstrapDefaultPipeline } from '../crm/bootstrap.js';
import { bootstrapDefaultEngine } from '../engine/defaults.js';

export const authRoutes = new Hono();

authRoutes.use('*', sessionMiddleware);

// ─── REGISTER ────────────────────────────────────────────────────────────
authRoutes.post(
  '/register',
  rateLimit({ key: 'auth:register', max: 5, windowMs: 15 * 60 * 1000 }),
  zValidator('json', registerSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos inválidos.',
            details: result.error.flatten().fieldErrors,
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const { email, password, displayName, orgName } = c.req.valid('json');

    // Email único — chequeo antes del insert para devolver error claro.
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) {
      return c.json(
        { error: { code: 'EMAIL_TAKEN', message: 'Este email ya está registrado.' } },
        409,
      );
    }

    const userId = newId();
    const orgId = newId();
    const passwordHash = await hashPassword(password);

    // Slug único: si choca, sufijo random 6 chars.
    let slug = slugify(orgName) || `org-${Math.random().toString(36).slice(2, 8)}`;
    const slugClash = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (slugClash.length) slug = `${slug}-${Math.random().toString(36).slice(2, 8)}`;

    // Transacción: user + org + member. postgres-js soporta transactions.
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        passwordHash,
        displayName: displayName ?? null,
      });
      await tx.insert(organizations).values({
        id: orgId,
        name: orgName,
        slug,
        tier: 'basico',
      });
      await tx.insert(orgMembers).values({
        orgId,
        userId,
        role: 'admin_org',
      });
      // Bootstrap CRM: pipeline principal + 4 stages default (Lead → Negociación).
      await bootstrapDefaultPipeline(tx, orgId);
      // Bootstrap Falsa IA: 6 reglas scoring + 2 automations + 2 templates.
      await bootstrapDefaultEngine(tx, orgId);
    });

    // Login inmediato post-register.
    const ipHash = sha256(c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '');
    const session = await createSession(userId, {
      ipHash,
      userAgent: c.req.header('user-agent') ?? undefined,
    });
    setCookie(c, env.SESSION_COOKIE_NAME, session.token, {
      path: '/',
      expires: session.expiresAt,
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.SESSION_COOKIE_SECURE,
      domain: env.SESSION_COOKIE_DOMAIN,
    });

    return c.json(
      {
        user: {
          id: idToString(userId),
          email,
          displayName: displayName ?? null,
          emailVerifiedAt: null,
          isSuperadmin: false,
        },
        org: {
          id: idToString(orgId),
          name: orgName,
          slug,
          tier: 'basico' as const,
        },
      },
      201,
    );
  },
);

// ─── LOGIN ───────────────────────────────────────────────────────────────
authRoutes.post(
  '/login',
  rateLimit({ key: 'auth:login', max: 10, windowMs: 15 * 60 * 1000 }),
  zValidator('json', loginSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } },
        400,
      );
    }
  }),
  async (c) => {
    const { email, password } = c.req.valid('json');

    const rows = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        displayName: users.displayName,
        emailVerifiedAt: users.emailVerifiedAt,
        isSuperadmin: users.isSuperadmin,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const user = rows[0];
    if (!user) {
      // No revelar si el email existe o no — mismo error que password mal.
      return c.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña inválidos.' } },
        401,
      );
    }

    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
      return c.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña inválidos.' } },
        401,
      );
    }

    const ipHash = sha256(c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '');
    const session = await createSession(user.id, {
      ipHash,
      userAgent: c.req.header('user-agent') ?? undefined,
    });
    setCookie(c, env.SESSION_COOKIE_NAME, session.token, {
      path: '/',
      expires: session.expiresAt,
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.SESSION_COOKIE_SECURE,
      domain: env.SESSION_COOKIE_DOMAIN,
    });

    return c.json({
      user: {
        id: idToString(user.id),
        email,
        displayName: user.displayName,
        emailVerifiedAt: user.emailVerifiedAt,
        isSuperadmin: user.isSuperadmin,
      },
    });
  },
);

// ─── LOGOUT ──────────────────────────────────────────────────────────────
authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, env.SESSION_COOKIE_NAME);
  if (token) await invalidateSessionByToken(token);
  deleteCookie(c, env.SESSION_COOKIE_NAME, {
    path: '/',
    domain: env.SESSION_COOKIE_DOMAIN,
  });
  return c.json({ ok: true });
});

// ─── ME ──────────────────────────────────────────────────────────────────
// Trae user + orgs donde es miembro. El frontend usa esto para hidratar el dashboard.
authRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      tier: organizations.tier,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id));

  return c.json({
    user: {
      id: idToString(user.id),
      email: user.email,
      displayName: user.displayName,
      emailVerifiedAt: user.emailVerifiedAt,
      isSuperadmin: user.isSuperadmin,
    },
    orgs: orgs.map((o) => ({
      id: idToString(o.id),
      name: o.name,
      slug: o.slug,
      tier: o.tier,
      role: o.role,
    })),
  });
});
