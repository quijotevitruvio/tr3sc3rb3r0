---
name: Hostinger Business
description: Hosting principal — Node.js apps + MySQL incluido + cron jobs nativos
type: reference
---

**Servicio:** Hostinger Business (plan ya pagado por Andrés).

**Qué usa:**
- Servir landing estática (`apps/web/public/`) vía Node.js (Express ESM hoy, eventualmente sirve directo).
- MySQL incluido — futura DB del backend Hono.
- Cron jobs nativos vía hPanel.
- SSL automático.
- Backups automáticos del plan Business.

**Cómo configurar app Node.js:**
1. hPanel → Advanced → Node.js → Create Application.
2. Node 20+.
3. Application mode: Production.
4. Application URL: `trescerbero.com`.
5. Startup file (web): `apps/web/server/index.js` con Application root al repo raíz.
6. Startup file (api, futuro): `apps/api/dist/index.js` en una app Node.js separada bajo `api.trescerbero.com`.
7. Variables de entorno por hPanel (DATABASE_URL, SESSION_SECRET, N8N_SECRET, LLM keys).

**Limitaciones:**
- Es hosting compartido (no VPS), por lo que apps muy hambrientas de RAM pueden topar. NestJS está descartado por esto. Hono pesa <50MB, suficiente.
- Sin acceso root.

**Backups:** Hostinger los hace, pero también configurar cron diario `mysqldump | gzip` y replicar a Backblaze B2 ($0.005/GB/mes).
