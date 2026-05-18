---
name: Stack actual y futuro
description: Qué corre hoy (vanilla) y qué se construye después (Hono + Astro), con criterio de migración
type: project
---

**Hoy en producción:**
- Frontend: HTML + CSS + JS vanilla en `apps/web/public/`.
- Servidor: Express ESM en `apps/web/server/index.js` (Hostinger Business).
- Servidor: Express 4 con compression + security headers (solo dev local; Hostinger sirve estáticos en prod).
- Formularios: Web3Forms (key real configurada).
- Agendamiento: Cal.com (popup lazy-load, username placeholder pendiente).
- Analítica: Microsoft Clarity + GA4 opt-in (IDs placeholder pendientes).

**Futuro (cuando se justifique):**

- **Backend** (cuando se construya el dashboard / Chat IA / CRM con UI propia):
  - Hono 4 + Drizzle ORM + Lucia v3 + Zod + mysql2.
  - Hostinger Business (Node.js + MySQL incluido).
  - n8n en DonWeb para automatizaciones.
  - LLM API (Anthropic / OpenAI) llamado desde el server, jamás desde cliente.

- **Frontend (migración Astro):**
  - Astro 4 + Svelte islands para Stack Builder/Quiz.
  - Nanostores para estado compartido entre islands.
  - Content collections MDX para casos/blog.
  - Deploy a Cloudflare Pages (mejor latencia, gratis).

**Criterio para migrar a Astro:** aplazado hasta que haya casos de estudio reales o blog que justifique multi-page con templating compartido. Migrar antes es yak-shaving (ver `feedback_client_check.md`).

**Stack cerrado** (ver `feedback_stack_closed.md`): sin Supabase, sin Prisma, sin Express en prod, sin JWT, sin React por defecto, sin NestJS.
