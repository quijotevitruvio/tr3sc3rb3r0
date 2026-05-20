---
name: Hostinger Business
description: Hosting principal — Node.js apps + MySQL incluido + cron jobs nativos
type: reference
---

**Servicio:** Hostinger Business (plan ya pagado por Andrés).

**Qué usa:**
- Servir landing estática (`apps/web/public/`) vía Node.js (Express ESM hoy, eventualmente sirve directo).
- MySQL/MariaDB incluido — DB del backend Hono.
- Cron jobs nativos vía hPanel.
- SSL automático.
- Backups automáticos del plan Business.

**Detalles concretos (actualizado 2026-05-20 tras integración real):**
- **Plan tipo:** Business clásico (PHP workers + Node.js add-on disponible), NO el plan "Cloud Node.js" puro
- **Server:** `server647` ubicado en USA AZ; FTP IP `185.212.71.135`
- **MySQL host:** `srv647.hstgr.io` (o IP `31.97.208.93`), puerto `3306`
- **MariaDB no MySQL:** Hostinger realmente sirve **MariaDB 11.8.6-log**, 99% compatible con MySQL. Drizzle dialect `mysql` funciona sin cambios.
- **Prefijo obligatorio en nombres:** todas las DB y users llevan prefijo `u917564276_` automático
- **DB actual (dev/prod compartida):** `u917564276_trescerbero_db`, user `u917564276_tresc`
- **Acceso remoto requerido:** hPanel → Bases de datos → MySQL remoto → whitelist de IP del dev. Sin esto MySQL rechaza conexiones desde fuera del server. IP dinámica del ISP = re-whitelistear periódicamente.
- **Wizard Node.js solo ofrece DBs externas** (Supabase/MongoDB Atlas) — IGNORAR. El MySQL nativo vive en otro menú: "Bases de datos → Administración".

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
