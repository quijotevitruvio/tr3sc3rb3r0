---
name: Web3Forms
description: Recepción gratuita de formularios públicos del sitio (formulario contacto + bundles)
type: reference
---

**Servicio:** Web3Forms (web3forms.com).

**Plan:** Free tier ilimitado (sin throttle de envíos).

**Endpoint:** `https://api.web3forms.com/submit`.

**Access key configurada:** ver `project_w3f_key.md`.

**Forms que usa:**
- Modal de contacto en `index.html` (todos los `.bp` que abren modal).
- Form de paquetes en `bundles.html`.

**Campos especiales que envía la app:**
- `access_key` — auth.
- `subject` — asunto del email recibido.
- `from_name` — sender name.
- `servicio` — campo custom (Chat IA / CRM / Software).
- `contexto` — campo custom con el plan/bundle/stack.
- `idioma` — siempre `es` (post-cleanup).
- `botcheck` — honeypot (debe ir vacío).

**Flujo:**
1. Cliente llena form → POST a Web3Forms.
2. Si éxito → redirect a `/gracias.html?from=form&service=...&plan=...`.
3. `/gracias.html` dispara eventos GA4 (`generate_lead`), Clarity (`lead_submitted`), Meta Pixel (`Lead`).

**Cuando migremos a backend Hono:** Web3Forms queda como fallback opcional, los forms pasan a `/api/contact` con Resend para email transaccional + DB para almacenar leads.

**Allowed domains pendiente** de configurar en panel Web3Forms (ver `project_pending_setup.md`).
