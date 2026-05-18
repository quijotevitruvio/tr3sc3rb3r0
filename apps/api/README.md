# @tr3sc3rb3r0/api

Backend para Tr3sC3rb3r0. **No implementado todavía** — este directorio es el placeholder y la documentación del plan.

## Stack previsto

- **Hono 4** — HTTP server, ESM, TypeScript.
- **Drizzle ORM** + **drizzle-kit** — migrations y queries tipadas.
- **Lucia v3** — auth con sesiones server-side (no JWT).
- **Zod** — validación de input en cada boundary.
- **MySQL 8** — provisto por Hostinger Business.
- **mysql2** — driver.
- **argon2** — hash de passwords.
- **nanoid** — IDs cortos URL-safe.
- **pino** — logger estructurado.

## Estructura prevista

```text
apps/api/
├── src/
│   ├── index.ts                # Entry: Hono server, escucha process.env.PORT
│   ├── db/
│   │   ├── client.ts           # Conexión MySQL pool
│   │   ├── schema.ts           # Tablas Drizzle (verdad única)
│   │   └── migrations/         # SQL generado por drizzle-kit
│   ├── auth/
│   │   ├── lucia.ts            # Config Lucia
│   │   └── middleware.ts       # requireAuth, requireRole
│   ├── routes/
│   │   ├── auth.ts             # /api/auth/{login, logout, me, register}
│   │   ├── leads.ts            # CRUD + webhook entrada
│   │   ├── clients.ts          # companies + contacts
│   │   ├── deals.ts            # pipeline
│   │   ├── subscriptions.ts    # planes activos por cliente
│   │   ├── invoices.ts         # facturación
│   │   ├── chat.ts             # endpoint para Chat IA (proxy a Anthropic/OpenAI)
│   │   ├── webhooks.ts         # entrada de n8n, Meta Cloud API, Web3Forms
│   │   └── ai.ts               # /api/ai/* (draft email, score lead, summarize)
│   ├── lib/
│   │   ├── env.ts              # parse de env con Zod
│   │   ├── errors.ts           # AppError + middleware
│   │   └── llm.ts              # cliente Anthropic/OpenAI
│   └── types.ts
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## Roadmap

1. **Bootstrap** — Hono + Drizzle + Lucia + schema base (users, sessions, companies, contacts, leads, deals).
2. **Auth flow** — register (cierra después de crear owner), login, me, logout.
3. **CRUD core** — leads, companies, contacts, deals.
4. **Webhook entrada Web3Forms** — `/api/webhooks/form` recibe lead y emite evento a n8n.
5. **Chat IA proxy** — `/api/chat/message` con Anthropic Haiku + RAG sobre `chat_knowledge`.
6. **Capa IA CRM** — draft email, lead scoring, summary de conversación.
7. **Integraciones pagos** — Bold/Wompi/Stripe webhook handlers cuando se deje el pago manual.
8. **Módulo redes sociales** — `social_accounts`, `posts`, `post_targets`, integraciones Meta Graph + LinkedIn + Buffer.

## Deploy previsto en Hostinger

- App Node.js separada en hPanel, subdominio `api.trescerbero.com`.
- Application root: `apps/api`.
- Startup file: `dist/index.js` (post-build con esbuild).
- Variables de entorno por hPanel: `DATABASE_URL`, `SESSION_SECRET`, `N8N_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## Comunicación con n8n

n8n vive en DonWeb (ya pagado). Comunicación bidireccional vía webhooks HTTP con secret compartido (`N8N_SECRET`) y validación HMAC con `crypto.timingSafeEqual`.

- API → n8n: `lead.created`, `deal.won`, `conversation.escalated`, `payment.received`.
- n8n → API: `enrichment.done`, `email.sent`, `scheduled_post.published`.
