# CLAUDE.md — Contexto del proyecto Tr3sC3rb3r0

Este archivo se carga automáticamente en cada sesión de Claude Code. Mantenelo corto, denso, sin duplicar lo que vive en `.claude/memory/`.

## Estructura del repo (monorepo npm workspaces)

```text
apps/web/      → frontend público (vanilla → Astro futuro). Servidor Express ESM.
apps/api/      → backend Hono + Drizzle + Lucia + MySQL (placeholder).
packages/shared/ → tipos y constantes compartidos.
.claude/agents/  → 5 subagentes (backend, frontend, marketing, orchestrator, memory).
.claude/memory/  → memoria persistente del proyecto.
```

Comandos:

- `npm run dev` → arranca `apps/web` en `http://localhost:3000`.
- `npm run start` → producción local del web.
- `npm run optimize:svg` / `optimize:raster` → assets.

## Sobre Andrés

Bibliotecólogo + dev en Medellín, Colombia. Dueño de **librosmedellin.com** y **Tr3sC3rb3r0**. Nivel técnico avanzado. Español tuteo/voseo.

## Preferencias de trabajo

- Respuestas directas, densas, sin explicaciones básicas.
- Código con comentarios integrados breves (WHY > WHAT).
- Prioridad: eficiencia, modularidad, escalabilidad, honestidad.
- Antes de tareas largas: validar que haya cliente esperando (ver `.claude/memory/feedback_client_check.md`).

## Decisiones cerradas (no re-discutir)

| Tema | Cerrado en | Rechazado |
| --- | --- | --- |
| HTTP server | Hono | Express en prod, Fastify, NestJS |
| ORM | Drizzle | Prisma |
| Auth | Lucia v3 (sesiones) | JWT, Passport |
| DB | MySQL Hostinger | Supabase, Postgres |
| Validación | Zod | otros |
| Background jobs | n8n en DonWeb | BullMQ, Redis |
| i18n cliente | Solo ES | bilingüe EN |
| Frontend (hoy) | Vanilla | React, Vue |
| Frontend (futuro) | Astro + Svelte islands | Next, SvelteKit |
| Scope productos | Chat IA, CRM, Software | ERP eliminado |

Detalle completo en `.claude/memory/feedback_stack_closed.md` y `.claude/memory/feedback_no_*.md`.

## Dominio

**trescerbero.com** (sin números). La marca conserva el styling `Tr3sC3rb3r0` en logo/copy.

## Términos

| Término | Significado |
| --- | --- |
| MCP | Model Context Protocol |
| B2B | Business-to-business |
| TRM | Tasa Representativa del Mercado (USD↔COP en Colombia) |
| RAG | Retrieval-Augmented Generation |
| Habeas Data | Derecho del titular sobre sus datos personales (Ley 1581/2012) |
