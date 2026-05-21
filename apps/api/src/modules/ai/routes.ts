// Endpoints IA generativa: cuota actual + export markdown.
// Las generaciones (email_draft, deal_summary, suggest_action) están expuestas
// como tools del chat L-IA (ver ../chat/tools.ts), no como endpoints REST públicos.
import { Hono } from 'hono';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { contacts, companies, deals, notes, stages, entityTags, tags } from '../../db/schema.js';
import { idToString } from '../../lib/uuid.js';
import { authedOrg } from '../../middleware/org-context.js';
import { tryParseId } from '../crm/helpers.js';
import { checkQuota, getMonthlyQuota } from './quota.js';

export const aiRoutes = new Hono();
aiRoutes.use('*', ...authedOrg);

// ─── CUOTA ACTUAL ────────────────────────────────────────────────
aiRoutes.get('/quota', async (c) => {
  const { orgId, tier } = c.get('org');
  const user = c.get('user')!;
  const q = await checkQuota(orgId, user.id, tier);
  return c.json({
    tier,
    limit: q.limit,
    used: q.used,
    remaining: Math.max(0, q.limit - q.used),
    blocked: !q.allowed,
    reason: q.reason,
  });
});

// ─── EXPORT MD de una entidad (Pro+ por tier) ────────────────────
const EXPORT_TIERS = new Set(['pro', 'max']);

aiRoutes.get('/export/:type/:id.md', async (c) => {
  const { orgId, tier } = c.get('org');
  if (!EXPORT_TIERS.has(tier)) {
    return c.json({ error: { code: 'TIER_REQUIRED', message: 'Export Markdown disponible solo en Pro y Max.', required: 'pro' } }, 402);
  }

  const type = c.req.param('type');
  if (!['contact', 'company', 'deal'].includes(type)) return c.json({ error: { code: 'INVALID_TYPE' } }, 400);
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  let markdown = '';
  let filename = '';

  if (type === 'contact') {
    const [contact] = await db.select().from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).limit(1);
    if (!contact) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

    const company = contact.companyId ? (await db.select().from(companies).where(eq(companies.id, contact.companyId)).limit(1))[0] : null;
    const entityNotes = await db.select().from(notes)
      .where(and(eq(notes.orgId, orgId), eq(notes.entityType, 'contact'), eq(notes.entityId, id)))
      .orderBy(desc(notes.createdAt));
    const contactDeals = await db.select({
      id: deals.id, title: deals.title, amount: deals.amount, currency: deals.currency, status: deals.status,
    }).from(deals).where(and(eq(deals.orgId, orgId), eq(deals.contactId, id), isNull(deals.deletedAt)));
    const entityTagsRows = await db.select({ name: tags.name }).from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(and(eq(entityTags.orgId, orgId), eq(entityTags.entityType, 'contact'), eq(entityTags.entityId, id)));

    filename = `${slugify(contact.firstName + ' ' + (contact.lastName ?? ''))}.md`;
    markdown = renderContactMd({ contact, company, notes: entityNotes, deals: contactDeals, tags: entityTagsRows });
  } else if (type === 'company') {
    const [company] = await db.select().from(companies)
      .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt))).limit(1);
    if (!company) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

    const companyContacts = await db.select().from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.companyId, id), isNull(contacts.deletedAt)));
    const companyDeals = await db.select({
      id: deals.id, title: deals.title, amount: deals.amount, currency: deals.currency, status: deals.status,
    }).from(deals).where(and(eq(deals.orgId, orgId), eq(deals.companyId, id), isNull(deals.deletedAt)));
    const entityNotes = await db.select().from(notes)
      .where(and(eq(notes.orgId, orgId), eq(notes.entityType, 'company'), eq(notes.entityId, id)))
      .orderBy(desc(notes.createdAt));
    const entityTagsRows = await db.select({ name: tags.name }).from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(and(eq(entityTags.orgId, orgId), eq(entityTags.entityType, 'company'), eq(entityTags.entityId, id)));

    filename = `${slugify(company.name)}.md`;
    markdown = renderCompanyMd({ company, contacts: companyContacts, deals: companyDeals, notes: entityNotes, tags: entityTagsRows });
  } else {
    // deal
    const [deal] = await db.select().from(deals)
      .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!deal) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

    const dealStage = deal.stageId ? (await db.select({ name: stages.name }).from(stages).where(eq(stages.id, deal.stageId)).limit(1))[0] : null;
    const dealContact = deal.contactId ? (await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1))[0] : null;
    const dealCompany = deal.companyId ? (await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1))[0] : null;
    const entityNotes = await db.select().from(notes)
      .where(and(eq(notes.orgId, orgId), eq(notes.entityType, 'deal'), eq(notes.entityId, id)))
      .orderBy(desc(notes.createdAt));
    const entityTagsRows = await db.select({ name: tags.name }).from(entityTags)
      .innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(and(eq(entityTags.orgId, orgId), eq(entityTags.entityType, 'deal'), eq(entityTags.entityId, id)));

    filename = `${slugify(deal.title)}.md`;
    markdown = renderDealMd({ deal, stage: dealStage, contact: dealContact, company: dealCompany, notes: entityNotes, tags: entityTagsRows });
  }

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

// ─── helpers de render markdown ──────────────────────────────────
function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function fmDate(d: Date | null): string { return d ? d.toISOString() : ''; }

