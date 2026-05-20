// Knowledge Graph: arma nodos + edges para visualización.
// Modo "full": todo el grafo de la org. Modo "center": centrado en una entidad con profundidad N.
import { Hono } from 'hono';
import { eq, and, isNull, or } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { contacts, companies, deals, tags, entityTags, entityLinks } from '../../../db/schema.js';
import { idToString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';

export const graphRoutes = new Hono();
graphRoutes.use('*', ...authedOrg);

// Caps por tier para no devolver grafos gigantes.
const NODE_CAP_BY_TIER: Record<string, number> = {
  demo: 50,
  basico: 100,
  pro: 1000,
  max: 5000,
};

interface Node {
  id: string; // type:hexid
  label: string;
  group: 'contact' | 'company' | 'deal' | 'tag';
  meta?: Record<string, unknown>;
}
interface Edge {
  from: string;
  to: string;
  label?: string;
  kind: string; // 'works_at' | 'has_deal' | 'tagged' | 'mentions' | 'related_to' | etc.
}

function nodeId(type: string, id: Buffer): string {
  return `${type}:${id.toString('hex')}`;
}

graphRoutes.get('/', async (c) => {
  const { orgId, tier } = c.get('org');
  const cap = NODE_CAP_BY_TIER[tier] ?? 100;

  // Cargar entidades base de la org. Limitar por cap global distribuido.
  const perType = Math.ceil(cap / 4);

  const [contactRows, companyRows, dealRows, tagRows] = await Promise.all([
    db
      .select({ id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName, companyId: contacts.companyId })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt)))
      .limit(perType),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt)))
      .limit(perType),
    db
      .select({ id: deals.id, title: deals.title, contactId: deals.contactId, companyId: deals.companyId, status: deals.status })
      .from(deals)
      .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt)))
      .limit(perType),
    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(eq(tags.orgId, orgId))
      .limit(perType),
  ]);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Nodos
  for (const co of contactRows) {
    nodes.push({
      id: nodeId('contact', co.id),
      label: `${co.firstName} ${co.lastName ?? ''}`.trim(),
      group: 'contact',
    });
  }
  for (const cp of companyRows) {
    nodes.push({ id: nodeId('company', cp.id), label: cp.name, group: 'company' });
  }
  for (const d of dealRows) {
    nodes.push({
      id: nodeId('deal', d.id),
      label: d.title,
      group: 'deal',
      meta: { status: d.status },
    });
  }
  for (const t of tagRows) {
    nodes.push({
      id: nodeId('tag', t.id),
      label: `#${t.name}`,
      group: 'tag',
      meta: { color: t.color },
    });
  }

  // Edges naturales (de los FKs)
  for (const co of contactRows) {
    if (co.companyId) {
      edges.push({
        from: nodeId('contact', co.id),
        to: nodeId('company', co.companyId),
        label: 'trabaja en',
        kind: 'works_at',
      });
    }
  }
  for (const d of dealRows) {
    if (d.contactId) {
      edges.push({
        from: nodeId('deal', d.id),
        to: nodeId('contact', d.contactId),
        label: 'contacto',
        kind: 'has_contact',
      });
    }
    if (d.companyId) {
      edges.push({
        from: nodeId('deal', d.id),
        to: nodeId('company', d.companyId),
        label: 'empresa',
        kind: 'has_company',
      });
    }
  }

  // Edges de tags (entity_tags)
  const tagAssignments = await db
    .select({
      tagId: entityTags.tagId,
      entityType: entityTags.entityType,
      entityId: entityTags.entityId,
    })
    .from(entityTags)
    .where(eq(entityTags.orgId, orgId))
    .limit(cap);
  for (const ta of tagAssignments) {
    edges.push({
      from: `${ta.entityType}:${ta.entityId.toString('hex')}`,
      to: nodeId('tag', ta.tagId),
      kind: 'tagged',
    });
  }

  // Edges manuales/parser (entity_links)
  const linkRows = await db
    .select()
    .from(entityLinks)
    .where(eq(entityLinks.orgId, orgId))
    .limit(cap);
  for (const l of linkRows) {
    edges.push({
      from: `${l.fromType}:${l.fromId.toString('hex')}`,
      to: `${l.toType}:${l.toId.toString('hex')}`,
      kind: l.relationKind,
      label: l.relationKind === 'mentions' ? '↪ menciona' : l.relationKind,
    });
  }

  // Filtrar edges huérfanos (que apuntan a nodos no incluidos por cap)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));

  return c.json({
    nodes,
    edges: validEdges,
    capped: contactRows.length === perType || companyRows.length === perType || dealRows.length === perType,
    cap,
    tier,
  });
});
