// Demo público sin login: consent → crea org demo + pseudo-user + sample data + sesión.
// Habeas Data (Ley 1581/2012 Colombia): consent_text snapshot, ipHash, fingerprint.
// Opción B: datos cargados quedan con Tr3sC3rb3r0 (consentido en el formulario).
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq, and, gte, isNull, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  users, organizations, orgMembers, demoSessions,
} from '../../db/schema.js';
import { newId, idToString, sha256 } from '../../lib/uuid.js';
import { hashPassword } from '../../lib/hash.js';
import { createSession } from '../../lib/sessions.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { bootstrapDefaultPipeline } from '../crm/bootstrap.js';
import { bootstrapDefaultEngine } from '../engine/defaults.js';
import { seedDemoData } from './seed.js';

export const demoRoutes = new Hono();

const DEMO_TTL_DAYS = 30;
const MAX_DEMOS_PER_IP_PER_DAY = 3;

const startSchema = z.object({
  consented: z.literal(true, {
    errorMap: () => ({ message: 'Tenés que aceptar la política para usar el demo' }),
  }),
  consentText: z.string().min(50, 'Texto de consentimiento sospechosamente corto').max(5000),
  contactName: z.string().trim().max(150).optional().or(z.literal('').transform(() => undefined)),
  contactEmail: z.string().trim().email().max(255).optional().or(z.literal('').transform(() => undefined)),
});

function getIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    '0.0.0.0'
  );
}

// ─── START DEMO ──────────────────────────────────────────────────
demoRoutes.post(
  '/start',
  rateLimit({ key: 'demo:start', max: MAX_DEMOS_PER_IP_PER_DAY, windowMs: 24 * 60 * 60 * 1000 }),
  zValidator('json', startSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Datos inválidos.',
          details: result.error.flatten().fieldErrors,
        },
      }, 400);
    }
  }),
  async (c) => {
    const ip = getIp(c);
    const ua = c.req.header('user-agent') ?? '';
    const ipHash = sha256(ip);
    const fingerprint = sha256(ip + '|' + ua);

    // Anti-abuso: si este fingerprint ya tiene una demo no expirada, reusarla en lugar de crear otra.
    const now = new Date();
    const [existing] = await db.select({ orgId: demoSessions.orgId, userId: demoSessions.userId, expiresAt: demoSessions.expiresAt })
      .from(demoSessions)
      .where(and(
        eq(demoSessions.fingerprint, fingerprint),
        gte(demoSessions.expiresAt, now),
        isNull(demoSessions.deletedAt),
      ))
      .limit(1);

    let userId: Buffer;
    let orgId: Buffer;

    if (existing) {
      userId = existing.userId;
      orgId = existing.orgId;
    } else {
      const { contactName, contactEmail, consentText } = c.req.valid('json');

      // Crear org + pseudo-user + bootstrap CRM + seed data en una transacción
      orgId = newId();
      userId = newId();
      const short = orgId.toString('hex').slice(0, 8);
      const orgSlug = `demo-${short}`;
      const pseudoEmail = contactEmail || `demo-${short}@trescerbero.com`;
      const randomPwHash = await hashPassword(`demo-${short}-${Date.now()}-${Math.random()}`);

      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email: pseudoEmail,
          passwordHash: randomPwHash,
          displayName: contactName ?? 'Visitante Demo',
        });
        await tx.insert(organizations).values({
          id: orgId,
          name: contactName ? `Demo de ${contactName}` : 'Mi CRM Demo',
          slug: orgSlug,
          tier: 'demo',
          demoOnly: true,
          tierExpiresAt: new Date(Date.now() + DEMO_TTL_DAYS * 86400 * 1000),
        });
        await tx.insert(orgMembers).values({
          orgId, userId, role: 'admin_org',
        });
        await bootstrapDefaultPipeline(tx, orgId);
        await bootstrapDefaultEngine(tx, orgId);
        await seedDemoData(tx, orgId, userId);

        await tx.insert(demoSessions).values({
          id: newId(),
          orgId, userId, ipHash, userAgent: ua.slice(0, 255), fingerprint,
          consentedAt: new Date(),
          consentText,
          contactName: contactName ?? null,
          contactEmail: contactEmail ?? null,
          expiresAt: new Date(Date.now() + DEMO_TTL_DAYS * 86400 * 1000),
        });
      });
    }

    // Crear sesión real (reusa el sistema de sessions estándar) para que el demo
    // pueda usar todos los endpoints autenticados como cualquier user normal.
    const session = await createSession(userId, { ipHash, userAgent: ua });
    setCookie(c, env.SESSION_COOKIE_NAME, session.token, {
      path: '/',
      expires: session.expiresAt,
      httpOnly: true,
      sameSite: 'Lax',
      secure: env.SESSION_COOKIE_SECURE,
      domain: env.SESSION_COOKIE_DOMAIN,
    });

    return c.json({
      ok: true,
      orgId: idToString(orgId),
      userId: idToString(userId),
      redirectTo: '/app/crm.html',
      message: existing ? 'Reanudando tu demo anterior.' : 'Demo creado. ¡Bienvenido!',
    }, 201);
  },
);

// ─── STATUS — días restantes (consumido por el banner del shell) ─
demoRoutes.get('/status', async (c) => {
  // No requiere auth; consulta basada en fingerprint
  const ip = getIp(c);
  const ua = c.req.header('user-agent') ?? '';
  const fingerprint = sha256(ip + '|' + ua);
  const [row] = await db.select({ expiresAt: demoSessions.expiresAt, createdAt: demoSessions.createdAt })
    .from(demoSessions)
    .where(and(eq(demoSessions.fingerprint, fingerprint), isNull(demoSessions.deletedAt)))
    .limit(1);
  if (!row) return c.json({ hasDemo: false });
  const remainingMs = row.expiresAt.getTime() - Date.now();
  return c.json({
    hasDemo: true,
    expiresAt: row.expiresAt,
    remainingDays: Math.max(0, Math.ceil(remainingMs / 86400000)),
    expired: remainingMs <= 0,
  });
});

// ─── ERASE — derecho de supresión Habeas Data art. 8 ─────────────
const eraseSchema = z.object({
  email: z.string().email(),
  reason: z.string().max(500).optional(),
});

demoRoutes.post('/erase', zValidator('json', eraseSchema), async (c) => {
  const { email } = c.req.valid('json');
  // Marcamos como deletedAt — no borramos en cascada para mantener integridad referencial.
  // Un cron posterior puede purgar las orgs y users después de 30 días extra.
  const [row] = await db.select({ id: demoSessions.id, orgId: demoSessions.orgId })
    .from(demoSessions)
    .where(and(eq(demoSessions.contactEmail, email), isNull(demoSessions.deletedAt)))
    .limit(1);
  if (!row) return c.json({ ok: true, message: 'Si había datos con ese email, ya fueron procesados.' });

  await db.update(demoSessions).set({ deletedAt: new Date() }).where(eq(demoSessions.id, row.id));
  // Soft-delete la org también
  await db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, row.orgId));

  return c.json({ ok: true, message: 'Datos marcados para supresión. Procesamiento dentro de 15 días hábiles.' });
});
