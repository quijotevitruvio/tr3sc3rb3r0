// Registry completo de tools del chat L-IA. Paridad total con la UI del CRM.
// Cada tool: definición JSON-Schema (Anthropic) + handler async.
// Multi-tenancy: handlers reciben orgId, userId del contexto auth.
import { eq, and, isNull, like, or, asc, desc, count, inArray, lte, gte } from 'drizzle-orm';
import { db } from '../../db/client.js';
import {
  contacts, companies, deals, pipelines, stages, notes, tasks, tags, entityTags,
  entityLinks, activities, scoringRules, automations, emailTemplates, RULE_TRIGGERS,
} from '../../db/schema.js';
import { newId, idToString, idFromString } from '../../lib/uuid.js';
import { logActivity } from '../crm/helpers.js';
import { parseNoteBody } from '../crm/note-parser.js';
import { generateEmailDraft, generateDealSummary, generateNextAction } from '../ai/generators.js';
import { checkQuota, recordUsage } from '../ai/quota.js';
import { resolveLlmProvider } from '../ai/llm-client.js';

interface ToolCtx {
  orgId: Buffer;
  userId: Buffer;
  tier: 'demo' | 'basico' | 'pro' | 'max';
}

const PIPELINE_LIMIT_BY_TIER: Record<string, number> = { demo: 5, basico: 1, pro: 5, max: 999 };

// Helper: convertir string UUID a Buffer con manejo de error
function uuid(s: string | undefined): Buffer | null {
  if (!s) return null;
  try { return idFromString(s); } catch { return null; }
}

