# Tr3sC3rb3r0 🐺

Monorepo para Tr3sC3rb3r0 — agencia B2B (Chat IA · CRM · Software a la medida) en Medellín, Colombia.

Dominio: **trescerbero.com**.

---

## Estructura

```text
tr3sc3rb3r0/
├── apps/
│   ├── web/                    # Frontend público (HTML/CSS/JS vanilla → Astro futuro)
│   │   ├── public/             # Estáticos servidos (index, bundles, legales, assets)
│   │   ├── server/             # Express ESM con security headers + cache
│   │   ├── scripts/            # Helpers de build (optimize-svg-raster)
│   │   └── package.json
│   └── api/                    # Backend Hono + Drizzle + Lucia + MySQL (placeholder)
│       ├── README.md           # Plan completo del backend
│       └── package.json
├── packages/
│   └── shared/                 # Tipos, constantes Zod compartidas web ↔ api
│       ├── src/index.ts
│       └── package.json
├── _archive/                   # Material fuera de despliegue (dashboard.html.bak, etc.)
├── src/heads/                  # SVGs originales sin optimizar (no deployan)
├── .claude/                    # Agentes + memoria persistente
│   ├── agents/                 # backend, frontend, marketing, orchestrator, memory
│   └── memory/                 # Decisiones, perfil usuario, references
├── package.json                # Workspace root (npm workspaces)
├── .gitignore
└── README.md
```

---

## Stack

### Hoy (en producción)

- **Frontend:** HTML + CSS + JS vanilla (sin framework cliente).
- **Server:** Express ESM con compression + security headers (CSP, HSTS, X-Frame-Options).
- **Formularios:** Web3Forms (key configurada).
- **Agendamiento:** Cal.com (popup lazy-load).
- **Analítica:** Microsoft Clarity + GA4 opt-in (IDs pendientes).
- **TRM live:** currency-api + fallback Cloudflare.

### Futuro

- **Frontend:** migración a Astro + Svelte islands cuando se sumen casos/blog.
- **Backend:** Hono 4 + Drizzle ORM + Lucia v3 + Zod + MySQL (`apps/api/`).
- **Automatización IA:** n8n en DonWeb (workflows + LLM en bulk).
- **Hosting:** Hostinger Business (web + api + MySQL); n8n queda en DonWeb.

---

## Setup local

Requisitos: Node 20+, npm 10+.

```bash
npm install            # instala todos los workspaces
npm run dev            # arranca apps/web en http://localhost:3000
```

Otros scripts:

```bash
npm run start                  # Producción local del web
npm run optimize:svg           # Pasa svgo sobre wolf heads
npm run optimize:raster        # Re-codifica raster embebido en SVG (sharp)
```

---

## Workspaces

| Workspace | Path | Estado |
| --- | --- | --- |
| `@tr3sc3rb3r0/web` | `apps/web` | Funcionando — vanilla en producción |
| `@tr3sc3rb3r0/api` | `apps/api` | Placeholder — ver `apps/api/README.md` |
| `@tr3sc3rb3r0/shared` | `packages/shared` | Tipos + constantes |

`npm` hoistea las dependencias a `node_modules/` raíz y deja symlinks en `node_modules/@tr3sc3rb3r0/*`.

---

## Despliegue en Hostinger Business

### Aplicación web (Node.js)

- hPanel → Advanced → Node.js → Create Application.
- **Node version:** 20+.
- **Application mode:** Production.
- **Application root:** `apps/web` (o el path del checkout completo si se sube con Git).
- **Application URL:** `trescerbero.com`.
- **Startup file:** `server/index.js`.
- SSH → `npm install --production` desde la raíz del repo.

### Aplicación API (cuando se construya)

- App Node.js separada en hPanel → subdominio `api.trescerbero.com`.
- **Application root:** `apps/api`.
- **Startup file:** `dist/index.js` (build con esbuild).
- Variables de entorno en hPanel: `DATABASE_URL`, `SESSION_SECRET`, `N8N_SECRET`, `ANTHROPIC_API_KEY`.

---

## Variables / IDs pendientes

| Constante | Archivo | Cómo obtener |
| --- | --- | --- |
| `W3F_KEY` | `apps/web/public/assets/js/main.js`, `apps/web/public/bundles.html` | ✅ configurada |
| `CAL_USER` | `apps/web/public/assets/js/main.js` | Crear cuenta cal.com → username |
| `CAL_EVENT` | `apps/web/public/assets/js/main.js` | Event type slug (default `30min`) |
| `CLARITY_ID` | `apps/web/public/assets/js/main.js` | clarity.microsoft.com → Project ID |
| `GA4_ID` | `apps/web/public/assets/js/main.js` | analytics.google.com → Measurement ID |
| NIT `900.000.000-0` | footers + legales | NIT real (o cédula si persona natural) |

---

## Backlog

- [ ] Reemplazar placeholders pendientes (NIT, Cal.com, Clarity, GA4).
- [ ] Generar imagen OG 1200×630 → `apps/web/public/assets/img/og.png`.
- [ ] Bootstrap `apps/api/` con Hono + Drizzle + Lucia + schema base.
- [ ] Webhook `apps/api/src/routes/webhooks.ts` recibe lead Web3Forms y guarda en `leads`.
- [ ] Migrar landing a Astro cuando lleguen casos de estudio reales.

---

## Notas

- Las páginas en `apps/web/public/legal/` son **plantillas orientativas Ley 1581/2012**. Revisar con abogado en Colombia antes de operar comercialmente.
- `_archive/` y `src/heads/` están en `.gitignore` y **no se despliegan**.
- Agentes IA del repo (`.claude/agents/`): `backend`, `frontend`, `marketing`, `orchestrator`, `memory`. Memoria persistente en `.claude/memory/`.
