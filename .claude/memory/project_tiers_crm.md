---
name: project-tiers-crm
description: Estructura cerrada de los 4 tiers del CRM Tr3sC3rb3r0 (Demo, Básico, Pro, Max) — precios, features, chat-first contract, BYOK Max-only, exports Pro+, datos demo capturados.
metadata:
  type: project
---

**Decidido 2026-05-20 con Andrés. Cerrado, no re-discutir features sin confirmación explícita.**

## Contrato del producto CRM

- **Chat-first:** la UI principal es un chat con el CRM (LLM router + tool calling). Aplica a todos los tiers, incluido Demo y Básico. UI tradicional (kanban/tabla/formularios) **siempre disponible** como red de seguridad.
- **"Los CRM nunca se rompen":** si IA se cae, cuota se agota o BYOK falla, el chat degrada a modo comando y el CRM sigue 100% operable por clicks.
- **Foco actual:** solo CRM. Chat IA aún sin desarrollar. Software es servicio profesional (venta a medida), no SaaS — sin dashboard de cliente.

## Tiers

| Feature | Demo | Básico | Pro | Max |
|---|---|---|---|---|
| Precio (COP/mes) | gratis 30d | **69.000** | **199.000** | **599.000** + BYOK |
| Login | público, sin login | sí | sí | sí |
| Chat modo comando | ✓ | ✓ | ✓ | ✓ |
| UI tradicional | ✓ | ✓ | ✓ | ✓ |
| Falsa IA full (rules, scoring, automations, plantillas) | ✓ | ✓ | ✓ | ✓ |
| IA generativa (drafts, resúmenes, sugerencias) | ✓ sin cap visible | ✗ | ✓ con cuota mensual | ✓ ilimitado |
| IA profunda (Sonnet, RAG, agentes) | ✗ | ✗ | ✗ | ✓ |
| Export datos (CSV/PDF/backup) | ✗ | ✗ | ✓ | ✓ |
| BYOK (API keys propias) | ✗ | ✗ | ✗ | **✓ obligatorio** |

## Reglas de transición / negocio

- **Demo expira día 31:** modal bloqueante "elegí plan". Datos quedan capturados para Tr3sC3rb3r0 (ver [[project-demo-strategy]]).
- **Demo → Básico** no migra datos (sandbox era nuestro).
- **Demo → Pro/Max** ofrece exportar sandbox como punto de partida.
- **Downgrade** preserva datos, deshabilita features. IA generada en Pro/Max queda como notas read-only en Básico.
- **Cuota Pro agotada:** chat colapsa a modo comando hasta siguiente ciclo. Botones IA ocultos con tooltip.
- **BYOK falla en Max:** fallback al siguiente proveedor configurado (orden de prioridad); si no hay → alerta urgente al admin.

## BYOK — Max only

- Cliente Max configura su(s) API key(s) en Configuración → API Keys
- Soportado: Anthropic, OpenAI, Gemini. Orden de prioridad con fallback automático
- Tokens cobrados directo por el proveedor al cliente, **cero markup nuestro**
- Demo/Básico/Pro: usan key default de Tr3sC3rb3r0 configurada por superadmin

## Cuotas (números iniciales, ajustables con datos reales)

- **Pro:** 500 acciones IA generativa / usuario / mes (1 acción = 1 prompt completo Haiku)
- **Demo:** sin cap visible al usuario; rate limit invisible 10 acciones/min, 200/día por fingerprint+IP

## Anti-abuso

- Demo: cookie + browser fingerprint atan la sesión. Mismo dispositivo no re-empieza el demo borrando cookies.
- Rate limits silenciosos protegen contra bots que vaciarían la key default.

## Pendiente (no bloquea construcción)

- Precio por usuario extra en Básico/Pro/Max
- Plan anual con descuento (sugerencia: 2 meses gratis al pagar 12)
- Política de soporte SLA del Max

Relacionado: [[project-demo-strategy]] (captura legal + Habeas Data), [[project-productos]], [[feedback-stack-closed]].