// ════════════════════════════════════════════════════════════════
// DEFINICIONES (formato Anthropic tool_use)
// ════════════════════════════════════════════════════════════════
export const TOOL_DEFINITIONS = [
  // ─── CONTEXT ──────────────────────────────────────────────────
  {
    name: 'get_context',
    description: 'Resumen del estado del CRM (totales y top tags). Usar al iniciar conversación o cuando el usuario pida un overview.',
    input_schema: { type: 'object', properties: {} },
  },

  // ─── CONTACTS ─────────────────────────────────────────────────
  {
    name: 'search_contacts',
    description: 'Busca contactos por nombre, apellido o email (parcial). Devuelve hasta 10.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'get_contact',
    description: 'Trae todos los datos de un contacto por su ID.',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } }, required: ['contactId'] },
  },
  {
    name: 'create_contact',
    description: 'Crea un contacto nuevo. firstName es obligatorio. Email único por org.',
    input_schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' }, lastName: { type: 'string' },
        email: { type: 'string' }, phone: { type: 'string' },
        jobTitle: { type: 'string' }, companyId: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['firstName'],
    },
  },
  {
    name: 'update_contact',
    description: 'Actualiza campos de un contacto existente. Solo pasar los campos a cambiar.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        firstName: { type: 'string' }, lastName: { type: 'string' },
        email: { type: 'string' }, phone: { type: 'string' },
        jobTitle: { type: 'string' }, companyId: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['contactId'],
    },
  },
  {
    name: 'delete_contact',
    description: 'Soft-delete de un contacto (se puede recuperar).',
    input_schema: { type: 'object', properties: { contactId: { type: 'string' } }, required: ['contactId'] },
  },

  // ─── COMPANIES ────────────────────────────────────────────────
  {
    name: 'search_companies',
    description: 'Busca empresas por nombre (parcial). Devuelve hasta 10.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'get_company',
    description: 'Trae datos completos de una empresa por su ID.',
    input_schema: { type: 'object', properties: { companyId: { type: 'string' } }, required: ['companyId'] },
  },
  {
    name: 'create_company',
    description: 'Crea una empresa nueva.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, website: { type: 'string' }, industry: { type: 'string' },
        sizeBucket: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
        country: { type: 'string', description: 'ISO-3166 alpha-2, ej. CO, US' },
        city: { type: 'string' }, notesShort: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_company',
    description: 'Actualiza campos de una empresa.',
    input_schema: {
      type: 'object',
      properties: {
        companyId: { type: 'string' },
        name: { type: 'string' }, website: { type: 'string' }, industry: { type: 'string' },
        sizeBucket: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] },
        country: { type: 'string' }, city: { type: 'string' }, notesShort: { type: 'string' },
      },
      required: ['companyId'],
    },
  },
  {
    name: 'delete_company',
    description: 'Soft-delete de empresa.',
    input_schema: { type: 'object', properties: { companyId: { type: 'string' } }, required: ['companyId'] },
  },

  // ─── DEALS ────────────────────────────────────────────────────
  {
    name: 'list_deals',
    description: 'Lista deals. Filtros opcionales: status, pipelineId, query (busca por título).',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'won', 'lost'] },
        pipelineId: { type: 'string' }, query: { type: 'string' },
      },
    },
  },
  {
    name: 'get_deal',
    description: 'Trae datos completos de un deal por ID.',
    input_schema: { type: 'object', properties: { dealId: { type: 'string' } }, required: ['dealId'] },
  },
  {
    name: 'create_deal',
    description: 'Crea un deal. Si no se pasa pipelineId/stageId usa el primero existente. Amount en COP por default.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, amount: { type: 'number' },
        contactId: { type: 'string' }, companyId: { type: 'string' },
        pipelineId: { type: 'string' }, stageId: { type: 'string' },
        expectedCloseDate: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_deal',
    description: 'Actualiza campos del deal (título, monto, fecha, contacto/empresa asociado).',
    input_schema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        title: { type: 'string' }, amount: { type: 'number' },
        contactId: { type: 'string' }, companyId: { type: 'string' },
        expectedCloseDate: { type: 'string' },
      },
      required: ['dealId'],
    },
  },
  {
    name: 'move_deal',
    description: 'Mueve un deal a otro stage del mismo pipeline.',
    input_schema: { type: 'object', properties: { dealId: { type: 'string' }, stageId: { type: 'string' } }, required: ['dealId', 'stageId'] },
  },
  {
    name: 'close_deal',
    description: 'Cierra un deal como won o lost.',
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
    name: 'reopen_deal',
    description: 'Reabre un deal cerrado (vuelve a status=open).',
    input_schema: { type: 'object', properties: { dealId: { type: 'string' } }, required: ['dealId'] },
  },
  {
    name: 'delete_deal',
    description: 'Soft-delete del deal.',
    input_schema: { type: 'object', properties: { dealId: { type: 'string' } }, required: ['dealId'] },
  },

  // ─── PIPELINES & STAGES ───────────────────────────────────────
  {
    name: 'list_pipelines',
    description: 'Lista todos los pipelines de la org con sus stages.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_pipeline',
    description: 'Crea un pipeline nuevo. Sujeto a límite por tier (Básico=1, Pro=5, Max=ilimitado).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'create_stage',
    description: 'Agrega un stage a un pipeline existente.',
    input_schema: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' }, name: { type: 'string' },
        position: { type: 'number' }, winProbability: { type: 'number' },
      },
      required: ['pipelineId', 'name', 'position'],
    },
  },

  // ─── NOTES ────────────────────────────────────────────────────
  {
    name: 'list_notes',
    description: 'Trae notas de un contact/company/deal.',
    input_schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' },
      },
      required: ['entityType', 'entityId'],
    },
  },
  {
    name: 'add_note',
    description: 'Agrega nota a contact/company/deal. Se parsea automáticamente para extraer #hashtags y [[wikilinks]].',
    input_schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' }, body: { type: 'string' },
      },
      required: ['entityType', 'entityId', 'body'],
    },
  },
  {
    name: 'delete_note',
    description: 'Borra una nota (solo el autor puede).',
    input_schema: { type: 'object', properties: { noteId: { type: 'string' } }, required: ['noteId'] },
  },

  // ─── TASKS ────────────────────────────────────────────────────
  {
    name: 'list_tasks',
    description: 'Lista tareas. Filtros: status, assignedToMe, dueBy (ISO datetime), entityType+entityId.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'done'] },
        assignedToMe: { type: 'boolean' },
        dueBy: { type: 'string' },
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Crea una tarea opcionalmente asociada a una entidad, con due date opcional.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' }, description: { type: 'string' },
        dueAt: { type: 'string', description: 'ISO 8601 con timezone' },
        entityType: { type: 'string', enum: ['contact', 'company', 'deal', 'none'] },
        entityId: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description: 'Actualiza título, descripción o due date de una tarea.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' }, title: { type: 'string' },
        description: { type: 'string' }, dueAt: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'complete_task',
    description: 'Marca una tarea como done.',
    input_schema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },
  {
    name: 'delete_task',
    description: 'Borra una tarea.',
    input_schema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  },

  // ─── TAGS & KNOWLEDGE GRAPH ───────────────────────────────────
  {
    name: 'list_tags',
    description: 'Lista todos los tags de la org con su uso (cantidad de entidades que lo tienen).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_tag',
    description: 'Crea un tag manual. Útil cuando el usuario quiere predefinir una categoría sin pasar por una nota.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'lowercase, sin espacios' },
        category: { type: 'string', enum: ['interest', 'behavior', 'segment', 'custom'] },
        color: { type: 'string', description: 'hex con #, ej #39ff14' },
      },
      required: ['name'],
    },
  },
  {
    name: 'assign_tags_to_entity',
    description: 'Reemplaza el set completo de tags de una entidad. Pasar tagIds: [] para limpiar todos.',
    input_schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' },
        tagIds: { type: 'array', items: { type: 'string' } },
      },
      required: ['entityType', 'entityId', 'tagIds'],
    },
  },
  {
    name: 'get_tags_of_entity',
    description: 'Lista los tags asignados a una entidad.',
    input_schema: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        entityId: { type: 'string' },
      },
      required: ['entityType', 'entityId'],
    },
  },
  {
    name: 'create_entity_link',
    description: 'Crea conexión manual en el Knowledge Graph entre 2 entidades (ej. "Juan reporta a María"). Para mentions usar add_note con [[wikilinks]].',
    input_schema: {
      type: 'object',
      properties: {
        fromType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        fromId: { type: 'string' },
        toType: { type: 'string', enum: ['contact', 'company', 'deal'] },
        toId: { type: 'string' },
        relationKind: { type: 'string', enum: ['related_to', 'reports_to', 'partners_with', 'custom'] },
      },
      required: ['fromType', 'fromId', 'toType', 'toId'],
    },
  },

  // ─── FALSA IA: SCORING RULES ──────────────────────────────────
  {
    name: 'list_scoring_rules',
    description: 'Lista todas las reglas de lead scoring activas e inactivas de la org. Útil para auditar qué dispara puntos.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_scoring_rule',
    description: 'Crea una regla de scoring. trigger es uno de los eventos del CRM. delta puede ser negativo para penalizar. condition es opcional y tiene campos como {amountMin, stageName, tagName, status}.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        trigger: { type: 'string', enum: [...RULE_TRIGGERS] },
        delta: { type: 'number', description: 'puntos a sumar/restar al score del contacto (-1000 a 1000)' },
        condition: { type: 'object', description: 'opcional: { amountMin, amountMax, stageName, tagName, status, currency, sourceContains }' },
      },
      required: ['name', 'trigger', 'delta'],
    },
  },
  {
    name: 'update_scoring_rule',
    description: 'Actualiza una regla existente (cambiar nombre, delta, condición, on/off).',
    input_schema: {
      type: 'object',
      properties: {
        ruleId: { type: 'string' },
        name: { type: 'string' }, delta: { type: 'number' },
        condition: { type: 'object' }, enabled: { type: 'boolean' },
      },
      required: ['ruleId'],
    },
  },
  {
    name: 'delete_scoring_rule',
    description: 'Borra una regla de scoring permanentemente.',
    input_schema: { type: 'object', properties: { ruleId: { type: 'string' } }, required: ['ruleId'] },
  },

  // ─── FALSA IA: AUTOMATIONS ────────────────────────────────────
  {
    name: 'list_automations',
    description: 'Lista todas las automatizaciones if-then de la org con su contador de ejecuciones.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_automation',
    description: 'Crea automation if-then. actions es array de objetos con type=create_task|add_tag|move_deal_to_stage y params según el type. Ej: [{type:"add_tag",tagName:"vip"},{type:"create_task",title:"Llamar",dueOffsetDays:1,attachToSource:true}].',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        trigger: { type: 'string', enum: [...RULE_TRIGGERS] },
        condition: { type: 'object' },
        actions: { type: 'array', items: { type: 'object' } },
      },
      required: ['name', 'trigger', 'actions'],
    },
  },
  {
    name: 'update_automation',
    description: 'Actualiza una automation (renombrar, cambiar condición/acciones, on/off).',
    input_schema: {
      type: 'object',
      properties: {
        automationId: { type: 'string' },
        name: { type: 'string' }, description: { type: 'string' },
        condition: { type: 'object' }, actions: { type: 'array', items: { type: 'object' } },
        enabled: { type: 'boolean' },
      },
      required: ['automationId'],
    },
  },
  {
    name: 'delete_automation',
    description: 'Borra una automatización.',
    input_schema: { type: 'object', properties: { automationId: { type: 'string' } }, required: ['automationId'] },
  },

  // ─── FALSA IA: EMAIL TEMPLATES ────────────────────────────────
  {
    name: 'list_email_templates',
    description: 'Lista las plantillas de email disponibles para usar con clientes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_email_template',
    description: 'Crea una plantilla con placeholders {{firstName}}, {{lastName}}, {{companyName}}, {{dealTitle}}, {{dealAmount}}, {{userName}}.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' },
        category: { type: 'string', enum: ['welcome', 'follow_up', 'proposal', 'reminder', 'custom'] },
      },
      required: ['name', 'subject', 'body'],
    },
  },
  {
    name: 'render_email_template',
    description: 'Renderiza una plantilla reemplazando los placeholders con datos reales de un contact y/o deal. Devuelve subject y body listos para copiar/pegar.',
    input_schema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        contactId: { type: 'string', description: 'contacto para placeholders {{firstName}}, etc.' },
        dealId: { type: 'string', description: 'deal opcional para {{dealTitle}}, {{dealAmount}}' },
      },
      required: ['templateId'],
    },
  },

  // ─── IA GENERATIVA (Pro+) ─────────────────────────────────────
  {
    name: 'generate_email_draft',
    description: 'Redacta un email personalizado usando IA. Recibe contactId + brief (qué querés decir). Devuelve subject + body. Consume 1 acción de cuota IA mensual. Tier Básico no puede usar.',
    input_schema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        dealId: { type: 'string', description: 'opcional, para personalizar contexto' },
        brief: { type: 'string', description: 'qué querés que el email diga, en lenguaje natural' },
        tone: { type: 'string', enum: ['formal', 'casual', 'directo'] },
      },
      required: ['contactId', 'brief'],
    },
  },
  {
    name: 'generate_deal_summary',
    description: 'Genera un resumen IA de un deal con su histórico de notas y actividad. Útil al cerrar deals para documentar lecciones. Consume 1 acción de cuota IA.',
    input_schema: {
      type: 'object',
      properties: { dealId: { type: 'string' } },
      required: ['dealId'],
    },
  },
  {
    name: 'suggest_next_action',
    description: 'Sugiere la próxima mejor acción para un contacto basándose en su score, deals, notas, etc. Devuelve "ACCIÓN: X. POR QUÉ: Y". Consume 1 acción de cuota IA.',
    input_schema: {
      type: 'object',
      properties: { contactId: { type: 'string' } },
      required: ['contactId'],
    },
  },

  // ─── RAG SIMPLE (full-text search en notas + activities) ──────
  {
    name: 'search_history',
    description: 'Busca en TODAS las notas y actividades del CRM por una palabra clave. Útil para recuperar contexto cuando el usuario pregunta cosas tipo "qué dijimos sobre X" o "cuándo cerramos el deal de Y". No consume cuota IA (es búsqueda directa en DB). Devuelve hasta 10 resultados con la entidad asociada.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'palabra o frase a buscar (LIKE %query%)' },
      },
      required: ['query'],
    },
  },
];

