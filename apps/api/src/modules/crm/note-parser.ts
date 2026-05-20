// Parser estilo Obsidian para notas del CRM.
// Extrae #hashtags → tags automáticos, [[wikilinks]] → entity_links.
// Se ejecuta dentro del POST /notes (después del insert de la nota).
import { eq, and, isNull, or, like } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { tags, entityTags, entityLinks, contacts, companies, deals } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';

const HASHTAG_RE = /#([a-z0-9_\-áéíóúñ]+)/gi;
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

interface ParseContext {
  orgId: Buffer;
  noteId: Buffer;
  entityType: 'contact' | 'company' | 'deal';
  entityId: Buffer;
  body: string;
}

interface ParseResult {
  hashtagsCreated: string[];
  hashtagsLinked: string[];
  wikilinksMatched: { type: string; id: string; label: string }[];
  wikilinksBroken: string[];
}

export async function parseNoteBody(ctx: ParseContext): Promise<ParseResult> {
  const result: ParseResult = {
    hashtagsCreated: [],
    hashtagsLinked: [],
    wikilinksMatched: [],
    wikilinksBroken: [],
  };

  await handleHashtags(ctx, result);
  await handleWikilinks(ctx, result);

  return result;
}

async function handleHashtags(ctx: ParseContext, result: ParseResult) {
  const found = new Set<string>();
  for (const m of ctx.body.matchAll(HASHTAG_RE)) {
    found.add(m[1].toLowerCase());
  }
  if (!found.size) return;

  for (const name of found) {
    // Upsert tag: si existe lo reusamos, si no lo creamos.
    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.orgId, ctx.orgId), eq(tags.name, name)))
      .limit(1);

    let tagId: Buffer;
    if (existing) {
      tagId = existing.id;
      result.hashtagsLinked.push(name);
    } else {
      tagId = newId();
      await db.insert(tags).values({ id: tagId, orgId: ctx.orgId, name, category: 'custom' });
      result.hashtagsCreated.push(name);
    }

    // Asignar tag a la entidad de la nota. PK compuesto previene dup; ignoramos errores.
    try {
      await db.insert(entityTags).values({
        orgId: ctx.orgId,
        tagId,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        assignedBy: null, // parser, no usuario
      });
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
    }
  }
}

async function handleWikilinks(ctx: ParseContext, result: ParseResult) {
  const candidates = new Set<string>();
  for (const m of ctx.body.matchAll(WIKILINK_RE)) {
    candidates.add(m[1].trim());
  }
  if (!candidates.size) return;

  for (const label of candidates) {
    const match = await fuzzyFindEntity(ctx.orgId, label);
    if (!match) {
      result.wikilinksBroken.push(label);
      continue;
    }
    // No-op si el link apunta a la misma entidad de la nota.
    if (match.type === ctx.entityType && Buffer.compare(match.id, ctx.entityId) === 0) continue;

    try {
      await db.insert(entityLinks).values({
        id: newId(),
        orgId: ctx.orgId,
        fromType: ctx.entityType,
        fromId: ctx.entityId,
        toType: match.type,
        toId: match.id,
        relationKind: 'mentions',
        source: 'note_parser',
        sourceNoteId: ctx.noteId,
      });
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
    }
    result.wikilinksMatched.push({ type: match.type, id: match.id.toString('hex'), label });
  }
}

// Búsqueda fuzzy por nombre exacto-case-insensitive y prefix.
// Orden: contact > company > deal (más común en notas).
async function fuzzyFindEntity(orgId: Buffer, label: string): Promise<{ type: 'contact' | 'company' | 'deal'; id: Buffer } | null> {
  const labelLower = label.toLowerCase();

  // Contacts: dividimos el label en palabras y buscamos cualquier match parcial; luego
  // filtramos en JS contra el nombre concatenado (firstName + lastName).
  const words = labelLower.split(/\s+/).filter(Boolean);
  const wordConds = words.flatMap((w) => [like(contacts.firstName, `%${w}%`), like(contacts.lastName, `%${w}%`)]);
  const contactsRows = wordConds.length
    ? await db
        .select({ id: contacts.id, fn: contacts.firstName, ln: contacts.lastName })
        .from(contacts)
        .where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt), or(...wordConds)))
        .limit(50)
    : [];
  // Exacto primero (nombre concatenado coincide con el label)
  for (const c of contactsRows) {
    const full = `${c.fn} ${c.ln ?? ''}`.trim().toLowerCase();
    if (full === labelLower) return { type: 'contact', id: c.id };
    if (c.fn.toLowerCase() === labelLower) return { type: 'contact', id: c.id };
  }

  // Companies
  const companiesRows = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt), like(companies.name, `%${label}%`)))
    .limit(20);
  for (const co of companiesRows) {
    if (co.name.toLowerCase() === labelLower) return { type: 'company', id: co.id };
  }

  // Deals
  const dealsRows = await db
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), like(deals.title, `%${label}%`)))
    .limit(20);
  for (const d of dealsRows) {
    if (d.title.toLowerCase() === labelLower) return { type: 'deal', id: d.id };
  }

  // Si nada matchea exacto, usamos el primer match parcial (preferimos contact > company > deal).
  if (contactsRows[0]) return { type: 'contact', id: contactsRows[0].id };
  if (companiesRows[0]) return { type: 'company', id: companiesRows[0].id };
  if (dealsRows[0]) return { type: 'deal', id: dealsRows[0].id };

  return null;
}
