---
name: Lucia v3 bypass — sesiones manuales
description: CLAUDE.md cierra "Auth: Lucia v3", pero Lucia v3 fue deprecado en marzo 2025. Decisión: rodar sesiones manuales (~80 líneas) en apps/api/src/lib/sessions.ts.
type: feedback
---

CLAUDE.md lista "Lucia v3 (sesiones)" como decisión cerrada (rechazando JWT).

**Why:** Lucia v3 fue oficialmente deprecada por su autor (Pilcrow) en marzo 2025. No tiene mantenimiento ni patches de seguridad. El autor recomienda rodar manejo de sesiones a mano usando Oslo primitives. Mantener una dep deprecada en el camino crítico de auth es un riesgo innecesario cuando el reemplazo son ~80 líneas.

**How to apply:** En `apps/api/src/lib/sessions.ts` viven las primitivas (createSession, validateSessionToken, invalidateSessionByToken, purgeExpiredSessions). Cookie httpOnly con token random base64url 32 bytes. En DB se guarda SHA256(token) — si la DB se filtra, los tokens no son utilizables. Rolling refresh al 50% del TTL. Sin dependencia externa.

El espíritu de la decisión original ("sesiones server-side, no JWT") se mantiene. Si el usuario quiere volver a Lucia, el reemplazo es trivial: misma interface en `sessions.ts` envuelve a `lucia.createSession/validateSession`.
