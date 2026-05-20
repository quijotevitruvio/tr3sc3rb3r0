// Registry de tools que el LLM puede invocar contra el CRM.
// Cada tool: definición JSON-Schema (para Anthropic) + handler async (ejecuta contra DB).
// Multi-tenancy: todos los handlers reciben orgId, userId del contexto autenticado.
import { eq, and, isNull, like, or, asc, desc, count } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  contacts, companies, deals, pipelines, stages, notes, tasks, tags, entityTags,
} from '../../db/schema.js';
import { newId, idToString, idFromString } from '../../lib/uuid.js';
import { logActivity } from '../crm/helpers.js';
import { parseNoteBody } from '../crm/note-parser.js';

interface ToolCtx {
  orgId: Buffer;
  userId: Buffer;
}

// ─── DEFINICIONES (formato Anthropic tool_use) ────────────────────
export const TOOL_DEFINITIONS = [
  {
    name: 'search_contacts',
    description: 'Busca contactos por nombre, apellido o email. Devuelve hasta 10 resultados.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Texto a buscar' } },
      required: ['query'],
    },
  },
  {
    name: 'create_contact',
    description: 'Crea un nuevo contacto. firstName es obligatorio.',
    input_schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        jobTitle: { type: 'string' },
        companyId: { type: 'string', description: 'UUID de empresa (opcional)' },
      },
      required: ['firstName'],
    },
  },
  {
    name: 'search_companies',
    description: 'Busca empresas por nombre.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'create_company',
    description: 'Crea una nueva empresa.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        website: { type: 'string' },
        industry: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_deals',
    description: 'Lista deals. Filtros opcionales: status (open|won|lost), pipelineId.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'won', 'lost'] },
        pipelineId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_deal',
    description: 'Crea un nuevo deal en un pipeline+stage existente. Si no se especifica pipelineId/stageId, usa el primer pipeline y su primer stage.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        amount: { type: 'number', description: 'Monto en COP por default' },
        contactId: { type: 'string' },
        companyId: { type: 'string' },
        pipelineId: { type: 'string' },
        stageId: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'move_deal',
    description: 'Mueve un deal a otro stage. El stage debe pertenecer al mismo pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        stageId: { type: 'string' },
      },
      required: ['dealId', 'stageId'],
    },
  },
  {
    name: 'close_deal',
    description: 'Cierra un deal como won o lost. Si lost, opcionalmente capturar lostReason.',
    input_schema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        outcome: { type: 'string', enum: ['won', 'lost'] },
        lostReason: { type: 'string' },
      },
      required: ['dealId', 'outcome'],
    },
  },
  {
    name: 'add_note',
    description: 'Agrega una nota a un contact, company o deal. La nota se parsea para extraer #hashtags y [[wikilinks]] automáticamente.',
    input_schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['entityType', 'entityId', 'body'],
    },
  },
  {
    name: 'create_task',
    description: 'Crea una tarea con due date opcional, asignable a una entidad.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        dueAt: { type: 'string', description: 'ISO datetime' },
        entityType: { type: 'string', enum: ['contact', 'company', 'deal', 'none'] },
        entityId: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_context',
    description: 'Devuelve un resumen del estado del CRM (totales y top tags). Usar al iniciar una conversación para entender el contexto.',
    input_schema: { type: 'object', properties: {} },
  },
];

// ─── HANDLERS ─────────────────────────────────────────────────────
type Handler = (input: any, ctx: ToolCtx) => Promise<any>;

