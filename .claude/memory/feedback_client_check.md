---
name: Yak-shaving check antes de tareas largas
description: Antes de proponer trabajo de más de 1-2 días, preguntar si hay cliente esperando
type: feedback
---

**Regla:** Cuando una propuesta implique más de 1-2 días de trabajo, preguntar explícitamente: "¿Hay un cliente esperando esto, o estamos optimizando pre-validación?".

**Why:** Andrés está en etapa de validación de negocio (sin cartera grande de clientes pagando). Construir features arquitectónicas (migración a Astro, dashboard completo, ERP, multi-tenant) antes de tener clientes que las paguen es yak-shaving elegante. El cuello de botella real es ventas, no infraestructura.

**How to apply:**
- Antes de proponer migración a Astro, dashboard custom, backend completo, otro framework → preguntar el client-check.
- Si respuesta es "no hay cliente", recomendar postergar y enfocar en venta/outreach/casos.
- Si respuesta es "sí", proceder con scope acotado al cliente real.
- Excepción: cambios chicos (cleanup, bug fixes, SEO básico) no requieren client-check.
