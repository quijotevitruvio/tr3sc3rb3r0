---
name: feedback-dev-infra-gotchas
description: Gotchas de infra dev descubiertos durante construcción de auth + CRM. No volver a tropezar con esto.
metadata:
  type: feedback
---

## 1. NO usar `z.coerce.boolean()` para env vars

**Why:** `z.coerce.boolean("false")` evalúa como `true` porque cualquier string no vacío es truthy. Esto causó que `SESSION_COOKIE_SECURE=false` en `.env` se convirtiera en `true`, marcando todas las cookies como Secure y rompiendo el login en `http://app.localhost` (no HTTPS).

**How to apply:** Para booleans desde env usar `z.preprocess((v) => typeof v === 'string' ? v === 'true' || v === '1' : v, z.boolean())`. Ya hay helper en `apps/api/src/config/env.ts` como `boolFromEnv`. Reusarlo.

## 2. Cookies cross-host en dev rompen con `app.localhost` vs `localhost`

**Why:** Browser en `app.localhost:3000` haciendo fetch a `localhost:3001` (API) es cross-site para SameSite=Lax, y la cookie no viaja. Probamos varios fixes (`Domain=localhost`, ajustar SameSite) — todos frágiles. Único fix robusto: **proxiar `/api/*` desde el web Express al API** vía `http-proxy-middleware`, así todo es same-origin.

**How to apply:** El proxy está en `apps/web/server/index.js` mountado antes de los static handlers. Mismo origen cliente. Si en algún momento se rompe el chat o `requireAuth` da 401 desde el browser, revisar que el proxy siga vivo.

## 3. El migrate.ts manual con regex tenía bug — usar drizzle migrator oficial

**Why:** El runner antiguo splitteaba SQL por `;\s*$/m` y filtraba líneas que arrancaban con `--`. Como drizzle-kit pone `--> statement-breakpoint` entre statements, todos los CREATE TABLE excepto el primero quedaban filtrados, ejecutaba 1 statement, y marcaba el archivo como "aplicado" en `schema_migrations`. Resultado: solo se creaba la primera tabla y el resto silenciosamente faltaba.

**How to apply:** `apps/api/src/db/migrate.ts` ahora usa `import { migrate } from 'drizzle-orm/mysql2/migrator'` que entiende el formato de drizzle-kit. No volver al runner manual.

## 4. `sessionMiddleware` debe estar montado GLOBALMENTE, no por módulo

**Why:** Al inicio estaba en `authRoutes.use('*', sessionMiddleware)`. Cuando se agregó `/api/crm/*` (que usa `requireAuth`), nadie parseaba la cookie en esas rutas → siempre 401. Fix: mover el `sessionMiddleware` a `server.ts` con `app.use('*', sessionMiddleware)` antes de los `app.route(...)`.

**How to apply:** Si agregás un módulo nuevo que requiera auth, NO hace falta re-montar sessionMiddleware — está global. Sólo agregar `requireAuth` (o composiciones como `authedOrg`) en las rutas que lo necesiten.

## 5. Tu `.gitignore` ya cubre `.env` — verificar con `git check-ignore`

**Why:** Cuidado al editar credenciales: confirmar siempre que el archivo está ignored antes de avanzar (`git check-ignore apps/api/.env`).

## 6. ContextVariableMap de Hono requiere augment GLOBAL, no per-middleware

**Why:** Inicialmente declaré `interface ContextVariableMap { org }` en `org-context.ts` y se rompió el typecheck para `c.get('user')` en otros archivos: el augment override-eó el del auth middleware. Fix: declarar AMBOS en el mismo lugar (`org-context.ts` ahora declara `user` + `org`).

**How to apply:** Para agregar una nueva variable al contexto que se use en varios módulos, hacelo en `org-context.ts` junto con las existentes, no en archivos sueltos.

Relacionado: [[feedback-stack-closed]], [[reference-hostinger]].
