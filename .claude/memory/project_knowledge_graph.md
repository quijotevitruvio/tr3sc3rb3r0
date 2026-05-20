---
name: project-knowledge-graph
description: Fase 2.5 — Knowledge Graph "tipo Obsidian" sobre el CRM. Tags + wikilinks parser + grafo interactivo + Markdown export. Pieza estratégica para alimentar IA con contexto rico.
metadata:
  type: project
---

**Decidido 2026-05-20 con Andrés. Ubicación en roadmap: Fase 2.5, entre UI CRM básica (Fase 2.4) y Chat IA (Fase 3).**

## Por qué existe

Sin esto el LLM (Fase 3+) recibe contexto plano. Con esto recibe contexto estructurado: "Juan, CEO Acme (tech, 50 emp), tags [interesado-saas, decision-maker], 3 deals abiertos por $45M, conectado a Maria Lopez vía notas".

**Es la pieza que convierte el CRM en sistema de memoria estructurada** y vuelve "notable" lo que sería un CRM promedio.

## Schema nuevo (3 tablas)

1. **`tags`** — id, orgId, name, category enum(interest|behavior|segment|custom), color hex, createdAt. UNIQUE(orgId, name).
2. **`entity_tags`** — many-to-many polimórfico: tag_id + entity_type (contact|company|deal) + entity_id. PK compuesto previene duplicados. `assignedBy` = userId o NULL si vino del parser.
3. **`entity_links`** — relaciones directas entre entidades del CRM más allá de los FKs naturales. fromType+fromId → toType+toId con relationKind (mentions|related_to|reports_to|partners_with|custom) y source (note_parser|manual|ai).

Las relaciones "naturales" (contact.companyId, deal.contactId) NO se duplican en entity_links — el grafo las lee directo del FK.

## Parser de notas Obsidian-style

Al crear/actualizar una nota, parsear su body:
- `#hashtag-slug` → crear tag (category='custom') si no existe + asignar a la entidad de la nota
- `[[Nombre Entidad]]` → buscar por nombre fuzzy en contacts/companies/deals de la org → crear entity_link con source='note_parser'
- Wikilinks sin match quedan como "broken links" (sugerencia de creación)

## UI

- **`crm-graph.html`** — grafo interactivo con **vis-network** (CDN jsdelivr, ~750KB lazy). Force-directed, zoom, click=panel lateral con detalles.
- **Tag picker** (futuro) embebido en modales de entidad.
- **Autocomplete `[[`** en textareas de notas (futuro).
- Botones "Export Markdown" gated por tier.

## Endpoints

- `GET/POST /api/crm/tags` — listar/crear
- `POST /api/crm/entities/:type/:id/tags` — body `{ tagIds: [...] }` reemplaza set
- `GET /api/crm/graph?center=:type:id&depth=2` — nodos + edges centrados
- `GET /api/crm/graph` — grafo completo de la org (paginado por relevancia)
- `GET /api/crm/entities/:type/:id/export.md` — MD de UNA entidad (Pro+)
- `GET /api/crm/export.zip` — todo en zip (Pro+)

## Tier gating

| Feature | Demo | Básico | Pro | Max |
|---|---|---|---|---|
| Tags + parser de hashtags/wikilinks | ✓ | ✓ | ✓ | ✓ |
| Grafo interactivo | ✓ (50 nodos cap) | ✓ (100) | ✓ ilimitado | ✓ ilimitado |
| Export MD una entidad | ❌ | ❌ | ✓ | ✓ |
| Export bulk zip | ❌ | ❌ | ✓ | ✓ |
| IA sugiere conexiones/clusters | ❌ | ❌ | parcial | ✓ |

## Decisiones de librería

- **vis-network@9** desde jsdelivr CDN → requiere ajustar CSP del web Express (agregar https://cdn.jsdelivr.net a script-src del subdominio app)
- No usar D3 manual (mucho código), Cytoscape (300KB pero API menos amigable), Sigma (50KB pero menos features visuales). vis-network gana por ROI dev.

## Formato Markdown export

Cada entidad exporta a un .md con frontmatter YAML (type, id, tags, created_at, etc.), secciones para datos básicos, notas (con timestamps), deals asociados y conexiones. Compatible con Obsidian para que el usuario pueda abrir el export en su vault si quiere.

Relacionado: [[project-tiers-crm]], [[project-productos]], [[project-demo-strategy]] (los datos del demo también van al grafo).