function renderContactMd({ contact, company, notes, deals, tags }: any): string {
  const fm = [
    '---',
    'type: contact',
    `id: ${idToString(contact.id)}`,
    `name: "${contact.firstName} ${contact.lastName ?? ''}".trim`,
    contact.email ? `email: ${contact.email}` : '',
    company ? `company: "${company.name}"` : '',
    tags.length ? `tags: [${tags.map((t: any) => t.name).join(', ')}]` : '',
    `score: ${contact.score}`,
    `created_at: ${fmDate(contact.createdAt)}`,
    `exported_at: ${new Date().toISOString()}`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const out: string[] = [fm];
  out.push(`# ${contact.firstName} ${contact.lastName ?? ''}`.trim());
  out.push('');
  if (contact.jobTitle) out.push(`**Cargo:** ${contact.jobTitle}`);
  if (contact.email) out.push(`**Email:** ${contact.email}`);
  if (contact.phone) out.push(`**Teléfono:** ${contact.phone}`);
  if (company) out.push(`**Empresa:** [[${company.name}]]`);
  if (contact.source) out.push(`**Origen:** ${contact.source}`);
  out.push('');

  if (tags.length) {
    out.push('## Tags');
    out.push(tags.map((t: any) => `#${t.name}`).join(' '));
    out.push('');
  }

  if (deals.length) {
    out.push(`## Deals (${deals.length})`);
    for (const d of deals) out.push(`- [[${d.title}]] — ${d.amount} ${d.currency} (${d.status})`);
    out.push('');
  }

  if (notes.length) {
    out.push(`## Notas (${notes.length})`);
    for (const n of notes) {
      out.push(`### ${n.createdAt.toISOString().slice(0, 10)}`);
      out.push(n.body);
      out.push('');
    }
  }

  return out.join('\n');
}

function renderCompanyMd({ company, contacts, deals, notes, tags }: any): string {
  const fm = [
    '---',
    'type: company',
    `id: ${idToString(company.id)}`,
    `name: "${company.name}"`,
    company.industry ? `industry: ${company.industry}` : '',
    company.country ? `country: ${company.country}` : '',
    tags.length ? `tags: [${tags.map((t: any) => t.name).join(', ')}]` : '',
    `created_at: ${fmDate(company.createdAt)}`,
    `exported_at: ${new Date().toISOString()}`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const out: string[] = [fm];
  out.push(`# ${company.name}`);
  out.push('');
  if (company.website) out.push(`**Web:** ${company.website}`);
  if (company.industry) out.push(`**Industria:** ${company.industry}`);
  if (company.sizeBucket) out.push(`**Tamaño:** ${company.sizeBucket}`);
  if (company.country || company.city) out.push(`**Ubicación:** ${[company.city, company.country].filter(Boolean).join(', ')}`);
  if (company.notesShort) { out.push(''); out.push(company.notesShort); }
  out.push('');

  if (tags.length) {
    out.push('## Tags');
    out.push(tags.map((t: any) => `#${t.name}`).join(' '));
    out.push('');
  }

  if (contacts.length) {
    out.push(`## Contactos (${contacts.length})`);
    for (const c of contacts) out.push(`- [[${c.firstName} ${c.lastName ?? ''}`.trim() + `]]${c.jobTitle ? ` — ${c.jobTitle}` : ''}${c.email ? ` (${c.email})` : ''}`);
    out.push('');
  }

  if (deals.length) {
    out.push(`## Deals (${deals.length})`);
    for (const d of deals) out.push(`- [[${d.title}]] — ${d.amount} ${d.currency} (${d.status})`);
    out.push('');
  }

  if (notes.length) {
    out.push(`## Notas (${notes.length})`);
    for (const n of notes) {
      out.push(`### ${n.createdAt.toISOString().slice(0, 10)}`);
      out.push(n.body);
      out.push('');
    }
  }

  return out.join('\n');
}

function renderDealMd({ deal, stage, contact, company, notes, tags }: any): string {
  const fm = [
    '---',
    'type: deal',
    `id: ${idToString(deal.id)}`,
    `title: "${deal.title}"`,
    `amount: ${deal.amount} ${deal.currency}`,
    `status: ${deal.status}`,
    stage ? `stage: ${stage.name}` : '',
    tags.length ? `tags: [${tags.map((t: any) => t.name).join(', ')}]` : '',
    `created_at: ${fmDate(deal.createdAt)}`,
    deal.closedAt ? `closed_at: ${fmDate(deal.closedAt)}` : '',
    `exported_at: ${new Date().toISOString()}`,
    '---',
    '',
  ].filter(Boolean).join('\n');

  const out: string[] = [fm];
  out.push(`# ${deal.title}`);
  out.push('');
  out.push(`**Monto:** ${deal.amount} ${deal.currency}`);
  out.push(`**Status:** ${deal.status}${deal.lostReason ? ` — ${deal.lostReason}` : ''}`);
  if (stage) out.push(`**Stage:** ${stage.name}`);
  if (deal.expectedCloseDate) out.push(`**Cierre esperado:** ${deal.expectedCloseDate}`);
  if (contact) out.push(`**Contacto:** [[${contact.firstName} ${contact.lastName ?? ''}`.trim() + ']]');
  if (company) out.push(`**Empresa:** [[${company.name}]]`);
  out.push('');

  if (tags.length) {
    out.push('## Tags');
    out.push(tags.map((t: any) => `#${t.name}`).join(' '));
    out.push('');
  }

  if (notes.length) {
    out.push(`## Notas (${notes.length})`);
    for (const n of notes) {
      out.push(`### ${n.createdAt.toISOString().slice(0, 10)}`);
      out.push(n.body);
      out.push('');
    }
  }

  return out.join('\n');
}
