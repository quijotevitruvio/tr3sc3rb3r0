---
name: Productos vendibles
description: Catálogo cerrado de las 3 líneas de negocio de Tr3sC3rb3r0 — L-IA CRM (SaaS), Chat IA (SaaS+servicio), Digital (servicio integral web+marketing+SEO).
type: project
---

**Decidido 2026-05-20 con Andrés. Cerrado, no re-discutir nombres ni alcance sin OK explícito.**

## Las 3 líneas de negocio

```
   L-IA CRM     ·     Chat IA      ·     Digital
   (SaaS)              (SaaS+srv)         (servicio integral)
```

### 1. L-IA CRM — Producto SaaS propio (chat-first)

- **Estado:** construido (Fases 1-7). Pendiente deploy + pasarela.
- **Precios:** Demo 30d gratis · Básico 69.000 COP/mes · Pro 199.000 COP/mes · Max 599.000 COP/mes + BYOK obligatorio.
- **Diferenciadores:** chat-first en español, Knowledge Graph estilo Obsidian, IA generativa, export Markdown nativo, datos en Colombia (Habeas Data).
- **Ver:** [[project-tiers-crm]] y [[project-knowledge-graph]] para detalles.

### 2. Chat IA — Producto SaaS futuro + Servicio enterprise

- **Estado:** servicio definido en landing; producto SaaS pendiente de construcción.
- **Producto SaaS futuro (L-IA Chat):** chatbots WhatsApp/Web/Instagram self-service.
  - Precios futuros: Demo 30d · Básico 99k · Pro 299k · Max 899k COP/mes (BYOK).
- **Servicio enterprise:** implementación custom para clientes >50 empleados (cotización aparte, USD $2k-10k setup + retainer).
- **Stack LLM:** Claude (Haiku/Sonnet), GPT-4o, Gemini Pro, OpenRouter — reusa `llm-client.ts` ya existente.
- **Integración:** chatbot → contact/deal automático en L-IA CRM.

### 3. Digital — Servicio profesional integral (NO SaaS)

- **Estado:** definido conceptualmente; landing pendiente de actualizar (T2-T7).
- **Scope:** desarrollo web + marketing pagado (Google Ads, Meta Ads, LinkedIn Ads) + SEO técnico + content + redes sociales + email marketing.
- **Modelo de cobro:** setup único + retainer mensual.

**Los 3 planes (modelo arquitectónico):**

| Plan | Setup único | Retainer COP/mes | Web | Marketing | SEO |
|---|---|---|---|---|---|
| 🪨 **CIMIENTOS** | 2.500.000 COP | 800.000 | WordPress optimizado | 1 campaña Meta | 1 art blog/mes |
| 🏛️ **ESTRUCTURA** | 6.500.000 COP | 3.200.000 | Astro/Next custom + CMS | Meta + Google Search | 2 art blog/mes + linkbuilding |
| 🌆 **EDIFICIO** | 12.000.000+ COP | 8.500.000 | Next + MVP funcional custom | Meta + Google + LinkedIn + Display | 4 art blog + auditoría semestral |

- **Diferencial IA:** copy asistido con Claude, lead scoring con L-IA CRM, análisis competencia mensual (Edificio).
- **No incluye:** ad spend (va directo a plataformas), producción video con crew profesional.
- **Habeas Data:** las campañas email/leads respetan Ley 1581 (consentimiento documentado).

## Bundles cruzados (oferta cerrada)

| Bundle | Componentes | Descuento |
|---|---|---|
| **Conversion Stack** | L-IA CRM Pro + L-IA Chat Pro | −20% Chat |
| **Growth Stack** | Digital ESTRUCTURA + L-IA CRM Pro | −15% sobre retainer Digital |
| **Pipeline Total** | Digital EDIFICIO + L-IA CRM Max + L-IA Chat Max | −25% sobre el total |

## Producto eliminado

**Software a la medida (versión antigua):** eliminado del catálogo. Su scope (desarrollo web custom) ahora vive **dentro de Digital** como parte del setup de cada plan. La marca personal de Andrés como dev freelance queda diferida para otro proyecto futuro, no es parte del roadmap actual.

## Orden de prioridad para construir / vender

1. **L-IA CRM** → ya construido, falta deploy + legales + pasarela → vender YA.
2. **Digital** → no requiere construcción técnica (es servicio), arranca apenas la landing esté actualizada → vendible esta semana si hay capacidad.
3. **L-IA Chat** (producto SaaS) → roadmap de 4-6 semanas full-time, arranca cuando L-IA CRM tenga >10 clientes pagos.

## Target validación

30-50 clientes en los primeros 12 meses entre las 3 líneas. Mix sugerido: 70% L-IA CRM (volumen), 20% Digital (ticket alto), 10% Chat IA enterprise.

Relacionado: [[project-tiers-crm]], [[project-naming]], [[project-knowledge-graph]], [[project-demo-strategy]].
