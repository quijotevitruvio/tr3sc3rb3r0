---
name: Web3Forms access key
description: Key real activa para recepción de formularios públicos
type: project
---

**Hecho:** Web3Forms access key activa: `01e52190-ec4a-4e66-8af9-875f2e23a6c9` (configurada 2026-05-17).

**Configurada en:**
- `apps/web/public/assets/js/main.js` — constante `W3F_KEY`.
- `apps/web/public/bundles.html` — constante `W3F_KEY` (mismo valor).

**Plan:** free tier ilimitado de Web3Forms. Cuando migremos a backend Hono, esta key se vuelve fallback y los forms pasan a `/api/contact`.

**Recipient configurado:** `quijotevitruvio@gmail.com` (email personal de Andrés). Cuando exista `hola@trescerbero.com`, actualizar el destinatario en el dashboard de Web3Forms.

**Allowed domains pendiente:** agregar `trescerbero.com` y `localhost:3000` en el panel de Web3Forms para evitar abuso de la key desde otros sitios.
