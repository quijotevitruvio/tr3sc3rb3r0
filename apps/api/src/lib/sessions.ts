// Session manager manual — reemplaza a Lucia v3 (deprecado marzo 2025).
// Modelo: token random 32 bytes en cookie httpOnly, SHA256 del token en DB.
// Rolling refresh: si la sesión usa más del 50% de su TTL, se renueva al validarla.
import { eq, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { env } from '../config/env.js';
import { randomToken, sha256 } from './uuid.js';

const TTL_MS = env.SESSION_TTL_SECONDS * 1000;
const REFRESH_THRESHOLD_MS = TTL_MS / 2;

export interface SessionContext {
  sessionId: string; // hash
  token: string; // raw, sólo en createSession
  userId: Buffer;
  expiresAt: Date;
  fresh: boolean; // true si recién creada o renovada
}

export async function createSession(
  userId: Buffer,
  meta: { ipHash?: string; userAgent?: string } = {},
): Promise<SessionContext> {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + TTL_MS);
  await db.insert(sessions).values({
    id,
    userId,
    expiresAt,
    ipHash: meta.ipHash ?? null,
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
  });
  return { sessionId: id, token, userId, expiresAt, fresh: true };
}

export interface ValidatedSession {
  session: SessionContext;
  user: {
    id: Buffer;
    email: string;
    displayName: string | null;
    emailVerifiedAt: Date | null;
    isSuperadmin: boolean;
  };
}

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  if (!token || token.length < 16) return null;
  const id = sha256(token);
  const rows = await db
    .select({
      sId: sessions.id,
      sUserId: sessions.userId,
      sExpiresAt: sessions.expiresAt,
      uId: users.id,
      uEmail: users.email,
      uDisplayName: users.displayName,
      uEmailVerifiedAt: users.emailVerifiedAt,
      uIsSuperadmin: users.isSuperadmin,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const now = Date.now();
  if (r.sExpiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  // Rolling refresh
  let fresh = false;
  let expiresAt = r.sExpiresAt;
  if (r.sExpiresAt.getTime() - now < REFRESH_THRESHOLD_MS) {
    expiresAt = new Date(now + TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    fresh = true;
  }

  return {
    session: { sessionId: r.sId, token: '', userId: r.sUserId, expiresAt, fresh },
    user: {
      id: r.uId,
      email: r.uEmail,
      displayName: r.uDisplayName,
      emailVerifiedAt: r.uEmailVerifiedAt,
      isSuperadmin: r.uIsSuperadmin,
    },
  };
}

export async function invalidateSessionByToken(token: string): Promise<void> {
  const id = sha256(token);
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function invalidateAllUserSessions(userId: Buffer): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// GC manual de sesiones expiradas (llamar desde cron n8n cada hora).
export async function purgeExpiredSessions(): Promise<number> {
  const res = await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  // postgres-js retorna el row count en `.count`
  return (res as any)?.count ?? 0;
}

export function buildCookieAttributes(expiresAt: Date): string {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (env.SESSION_COOKIE_SECURE) parts.push('Secure');
  if (env.SESSION_COOKIE_DOMAIN) parts.push(`Domain=${env.SESSION_COOKIE_DOMAIN}`);
  return parts.join('; ');
}

export function buildClearCookie(): string {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];
  if (env.SESSION_COOKIE_SECURE) parts.push('Secure');
  if (env.SESSION_COOKIE_DOMAIN) parts.push(`Domain=${env.SESSION_COOKIE_DOMAIN}`);
  return parts.join('; ');
}