const handlers: Record<string, Handler> = {
  async search_contacts(input, { orgId }) {
    const q = String(input.query || '').trim();
    if (!q) return { contacts: [] };
    const rows = await db
      .select({
        id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName,
        email: contacts.email, phone: contacts.phone, jobTitle: contacts.jobTitle,
        companyId: contacts.companyId,
      })
      .from(contacts)
      .where(and(
        eq(contacts.orgId, orgId),
        isNull(contacts.deletedAt),
        or(like(contacts.firstName, `%${q}%`), like(contacts.lastName, `%${q}%`), like(contacts.email, `%${q}%`)),
      ))
      .limit(10);
    return { contacts: rows.map((r) => ({ ...r, id: idToString(r.id), companyId: r.companyId ? idToString(r.companyId) : null })) };
  },

  async create_contact(input, { orgId, userId }) {
    const id = newId();
    const companyId = input.companyId ? idFromString(input.companyId) : null;
    if (companyId) {
      const [owned] = await db.select({ id: companies.id }).from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.orgId, orgId), isNull(companies.deletedAt))).limit(1);
      if (!owned) return { error: 'companyId no encontrado en esta organización' };
    }
    if (input.email) {
      const [dup] = await db.select({ id: contacts.id }).from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.email, input.email), isNull(contacts.deletedAt))).limit(1);
      if (dup) return { error: 'Ya existe un contacto con ese email' };
    }
    await db.insert(contacts).values({
      id, orgId, companyId,
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      jobTitle: input.jobTitle ?? null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'contact', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { contact: { id: idToString(id), firstName: input.firstName, lastName: input.lastName, email: input.email } };
  },

  async search_companies(input, { orgId }) {
    const q = String(input.query || '').trim();
    if (!q) return { companies: [] };
    const rows = await db.select({ id: companies.id, name: companies.name, industry: companies.industry, website: companies.website })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt), like(companies.name, `%${q}%`)))
      .limit(10);
    return { companies: rows.map((r) => ({ ...r, id: idToString(r.id) })) };
  },

  async create_company(input, { orgId, userId }) {
    const id = newId();
    await db.insert(companies).values({
      id, orgId,
      name: input.name,
      website: input.website ?? null,
      industry: input.industry ?? null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'company', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { company: { id: idToString(id), name: input.name } };
  },

  async list_deals(input, { orgId }) {
    const conds = [eq(deals.orgId, orgId), isNull(deals.deletedAt)];
    if (input.status && ['open', 'won', 'lost'].includes(input.status)) conds.push(eq(deals.status, input.status));
    if (input.pipelineId) conds.push(eq(deals.pipelineId, idFromString(input.pipelineId)));
    const rows = await db.select({
      id: deals.id, title: deals.title, amount: deals.amount, currency: deals.currency,
      status: deals.status, stageId: deals.stageId, stageName: stages.name,
    })
    .from(deals)
    .leftJoin(stages, eq(deals.stageId, stages.id))
    .where(and(...conds))
    .orderBy(desc(deals.createdAt))
    .limit(20);
    return { deals: rows.map((r) => ({ ...r, id: idToString(r.id), stageId: idToString(r.stageId) })) };
  },

  async create_deal(input, { orgId, userId }) {
    let pipelineBuf = input.pipelineId ? idFromString(input.pipelineId) : null;
    let stageBuf = input.stageId ? idFromString(input.stageId) : null;

    if (!pipelineBuf) {
      const [p] = await db.select({ id: pipelines.id }).from(pipelines)
        .where(and(eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt))).orderBy(asc(pipelines.createdAt)).limit(1);
      if (!p) return { error: 'No hay pipelines en la organización' };
      pipelineBuf = p.id;
    }
    if (!stageBuf) {
      const [s] = await db.select({ id: stages.id }).from(stages)
        .where(eq(stages.pipelineId, pipelineBuf)).orderBy(asc(stages.position)).limit(1);
      if (!s) return { error: 'El pipeline no tiene stages' };
      stageBuf = s.id;
    }

    const id = newId();
    await db.insert(deals).values({
      id, orgId,
      pipelineId: pipelineBuf, stageId: stageBuf,
      contactId: input.contactId ? idFromString(input.contactId) : null,
      companyId: input.companyId ? idFromString(input.companyId) : null,
      title: input.title,
      amount: String(input.amount ?? 0),
      currency: 'COP',
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: id, verb: 'created', payload: { via: 'chat', amount: input.amount } });
    return { deal: { id: idToString(id), title: input.title, amount: input.amount ?? 0 } };
  },

  async move_deal(input, { orgId, userId }) {
    const dealId = idFromString(input.dealId);
    const stageId = idFromString(input.stageId);
    const [existing] = await db.select({ pipelineId: deals.pipelineId, status: deals.status, stageId: deals.stageId })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!existing) return { error: 'Deal no encontrado' };
    if (existing.status !== 'open') return { error: 'Deal cerrado no se puede mover' };
    const [validStage] = await db.select({ id: stages.id }).from(stages)
      .where(and(eq(stages.id, stageId), eq(stages.pipelineId, existing.pipelineId))).limit(1);
    if (!validStage) return { error: 'El stage no pertenece al pipeline del deal' };
    await db.update(deals).set({ stageId }).where(eq(deals.id, dealId));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: dealId, verb: 'moved',
      payload: { fromStageId: idToString(existing.stageId), toStageId: input.stageId, via: 'chat' } });
    return { ok: true };
  },

  async close_deal(input, { orgId, userId }) {
    const dealId = idFromString(input.dealId);
    const [existing] = await db.select({ status: deals.status }).from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!existing) return { error: 'Deal no encontrado' };
    if (existing.status !== 'open') return { error: 'Deal ya está cerrado' };
    await db.update(deals).set({
      status: input.outcome, closedAt: new Date(),
      lostReason: input.outcome === 'lost' ? (input.lostReason ?? null) : null,
    }).where(eq(deals.id, dealId));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: dealId, verb: input.outcome,
      payload: { via: 'chat', reason: input.lostReason } });
    return { ok: true };
  },

  async add_note(input, { orgId, userId }) {
    const eid = idFromString(input.entityId);
    const id = newId();
    await db.insert(notes).values({
      id, orgId, authorId: userId,
      entityType: input.entityType, entityId: eid, body: input.body,
      isAiGenerated: false, // el user pidió la nota; "AI generated" se reserva para drafts auto
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'note', entityId: id, verb: 'created',
      payload: { on: { type: input.entityType, id: input.entityId }, via: 'chat' } });
    const parsed = await parseNoteBody({ orgId, noteId: id, entityType: input.entityType, entityId: eid, body: input.body });
    return { note: { id: idToString(id) }, parsed };
  },

  async create_task(input, { orgId, userId }) {
    const id = newId();
    await db.insert(tasks).values({
      id, orgId, createdBy: userId, assignedTo: userId, // por default asignado al user del chat
      entityType: input.entityType ?? 'none',
      entityId: input.entityId ? idFromString(input.entityId) : null,
      title: input.title,
      description: input.description ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'task', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { task: { id: idToString(id), title: input.title, dueAt: input.dueAt } };
  },

  async get_context(_, { orgId }) {
    const [[{ value: dealsOpen }], [{ value: dealsTotal }], [{ value: contactsTotal }], [{ value: companiesTotal }], topTags] = await Promise.all([
      db.select({ value: count() }).from(deals).where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), eq(deals.status, 'open'))),
      db.select({ value: count() }).from(deals).where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt))),
      db.select({ value: count() }).from(contacts).where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt))),
      db.select({ value: count() }).from(companies).where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt))),
      db.select({ name: tags.name, usage: count(entityTags.tagId) }).from(tags)
        .leftJoin(entityTags, eq(tags.id, entityTags.tagId))
        .where(eq(tags.orgId, orgId))
        .groupBy(tags.id).orderBy(desc(count(entityTags.tagId))).limit(10),
    ]);
    return {
      summary: { dealsOpen, dealsTotal, contactsTotal, companiesTotal },
      topTags: topTags.map((t) => `#${t.name} (${t.usage})`),
    };
  },
};

export async function runTool(name: string, input: any, ctx: ToolCtx): Promise<any> {
  const h = handlers[name];
  if (!h) return { error: `Tool desconocida: ${name}` };
  try {
    return await h(input, ctx);
  } catch (e: any) {
    return { error: e?.message ?? 'Error ejecutando tool' };
  }
}
