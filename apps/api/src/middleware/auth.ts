// Middleware Hono: parsea cookie de sesión, valida, deja user en context.
// Endpoints públicos no necesitan llamarlo. Endpoints protegidos usan `requireAuth`.
import { createMiddleware } from 'hono/factory';
import { getCookie, setCookie } from 'hono/cookie';
import { env } from '../config/env.js';
import { validateSessionToken, buildCookieAttributes } from '../lib/sessions.js';

export type AuthContext = {
  user: NonNullable<Awaited<ReturnType<typeof validateSessionToken>>>['user'];
};

export const sessionMiddleware = createMiddleware<{ Variables: Partial<AuthContext> }>(
  async (c, next) => {
    const token = getCookie(c, env.SESSION_COOKIE_NAME);
    if (!token) return next();
    const valid = await validateSessionToken(token);
    if (!valid) return next();
    c.set('user', valid.user);
    // Rolling refresh: si la sesión se renovó, actualizar cookie.
    if (valid.session.fresh) {
      setCookie(c, env.SESSION_COOKIE_NAME, token, {
        path: '/',
        expires: valid.session.expiresAt,
        httpOnly: true,
        sameSite: 'Lax',
        secure: env.SESSION_COOKIE_SECURE,
        domain: env.SESSION_COOKIE_DOMAIN,
      });
    }
    return next();
  },
);

export const requireAuth = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json(
      { error: { code: 'AUTH_REQUIRED', message: 'Sesión inválida o expirada.' } },
      401,
    );
  }
  return next();
});

export const requireSuperadmin = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const user = c.get('user');
  if (!user || !user.isSuperadmin) {
    return c.json(
      { error: { code: 'FORBIDDEN', message: 'Requiere superadmin.' } },
      403,
    );
  }
  return next();
});

export { buildCookieAttributes };
