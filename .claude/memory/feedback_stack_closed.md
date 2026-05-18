---
name: Stack tecnológico cerrado
description: Decisiones de stack ya tomadas que no se re-discuten salvo orden explícita
type: feedback
---

**Regla:** Estas decisiones de stack están cerradas. No re-proponer alternativas a menos que Andrés las reabra explícitamente.

**Why:** Cada decisión se discutió a fondo en 2026-05-17. Re-abrir cada sesión consume tiempo sin valor.

**How to apply:**

| Posición | Cerrado en | Rechazado |
| --- | --- | --- |
| HTTP server | **Hono** | Express, Fastify, NestJS |
| ORM | **Drizzle** | Prisma, Kysely raw |
| Auth | **Lucia v3 (sesiones server-side)** | JWT, Passport, Auth0, Clerk |
| DB | **MySQL Hostinger** | Supabase, PostgreSQL, MongoDB, SQLite |
| Validación | **Zod** | Yup, Joi |
| Background jobs | **n8n en DonWeb** | BullMQ, Inngest, Trigger.dev |
| i18n cliente | **Solo ES** | Mantener EN, otro idioma |
| Frontend framework (hoy) | **Vanilla** | React, Vue |
| Frontend framework (futuro) | **Astro + Svelte islands** | Next, SvelteKit, Nuxt |
| Tipos | **TypeScript** en backend | JS plano |

Cambios solo si Andrés dice explícitamente "reabramos X".