// ════════════════════════════════════════════════════════════════
// HANDLERS
// ════════════════════════════════════════════════════════════════
type Handler = (input: any, ctx: ToolCtx) => Promise<any>;

const handlers: Record<string, Handler> = {

  // ─── CONTEXT ──────────────────────────────────────────────────
  async get_context(_, { orgId }) {
    const [[{ value: dealsOpen }], [{ value: dealsTotal }], [{ value: contactsTotal }], [{ value: companiesTotal }], topTags] = await Promise.all([
      db.select({ value: count() }).from(deals).where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt), eq(deals.status, 'open'))),
      db.select({ value: count() }).from(deals).where(and(eq(deals.orgId, orgId), isNull(deals.deletedAt))),
      db.select({ value: count() }).from(contacts).where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt))),
      db.select({ value: count() }).from(companies).where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt))),
      db.select({ name: tags.name, usage: count(entityTags.tagId) })
        .from(tags).leftJoin(entityTags, eq(tags.id, entityTags.tagId))
        .where(eq(tags.orgId, orgId)).groupBy(tags.id).orderBy(desc(count(entityTags.tagId))).limit(10),
    ]);
    return { summary: { dealsOpen, dealsTotal, contactsTotal, companiesTotal }, topTags: topTags.map((t) => `#${t.name} (${t.usage})`) };
  },

  // ─── CONTACTS ─────────────────────────────────────────────────
  async search_contacts(input, { orgId }) {
    const q = String(input.query || '').trim();
    if (!q) return { contacts: [] };
    const rows = await db.select({
        id: contacts.id, firstName: contacts.firstName, lastName: contacts.lastName,
        email: contacts.email, phone: contacts.phone, jobTitle: contacts.jobTitle, companyId: contacts.companyId,
      })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt),
        or(like(contacts.firstName, `%${q}%`), like(contacts.lastName, `%${q}%`), like(contacts.email, `%${q}%`))))
      .limit(10);
    return { contacts: rows.map((r) => ({ ...r, id: idToString(r.id), companyId: r.companyId ? idToString(r.companyId) : null })) };
  },

  async get_contact(input, { orgId }) {
    const id = uuid(input.contactId);
    if (!id) return { error: 'contactId inválido' };
    const [row] = await db.select().from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).limit(1);
    if (!row) return { error: 'Contacto no encontrado' };
    return { contact: { ...row, id: idToString(row.id), companyId: row.companyId ? idToString(row.companyId) : null } };
  },

  async create_contact(input, { orgId, userId }) {
    const id = newId();
    const companyId = uuid(input.companyId);
    if (input.companyId && !companyId) return { error: 'companyId inválido' };
    if (companyId) {
      const [owned] = await db.select({ id: companies.id }).from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.orgId, orgId), isNull(companies.deletedAt))).limit(1);
      if (!owned) return { error: 'Empresa no encontrada' };
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
      email: input.email ?? null, phone: input.phone ?? null,
      jobTitle: input.jobTitle ?? null, source: input.source ?? null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'contact', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { contact: { id: idToString(id), firstName: input.firstName, lastName: input.lastName, email: input.email } };
  },

  async update_contact(input, { orgId, userId }) {
    const id = uuid(input.contactId);
    if (!id) return { error: 'contactId inválido' };
    const [existing] = await db.select({ id: contacts.id }).from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).limit(1);
    if (!existing) return { error: 'Contacto no encontrado' };
    const set: Record<string, unknown> = {};
    if (input.firstName !== undefined) set.firstName = input.firstName;
    if (input.lastName !== undefined) set.lastName = input.lastName ?? null;
    if (input.email !== undefined) set.email = input.email ?? null;
    if (input.phone !== undefined) set.phone = input.phone ?? null;
    if (input.jobTitle !== undefined) set.jobTitle = input.jobTitle ?? null;
    if (input.source !== undefined) set.source = input.source ?? null;
    if (input.companyId !== undefined) {
      const c = uuid(input.companyId);
      if (input.companyId && !c) return { error: 'companyId inválido' };
      if (c) {
        const [owned] = await db.select({ id: companies.id }).from(companies)
          .where(and(eq(companies.id, c), eq(companies.orgId, orgId))).limit(1);
        if (!owned) return { error: 'Empresa no encontrada' };
      }
      set.companyId = c;
    }
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(contacts).set(set as any).where(eq(contacts.id, id));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'contact', entityId: id, verb: 'updated', payload: { via: 'chat', fields: Object.keys(set) } });
    return { ok: true };
  },

  async delete_contact(input, { orgId, userId }) {
    const id = uuid(input.contactId);
    if (!id) return { error: 'contactId inválido' };
    await db.update(contacts).set({ deletedAt: new Date() })
      .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt)));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'contact', entityId: id, verb: 'deleted', payload: { via: 'chat' } });
    return { ok: true };
  },

  // ─── COMPANIES ────────────────────────────────────────────────
  async search_companies(input, { orgId }) {
    const q = String(input.query || '').trim();
    if (!q) return { companies: [] };
    const rows = await db.select({ id: companies.id, name: companies.name, industry: companies.industry, website: companies.website })
      .from(companies)
      .where(and(eq(companies.orgId, orgId), isNull(companies.deletedAt), like(companies.name, `%${q}%`)))
      .limit(10);
    return { companies: rows.map((r) => ({ ...r, id: idToString(r.id) })) };
  },

  async get_company(input, { orgId }) {
    const id = uuid(input.companyId);
    if (!id) return { error: 'companyId inválido' };
    const [row] = await db.select().from(companies)
      .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt))).limit(1);
    if (!row) return { error: 'Empresa no encontrada' };
    return { company: { ...row, id: idToString(row.id) } };
  },

  async create_company(input, { orgId, userId }) {
    const id = newId();
    await db.insert(companies).values({
      id, orgId, name: input.name,
      website: input.website ?? null, industry: input.industry ?? null,
      sizeBucket: input.sizeBucket ?? null, country: input.country ?? null,
      city: input.city ?? null, notesShort: input.notesShort ?? null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'company', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { company: { id: idToString(id), name: input.name } };
  },

  async update_company(input, { orgId, userId }) {
    const id = uuid(input.companyId);
    if (!id) return { error: 'companyId inválido' };
    const [existing] = await db.select({ id: companies.id }).from(companies)
      .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt))).limit(1);
    if (!existing) return { error: 'Empresa no encontrada' };
    const set: Record<string, unknown> = {};
    for (const k of ['name', 'website', 'industry', 'sizeBucket', 'country', 'city', 'notesShort']) {
      if (input[k] !== undefined) set[k] = input[k] || null;
    }
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(companies).set(set as any).where(eq(companies.id, id));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'company', entityId: id, verb: 'updated', payload: { via: 'chat', fields: Object.keys(set) } });
    return { ok: true };
  },

  async delete_company(input, { orgId, userId }) {
    const id = uuid(input.companyId);
    if (!id) return { error: 'companyId inválido' };
    await db.update(companies).set({ deletedAt: new Date() })
      .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt)));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'company', entityId: id, verb: 'deleted', payload: { via: 'chat' } });
    return { ok: true };
  },

  // ─── DEALS ────────────────────────────────────────────────────
  async list_deals(input, { orgId }) {
    const conds = [eq(deals.orgId, orgId), isNull(deals.deletedAt)];
    if (input.status && ['open', 'won', 'lost'].includes(input.status)) conds.push(eq(deals.status, input.status));
    if (input.pipelineId) { const p = uuid(input.pipelineId); if (p) conds.push(eq(deals.pipelineId, p)); }
    if (input.query) conds.push(like(deals.title, `%${input.query.trim()}%`));
    const rows = await db.select({
      id: deals.id, title: deals.title, amount: deals.amount, currency: deals.currency,
      status: deals.status, stageId: deals.stageId, stageName: stages.name,
    })
    .from(deals).leftJoin(stages, eq(deals.stageId, stages.id))
    .where(and(...conds)).orderBy(desc(deals.createdAt)).limit(20);
    return { deals: rows.map((r) => ({ ...r, id: idToString(r.id), stageId: idToString(r.stageId) })) };
  },

  async get_deal(input, { orgId }) {
    const id = uuid(input.dealId);
    if (!id) return { error: 'dealId inválido' };
    const [row] = await db.select().from(deals)
      .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!row) return { error: 'Deal no encontrado' };
    return { deal: {
      ...row, id: idToString(row.id),
      pipelineId: idToString(row.pipelineId), stageId: idToString(row.stageId),
      contactId: row.contactId ? idToString(row.contactId) : null,
      companyId: row.companyId ? idToString(row.companyId) : null,
    }};
  },

  async create_deal(input, { orgId, userId }) {
    let pipelineBuf = uuid(input.pipelineId);
    let stageBuf = uuid(input.stageId);
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
      id, orgId, pipelineId: pipelineBuf, stageId: stageBuf,
      contactId: uuid(input.contactId), companyId: uuid(input.companyId),
      title: input.title, amount: String(input.amount ?? 0), currency: 'COP',
      expectedCloseDate: input.expectedCloseDate ?? null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: id, verb: 'created', payload: { via: 'chat', amount: input.amount } });
    return { deal: { id: idToString(id), title: input.title, amount: input.amount ?? 0 } };
  },

  async update_deal(input, { orgId, userId }) {
    const id = uuid(input.dealId);
    if (!id) return { error: 'dealId inválido' };
    const [existing] = await db.select({ id: deals.id }).from(deals)
      .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!existing) return { error: 'Deal no encontrado' };
    const set: Record<string, unknown> = {};
    if (input.title !== undefined) set.title = input.title;
    if (input.amount !== undefined) set.amount = String(input.amount);
    if (input.expectedCloseDate !== undefined) set.expectedCloseDate = input.expectedCloseDate ?? null;
    if (input.contactId !== undefined) set.contactId = uuid(input.contactId);
    if (input.companyId !== undefined) set.companyId = uuid(input.companyId);
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(deals).set(set as any).where(eq(deals.id, id));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: id, verb: 'updated', payload: { via: 'chat', fields: Object.keys(set) } });
    return { ok: true };
  },

  async move_deal(input, { orgId, userId }) {
    const dealId = uuid(input.dealId);
    const stageId = uuid(input.stageId);
    if (!dealId || !stageId) return { error: 'IDs inválidos' };
    const [existing] = await db.select({ pipelineId: deals.pipelineId, status: deals.status, stageId: deals.stageId })
      .from(deals).where(and(eq(deals.id, dealId), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
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
    const dealId = uuid(input.dealId);
    if (!dealId) return { error: 'dealId inválido' };
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

  async reopen_deal(input, { orgId, userId }) {
    const dealId = uuid(input.dealId);
    if (!dealId) return { error: 'dealId inválido' };
    const [existing] = await db.select({ status: deals.status }).from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
    if (!existing) return { error: 'Deal no encontrado' };
    if (existing.status === 'open') return { ok: true, unchanged: true };
    await db.update(deals).set({ status: 'open', closedAt: null, lostReason: null }).where(eq(deals.id, dealId));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: dealId, verb: 'reopened', payload: { via: 'chat' } });
    return { ok: true };
  },

  async delete_deal(input, { orgId, userId }) {
    const id = uuid(input.dealId);
    if (!id) return { error: 'dealId inválido' };
    await db.update(deals).set({ deletedAt: new Date() })
      .where(and(eq(deals.id, id), eq(deals.orgId, orgId), isNull(deals.deletedAt)));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'deal', entityId: id, verb: 'deleted', payload: { via: 'chat' } });
    return { ok: true };
  },

  // ─── PIPELINES & STAGES ───────────────────────────────────────
  async list_pipelines(_, { orgId }) {
    const pipes = await db.select().from(pipelines)
      .where(and(eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt))).orderBy(asc(pipelines.createdAt));
    const result: any[] = [];
    for (const p of pipes) {
      const sts = await db.select().from(stages).where(eq(stages.pipelineId, p.id)).orderBy(asc(stages.position));
      result.push({
        id: idToString(p.id), name: p.name, isDefault: p.isDefault,
        stages: sts.map((s) => ({ id: idToString(s.id), name: s.name, position: s.position, winProbability: s.winProbability })),
      });
    }
    return { pipelines: result };
  },

  async create_pipeline(input, { orgId, userId, tier }) {
    const limit = PIPELINE_LIMIT_BY_TIER[tier] ?? 1;
    const [{ value: existing }] = await db.select({ value: count() }).from(pipelines)
      .where(and(eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt)));
    if (existing >= limit) return { error: `Tu plan ${tier.toUpperCase()} permite ${limit} pipeline(s). Subí a Pro o Max para más.` };
    const id = newId();
    await db.insert(pipelines).values({ id, orgId, name: input.name, isDefault: false });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'pipeline', entityId: id, verb: 'created', payload: { via: 'chat', name: input.name } });
    return { pipeline: { id: idToString(id), name: input.name } };
  },

  async create_stage(input, { orgId }) {
    const pipelineId = uuid(input.pipelineId);
    if (!pipelineId) return { error: 'pipelineId inválido' };
    const [owned] = await db.select({ id: pipelines.id }).from(pipelines)
      .where(and(eq(pipelines.id, pipelineId), eq(pipelines.orgId, orgId), isNull(pipelines.deletedAt))).limit(1);
    if (!owned) return { error: 'Pipeline no encontrado' };
    const id = newId();
    await db.insert(stages).values({
      id, pipelineId, name: input.name,
      position: input.position, winProbability: input.winProbability ?? 50,
    });
    return { stage: { id: idToString(id), name: input.name, position: input.position } };
  },

  // ─── NOTES ────────────────────────────────────────────────────
  async list_notes(input, { orgId }) {
    if (!['contact', 'company', 'deal'].includes(input.entityType)) return { error: 'entityType inválido' };
    const eid = uuid(input.entityId);
    if (!eid) return { error: 'entityId inválido' };
    const rows = await db.select().from(notes)
      .where(and(eq(notes.orgId, orgId), eq(notes.entityType, input.entityType), eq(notes.entityId, eid)))
      .orderBy(desc(notes.createdAt));
    return { notes: rows.map((n) => ({ id: idToString(n.id), body: n.body, authorId: idToString(n.authorId), createdAt: n.createdAt, isAiGenerated: n.isAiGenerated })) };
  },

  async add_note(input, { orgId, userId }) {
    const eid = uuid(input.entityId);
    if (!eid) return { error: 'entityId inválido' };
    const id = newId();
    await db.insert(notes).values({
      id, orgId, authorId: userId,
      entityType: input.entityType, entityId: eid, body: input.body, isAiGenerated: false,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'note', entityId: id, verb: 'created',
      payload: { on: { type: input.entityType, id: input.entityId }, via: 'chat' } });
    const parsed = await parseNoteBody({ orgId, noteId: id, entityType: input.entityType, entityId: eid, body: input.body });
    return { note: { id: idToString(id) }, parsed };
  },

  async delete_note(input, { orgId, userId }) {
    const id = uuid(input.noteId);
    if (!id) return { error: 'noteId inválido' };
    const [existing] = await db.select({ authorId: notes.authorId }).from(notes)
      .where(and(eq(notes.id, id), eq(notes.orgId, orgId))).limit(1);
    if (!existing) return { error: 'Nota no encontrada' };
    if (Buffer.compare(existing.authorId, userId) !== 0) return { error: 'Solo el autor puede borrar la nota' };
    await db.delete(notes).where(eq(notes.id, id));
    return { ok: true };
  },

  // ─── TASKS ────────────────────────────────────────────────────
  async list_tasks(input, { orgId, userId }) {
    const conds = [eq(tasks.orgId, orgId)];
    if (input.status && ['todo', 'done'].includes(input.status)) conds.push(eq(tasks.status, input.status));
    if (input.assignedToMe === true) conds.push(eq(tasks.assignedTo, userId));
    if (input.dueBy) { const d = new Date(input.dueBy); if (!isNaN(d.getTime())) conds.push(lte(tasks.dueAt, d)); }
    if (input.entityType && input.entityId) {
      const eid = uuid(input.entityId);
      if (eid) { conds.push(eq(tasks.entityType, input.entityType)); conds.push(eq(tasks.entityId, eid)); }
    }
    const rows = await db.select().from(tasks).where(and(...conds)).orderBy(asc(tasks.dueAt), desc(tasks.createdAt)).limit(20);
    return { tasks: rows.map((t) => ({
      id: idToString(t.id), title: t.title, status: t.status, dueAt: t.dueAt,
      entityType: t.entityType, entityId: t.entityId ? idToString(t.entityId) : null,
    })) };
  },

  async create_task(input, { orgId, userId }) {
    const id = newId();
    await db.insert(tasks).values({
      id, orgId, createdBy: userId, assignedTo: userId,
      entityType: input.entityType ?? 'none',
      entityId: input.entityId ? uuid(input.entityId) : null,
      title: input.title, description: input.description ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    });
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'task', entityId: id, verb: 'created', payload: { via: 'chat' } });
    return { task: { id: idToString(id), title: input.title, dueAt: input.dueAt } };
  },

  async update_task(input, { orgId, userId }) {
    const id = uuid(input.taskId);
    if (!id) return { error: 'taskId inválido' };
    const set: Record<string, unknown> = {};
    if (input.title !== undefined) set.title = input.title;
    if (input.description !== undefined) set.description = input.description ?? null;
    if (input.dueAt !== undefined) set.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(tasks).set(set as any).where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'task', entityId: id, verb: 'updated', payload: { via: 'chat', fields: Object.keys(set) } });
    return { ok: true };
  },

  async complete_task(input, { orgId, userId }) {
    const id = uuid(input.taskId);
    if (!id) return { error: 'taskId inválido' };
    await db.update(tasks).set({ status: 'done', completedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)));
    await logActivity({ orgId, actorId: userId, actorKind: 'ai', entityType: 'task', entityId: id, verb: 'completed', payload: { via: 'chat' } });
    return { ok: true };
  },

  async delete_task(input, { orgId }) {
    const id = uuid(input.taskId);
    if (!id) return { error: 'taskId inválido' };
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)));
    return { ok: true };
  },

  // ─── TAGS & KNOWLEDGE GRAPH ───────────────────────────────────
  async list_tags(_, { orgId }) {
    const rows = await db.select({ id: tags.id, name: tags.name, category: tags.category, color: tags.color, usage: count(entityTags.tagId) })
      .from(tags).leftJoin(entityTags, eq(tags.id, entityTags.tagId))
      .where(eq(tags.orgId, orgId)).groupBy(tags.id).orderBy(desc(count(entityTags.tagId)), asc(tags.name));
    return { tags: rows.map((r) => ({ ...r, id: idToString(r.id) })) };
  },

  async create_tag(input, { orgId }) {
    const name = String(input.name || '').trim().toLowerCase();
    if (!name || !/^[a-z0-9_\-áéíóúñ]+$/i.test(name)) return { error: 'Nombre de tag inválido (lowercase, sin espacios)' };
    const [existing] = await db.select({ id: tags.id }).from(tags)
      .where(and(eq(tags.orgId, orgId), eq(tags.name, name))).limit(1);
    if (existing) return { tag: { id: idToString(existing.id), name }, existing: true };
    const id = newId();
    await db.insert(tags).values({
      id, orgId, name,
      category: input.category || 'custom',
      color: input.color || '#39ff14',
    });
    return { tag: { id: idToString(id), name } };
  },

  async assign_tags_to_entity(input, { orgId, userId }) {
    if (!['contact', 'company', 'deal'].includes(input.entityType)) return { error: 'entityType inválido' };
    const eid = uuid(input.entityId);
    if (!eid) return { error: 'entityId inválido' };
    const table = input.entityType === 'contact' ? contacts : input.entityType === 'company' ? companies : deals;
    const [owned] = await db.select({ id: table.id }).from(table)
      .where(and(eq(table.id, eid), eq(table.orgId, orgId))).limit(1);
    if (!owned) return { error: 'Entidad no encontrada' };

    const tagBufs = (input.tagIds || []).map((s: string) => uuid(s)).filter(Boolean) as Buffer[];
    if (tagBufs.length) {
      const valid = await db.select({ id: tags.id }).from(tags)
        .where(and(eq(tags.orgId, orgId), inArray(tags.id, tagBufs)));
      if (valid.length !== tagBufs.length) return { error: 'Algún tagId no existe en la org' };
    }
    await db.delete(entityTags).where(and(
      eq(entityTags.orgId, orgId),
      eq(entityTags.entityType, input.entityType),
      eq(entityTags.entityId, eid),
    ));
    for (const tagId of tagBufs) {
      await db.insert(entityTags).values({ orgId, tagId, entityType: input.entityType, entityId: eid, assignedBy: userId });
    }
    return { ok: true, assigned: tagBufs.length };
  },

  async get_tags_of_entity(input, { orgId }) {
    if (!['contact', 'company', 'deal'].includes(input.entityType)) return { error: 'entityType inválido' };
    const eid = uuid(input.entityId);
    if (!eid) return { error: 'entityId inválido' };
    const rows = await db.select({ id: tags.id, name: tags.name, color: tags.color })
      .from(entityTags).innerJoin(tags, eq(entityTags.tagId, tags.id))
      .where(and(eq(entityTags.orgId, orgId), eq(entityTags.entityType, input.entityType), eq(entityTags.entityId, eid)))
      .orderBy(asc(tags.name));
    return { tags: rows.map((t) => ({ ...t, id: idToString(t.id) })) };
  },

  async create_entity_link(input, { orgId }) {
    if (!['contact', 'company', 'deal'].includes(input.fromType)) return { error: 'fromType inválido' };
    if (!['contact', 'company', 'deal'].includes(input.toType)) return { error: 'toType inválido' };
    const fromId = uuid(input.fromId);
    const toId = uuid(input.toId);
    if (!fromId || !toId) return { error: 'IDs inválidos' };
    if (input.fromType === input.toType && Buffer.compare(fromId, toId) === 0) return { error: 'No se puede conectar una entidad consigo misma' };
    const id = newId();
    try {
      await db.insert(entityLinks).values({
        id, orgId,
        fromType: input.fromType, fromId,
        toType: input.toType, toId,
        relationKind: input.relationKind || 'related_to',
        source: 'manual',
      });
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') return { ok: true, existing: true };
      throw e;
    }
    return { link: { id: idToString(id) } };
  },

  // ─── FALSA IA: SCORING RULES ──────────────────────────────────
  async list_scoring_rules(_, { orgId }) {
    const rows = await db.select().from(scoringRules)
      .where(eq(scoringRules.orgId, orgId)).orderBy(asc(scoringRules.name));
    return { rules: rows.map((r) => ({
      id: idToString(r.id), name: r.name, trigger: r.trigger,
      delta: r.delta, condition: r.conditionJson, enabled: r.enabled,
    })) };
  },

  async create_scoring_rule(input, { orgId }) {
    if (!RULE_TRIGGERS.includes(input.trigger)) return { error: `trigger inválido. Debe ser uno de: ${RULE_TRIGGERS.join(', ')}` };
    const delta = Number(input.delta);
    if (!Number.isInteger(delta) || delta < -1000 || delta > 1000) return { error: 'delta debe ser entero entre -1000 y 1000' };
    const id = newId();
    await db.insert(scoringRules).values({
      id, orgId, name: input.name, trigger: input.trigger, delta,
      conditionJson: input.condition ?? null, enabled: true,
    });
    return { rule: { id: idToString(id), name: input.name, trigger: input.trigger, delta } };
  },

  async update_scoring_rule(input, { orgId }) {
    const id = uuid(input.ruleId);
    if (!id) return { error: 'ruleId inválido' };
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.delta !== undefined) set.delta = input.delta;
    if (input.condition !== undefined) set.conditionJson = input.condition;
    if (input.enabled !== undefined) set.enabled = input.enabled;
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(scoringRules).set(set as any)
      .where(and(eq(scoringRules.id, id), eq(scoringRules.orgId, orgId)));
    return { ok: true };
  },

  async delete_scoring_rule(input, { orgId }) {
    const id = uuid(input.ruleId);
    if (!id) return { error: 'ruleId inválido' };
    await db.delete(scoringRules).where(and(eq(scoringRules.id, id), eq(scoringRules.orgId, orgId)));
    return { ok: true };
  },

  // ─── FALSA IA: AUTOMATIONS ────────────────────────────────────
  async list_automations(_, { orgId }) {
    const rows = await db.select().from(automations)
      .where(eq(automations.orgId, orgId)).orderBy(asc(automations.name));
    return { automations: rows.map((a) => ({
      id: idToString(a.id), name: a.name, description: a.description,
      trigger: a.trigger, condition: a.conditionJson, actions: a.actionsJson,
      enabled: a.enabled, runs: a.runsCount, lastRunAt: a.lastRunAt,
    })) };
  },

  async create_automation(input, { orgId }) {
    if (!RULE_TRIGGERS.includes(input.trigger)) return { error: `trigger inválido. Debe ser uno de: ${RULE_TRIGGERS.join(', ')}` };
    if (!Array.isArray(input.actions) || !input.actions.length) return { error: 'actions debe ser array con al menos 1 elemento' };
    const id = newId();
    await db.insert(automations).values({
      id, orgId, name: input.name, description: input.description ?? null,
      trigger: input.trigger, conditionJson: input.condition ?? null,
      actionsJson: input.actions, enabled: true,
    });
    return { automation: { id: idToString(id), name: input.name, trigger: input.trigger, actionsCount: input.actions.length } };
  },

  async update_automation(input, { orgId }) {
    const id = uuid(input.automationId);
    if (!id) return { error: 'automationId inválido' };
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.description !== undefined) set.description = input.description ?? null;
    if (input.condition !== undefined) set.conditionJson = input.condition;
    if (input.actions !== undefined) {
      if (!Array.isArray(input.actions) || !input.actions.length) return { error: 'actions debe ser array no vacío' };
      set.actionsJson = input.actions;
    }
    if (input.enabled !== undefined) set.enabled = input.enabled;
    if (!Object.keys(set).length) return { ok: true, unchanged: true };
    await db.update(automations).set(set as any)
      .where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
    return { ok: true };
  },

  async delete_automation(input, { orgId }) {
    const id = uuid(input.automationId);
    if (!id) return { error: 'automationId inválido' };
    await db.delete(automations).where(and(eq(automations.id, id), eq(automations.orgId, orgId)));
    return { ok: true };
  },

  // ─── FALSA IA: EMAIL TEMPLATES ────────────────────────────────
  async list_email_templates(_, { orgId }) {
    const rows = await db.select().from(emailTemplates)
      .where(eq(emailTemplates.orgId, orgId)).orderBy(asc(emailTemplates.name));
    return { templates: rows.map((t) => ({
      id: idToString(t.id), name: t.name, subject: t.subject,
      bodyPreview: t.body.slice(0, 150), category: t.category,
    })) };
  },

  async create_email_template(input, { orgId }) {
    const id = newId();
    await db.insert(emailTemplates).values({
      id, orgId, name: input.name, subject: input.subject, body: input.body,
      category: input.category || 'custom',
    });
    return { template: { id: idToString(id), name: input.name } };
  },

  async render_email_template(input, { orgId, userId }) {
    const id = uuid(input.templateId);
    if (!id) return { error: 'templateId inválido' };
    const [tpl] = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.orgId, orgId))).limit(1);
    if (!tpl) return { error: 'Plantilla no encontrada' };

    const vars: Record<string, string> = { userName: '', firstName: '', lastName: '', email: '', companyName: '', dealTitle: '', dealAmount: '' };

    // Cargar contact si pasaron contactId
    const contactBuf = uuid(input.contactId);
    if (contactBuf) {
      const [c] = await db.select({
        firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email,
        companyId: contacts.companyId,
      }).from(contacts).where(and(eq(contacts.id, contactBuf), eq(contacts.orgId, orgId), isNull(contacts.deletedAt))).limit(1);
      if (c) {
        vars.firstName = c.firstName || '';
        vars.lastName = c.lastName || '';
        vars.email = c.email || '';
        if (c.companyId) {
          const [co] = await db.select({ name: companies.name }).from(companies)
            .where(and(eq(companies.id, c.companyId), eq(companies.orgId, orgId))).limit(1);
          vars.companyName = co?.name || '';
        }
      }
    }

    // Cargar deal si pasaron dealId
    const dealBuf = uuid(input.dealId);
    if (dealBuf) {
      const [d] = await db.select({ title: deals.title, amount: deals.amount, currency: deals.currency, contactId: deals.contactId, companyId: deals.companyId })
        .from(deals).where(and(eq(deals.id, dealBuf), eq(deals.orgId, orgId), isNull(deals.deletedAt))).limit(1);
      if (d) {
        vars.dealTitle = d.title;
        vars.dealAmount = `${d.amount} ${d.currency}`;
        // Si no había contact y el deal tiene uno, usarlo de fallback
        if (!contactBuf && d.contactId) {
          const [c] = await db.select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.email })
            .from(contacts).where(eq(contacts.id, d.contactId)).limit(1);
          if (c) { vars.firstName = c.firstName; vars.lastName = c.lastName || ''; vars.email = c.email || ''; }
        }
        if (d.companyId) {
          const [co] = await db.select({ name: companies.name }).from(companies)
            .where(eq(companies.id, d.companyId)).limit(1);
          vars.companyName = co?.name || vars.companyName;
        }
      }
    }

    // userName del usuario actual (chat)
    // (no traemos del DB para no agregar query; usamos el ID corto como hint)
    vars.userName = 'tu equipo';

    const render = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
    return {
      template: { id: input.templateId, name: tpl.name, category: tpl.category },
      rendered: { subject: render(tpl.subject), body: render(tpl.body) },
      placeholders: vars,
    };
  },

  // ─── IA GENERATIVA (consume cuota mensual) ────────────────────
  async generate_email_draft(input, { orgId, userId, tier }) {
    const q = await checkQuota(orgId, userId, tier);
    if (!q.allowed) return { error: q.reason || 'Cuota IA agotada', quota: q };
    const llm = await resolveLlmProvider(orgId);
    if (!llm) return { error: 'Sin API key de IA configurada (Anthropic u OpenRouter). Pedile al admin que la asigne.' };
    const contactId = uuid(input.contactId);
    if (!contactId) return { error: 'contactId inválido' };
    const dealId = uuid(input.dealId) || null;
    try {
      const r = await generateEmailDraft({
        provider: llm.provider, apiKey: llm.key, orgId, contactId, dealId,
        brief: input.brief, tone: input.tone || 'directo',
      });
      await recordUsage({
        orgId, userId, feature: 'email_draft', model: r.model,
        inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        entityType: 'contact', entityId: contactId,
      });
      return { subject: r.subject, body: r.body, provider: r.provider, tokens: { in: r.inputTokens, out: r.outputTokens } };
    } catch (e: any) { return { error: e?.message || 'Error generando email' }; }
  },

  async generate_deal_summary(input, { orgId, userId, tier }) {
    const q = await checkQuota(orgId, userId, tier);
    if (!q.allowed) return { error: q.reason || 'Cuota IA agotada', quota: q };
    const llm = await resolveLlmProvider(orgId);
    if (!llm) return { error: 'Sin API key de IA configurada (Anthropic u OpenRouter).' };
    const dealId = uuid(input.dealId);
    if (!dealId) return { error: 'dealId inválido' };
    try {
      const r = await generateDealSummary({ provider: llm.provider, apiKey: llm.key, orgId, dealId });
      await recordUsage({
        orgId, userId, feature: 'deal_summary', model: r.model,
        inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        entityType: 'deal', entityId: dealId,
      });
      return { summary: r.summary, provider: r.provider, tokens: { in: r.inputTokens, out: r.outputTokens } };
    } catch (e: any) { return { error: e?.message || 'Error generando resumen' }; }
  },

  // ─── RAG SIMPLE ───────────────────────────────────────────────
  async search_history(input, { orgId }) {
    const q = String(input.query || '').trim();
    if (!q) return { results: [] };

    // 1) Notas que contengan el query
    const notesRows = await db.select({
      id: notes.id, body: notes.body, entityType: notes.entityType, entityId: notes.entityId,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(eq(notes.orgId, orgId), like(notes.body, `%${q}%`)))
    .orderBy(desc(notes.createdAt))
    .limit(8);

    // 2) Activities cuyo verb O payload contengan el query
    const activitiesRows = await db.select({
      verb: activities.verb, entityType: activities.entityType, entityId: activities.entityId,
      payload: activities.payload, createdAt: activities.createdAt,
    })
    .from(activities)
    .where(and(eq(activities.orgId, orgId), like(activities.verb, `%${q}%`)))
    .orderBy(desc(activities.createdAt))
    .limit(5);

    return {
      query: q,
      notes: notesRows.map((n) => ({
        type: 'note', entityType: n.entityType, entityId: idToString(n.entityId),
        excerpt: n.body.slice(0, 300), at: n.createdAt,
      })),
      activities: activitiesRows.map((a) => ({
        type: 'activity', entityType: a.entityType, entityId: idToString(a.entityId),
        verb: a.verb, at: a.createdAt,
      })),
      hint: notesRows.length === 0 && activitiesRows.length === 0
        ? 'Sin resultados. Probá con otra palabra clave.'
        : `${notesRows.length} nota(s), ${activitiesRows.length} evento(s).`,
    };
  },

  async suggest_next_action(input, { orgId, userId, tier }) {
    const q = await checkQuota(orgId, userId, tier);
    if (!q.allowed) return { error: q.reason || 'Cuota IA agotada', quota: q };
    const llm = await resolveLlmProvider(orgId);
    if (!llm) return { error: 'Sin API key de IA configurada (Anthropic u OpenRouter).' };
    const contactId = uuid(input.contactId);
    if (!contactId) return { error: 'contactId inválido' };
    try {
      const r = await generateNextAction({ provider: llm.provider, apiKey: llm.key, orgId, contactId });
      await recordUsage({
        orgId, userId, feature: 'suggest_action', model: r.model,
        inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        entityType: 'contact', entityId: contactId,
      });
      return { suggestion: r.suggestion, provider: r.provider, tokens: { in: r.inputTokens, out: r.outputTokens } };
    } catch (e: any) { return { error: e?.message || 'Error sugiriendo acción' }; }
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
