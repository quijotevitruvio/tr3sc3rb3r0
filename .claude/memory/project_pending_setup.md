---
name: Servicios externos pendientes de configurar
description: IDs/keys reales que faltan reemplazar antes de producción seria
type: project
---

**Pendientes (placeholders en código):**

| Constante | Archivo | Cómo obtener |
| --- | --- | --- |
| `CAL_USER` | `apps/web/public/assets/js/main.js` | Crear cuenta cal.com → elegir username (sugerido `tr3sc3rb3r0`) |
| `CAL_EVENT` | `apps/web/public/assets/js/main.js` | Crear event type en Cal.com (default slug `30min`) |
| `CLARITY_ID` | `apps/web/public/assets/js/main.js` | clarity.microsoft.com → crear proyecto → Project ID (10 chars) |
| `GA4_ID` | `apps/web/public/assets/js/main.js` | analytics.google.com → Admin → Streams → Measurement ID (G-XXXXXXXXXX) |
| NIT `900.000.000-0` | footers `apps/web/public/index.html` + `apps/web/public/legal/*.html` | NIT real cuando constituya SAS, o cédula si opera como persona natural |
| Email `hola@trescerbero.com` | múltiples lugares | Configurar Google Workspace ($6/mes) o alias |

**Acciones de soporte:**
- Dominio `trescerbero.com`: registrar (si no está).
- DNS para email: MX, SPF, DKIM, DMARC cuando se configure el correo.
- Web3Forms allowed domains: agregar `trescerbero.com` (ver `project_w3f_key.md`).
- DNS hacia Hostinger Business para producción.

**Sin estos placeholders configurados:** el sitio funciona en superficie pero (1) Cal.com no agenda, (2) analítica no captura, (3) emails de fallback caen al vacío, (4) legales son incompletas.
