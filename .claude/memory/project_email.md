---
name: project-email
description: Email principal del proyecto Tr3sC3rb3r0 — cuenta del CEO (Andrés), usada tanto como user admin como dirección "from" para envíos transaccionales.
metadata:
  type: project
---

**Email principal:** `ceo@trescerbero.com`

Doble uso:
1. **Cuenta del CEO / superadmin** en la app (registro inicial → `users.email`, `is_superadmin=true` cuando corresponda)
2. **Sender / from address** para todos los envíos transaccionales que dispare la app (verificación de email, password reset, notificaciones admin) vía n8n en DonWeb

**Why:** Andrés lo confirmó explícitamente el 2026-05-20. Una sola identidad para owner y comunicaciones evita configurar múltiples buzones en Hostinger y simplifica autoridad/respuestas.

**How to apply:**
- Al implementar el envío de emails (módulo email-verification + password-reset), usar `ceo@trescerbero.com` como `from` por default — no inventar `noreply@`, `hello@`, etc.
- Si en algún momento se necesita un sender distinto (ej. ventas vs. soporte), preguntarle antes de crearlo.
- El primer registro real en la DB de prod debería ser este email, con `is_superadmin=true` seteado manualmente vía SQL después del signup.

Relacionado: [[reference-donweb]] (donde corre n8n que va a hacer los envíos), [[project-domain]].
