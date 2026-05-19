# @tr3sc3rb3r0/api

Backend Hono + Drizzle + MySQL para Tr3sC3rb3r0. Auth con sesiones manuales (Lucia v3 deprecado), schema multi-tenancy desde día 1, pensado para Hostinger Business.

## Stack actual

- **Hono 4** — HTTP server, ESM, TypeScript.
- **Drizzle ORM 0.36+** — queries tipadas sobre `mysql2/promise`.
- **Sesiones manuales** (`src/lib/sessions.ts`) — cookie httpOnly + SHA256 del token en DB.
- **Argon2id** vía `@node-rs/argon2`.
- **Zod** en cada boundary.
- **Pino** structured logging.
- **UUID v7** ↔ BINARY(16) (sortable temporal).

## Quickstart

```bash
cp .env.example .env       # ajustar DB_*
npm install                # desde la raíz del monorepo
npm run -w @tr3sc3rb3r0/api db:migrate
npm run -w @tr3sc3rb3r0/api dev
# → http://localhost:3001/health
```

## Endpoints implementados

| Método | Path | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Proceso vivo. |
| GET | `/ready` | — | DB alcanzable. Hostinger lo necesita. |
| POST | `/api/auth/register` | — | Crea user + org + member. Login inmediato. |
| POST | `/api/auth/login` | — | Devuelve user + setea cookie. |
| POST | `/api/auth/logout` | sesión | Invalida sesión + limpia cookie. |
| GET | `/api/auth/me` | sesión | User + orgs (con role + tier). |

## Endpoints pendientes (Turn 2+)

- Email verification (`POST /api/auth/verify-email`, `POST /api/auth/resend-verification`)
- Password reset (`POST /api/auth/forgot-password`, `POST /api/auth/reset-password`)
- Captcha Turnstile en `/register` y `/forgot-password`
- 2FA TOTP opt-in
- `/api/crm/*` con Strategy pattern por tier
- `/api/chat/*` con SSE
- `/api/admin/*` superadmin
- `/api/integrations/n8n/webhook` con HMAC

## Convenciones

- **IDs**: `BINARY(16)` UUID v7 generado por `src/lib/uuid.ts`.
- **Errores**: `{ error: { code: SCREAMING_SNAKE, message, details? } }`.
- **Multi-tenancy**: `org_id BINARY(16)` obligatorio en toda tabla de negocio (auth queda exento).
- **Sesiones**: cookie `tc_session` (configurable), TTL 30 días, rolling refresh al 50% TTL.
- **Rate limit**: in-memory sliding window. Sin Redis. Aceptable hasta tener cliente Enterprise.

## Sobre Lucia v3 (decisión revisada)

CLAUDE.md lista "Lucia v3" como decisión cerrada. **Lucia v3 fue deprecado en marzo 2025** por su autor (Pilcrow), quien recomienda rodar el manejo de sesiones a mano usando primitivas de Oslo. El módulo `src/lib/sessions.ts` implementa exactamente eso: ~80 líneas, misma seguridad (cookie httpOnly + token hasheado en DB), control total y cero dep deprecada.

Esto honra el espíritu de la decisión ("sesiones, no JWT") mientras evita una dep sin mantenimiento. Anotado en `.claude/memory/feedback_lucia_bypass.md` (pendiente).

## Deploy en Hostinger

Configurar como segunda app Node.js en hPanel, subdomain `api.trescerbero.com`:

- **Application root**: `apps/api`
- **Startup file**: `dist/server.js` (post `npm run build`)
- **Node version**: 22.x
- **Variables de entorno**: copiar `.env.example`, completar.

Antes del primer deploy, ejecutar `npm run -w @tr3sc3rb3r0/api db:migrate` para crear las tablas en MySQL de Hostinger.

## Migrations

Vanilla, sin drizzle-kit (control + diff legible). SQL files en `src/db/migrations/`, runner en `src/db/migrate.ts`. Tabla `schema_migrations` lleva tracking.

Para crear una nueva: `src/db/migrations/0002_<descripcion>.sql`. Idempotente cuando sea posible (`IF NOT EXISTS`).

## Indicadores para migrar fuera de Hostinger

Mover backend a VPS si y solo si **cualquiera**:
- Latencia P95 >800ms sostenida 7 días.
- Necesidad real de WebSockets persistentes.
- Primer cliente Enterprise pagando >USD $400/mes.
- Más de 50 organizaciones activas.

Antes: no migrar. Optimizar.
