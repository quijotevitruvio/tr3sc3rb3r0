// Drizzle schema PostgreSQL. IDs BYTEA(16) UUID v7. Soft-delete con deleted_at donde aplique.
// Multi-tenancy: org_id obligatorio en toda tabla de negocio (no aplica todavía a auth/users).
import {
  pgTable,
  pgEnum,
  varchar,
  char,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  date,
  index,
  uniqueIndex,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const now = () => sql`now()`;

// Tipo custom para bytea(16) que mapea a Buffer en JS/TS
const binaryUuid = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  fromDriver(value: unknown): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value as any);
  },
  toDriver(value: Buffer): Buffer {
    return value;
  },
});

// ═══════════════════════════════════════════════════════════════════
// ENUMS Postgres. Cada pgEnum crea un TYPE → nombres únicos obligatorios.
// ═══════════════════════════════════════════════════════════════════
export const tierEnum = pgEnum('tier', ['demo', 'basico', 'pro', 'max']);
export const orgMemberRoleEnum = pgEnum('org_member_role', ['admin_org', 'user_org']);
export const sizeBucketEnum = pgEnum('size_bucket', ['1-10', '11-50', '51-200', '201-1000', '1000+']);
export const dealStatusEnum = pgEnum('deal_status', ['open', 'won', 'lost']);
export const noteEntityTypeEnum = pgEnum('note_entity_type', ['contact', 'company', 'deal']);
export const taskEntityTypeEnum = pgEnum('task_entity_type', ['contact', 'company', 'deal', 'none']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'done']);
export const activityActorKindEnum = pgEnum('activity_actor_kind', ['user', 'system', 'ai']);
export const activityEntityTypeEnum = pgEnum('activity_entity_type', ['contact', 'company', 'deal', 'task', 'note', 'pipeline']);
export const tagCategoryEnum = pgEnum('tag_category', ['interest', 'behavior', 'segment', 'custom']);
export const entityTagEntityTypeEnum = pgEnum('entity_tag_entity_type', ['contact', 'company', 'deal']);
export const entityLinkFromTypeEnum = pgEnum('entity_link_from_type', ['contact', 'company', 'deal']);
export const entityLinkToTypeEnum = pgEnum('entity_link_to_type', ['contact', 'company', 'deal']);
export const entityLinkRelationKindEnum = pgEnum('entity_link_relation_kind', ['mentions', 'related_to', 'reports_to', 'partners_with', 'custom']);
export const entityLinkSourceEnum = pgEnum('entity_link_source', ['note_parser', 'manual', 'ai']);
export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'tool', 'system']);
export const orgApiKeyProviderEnum = pgEnum('org_api_key_provider', ['anthropic', 'openai', 'gemini', 'openrouter']);
export const emailTemplateCategoryEnum = pgEnum('email_template_category', ['welcome', 'follow_up', 'proposal', 'reminder', 'custom']);
export const channelKindEnum = pgEnum('channel_kind', ['whatsapp', 'web', 'instagram', 'messenger', 'telegram']);
export const channelStatusEnum = pgEnum('channel_status', ['active', 'paused']);
export const conversationStatusEnum = pgEnum('conversation_status', ['bot', 'open', 'pending', 'closed']);
export const messageDirectionEnum = pgEnum('message_direction', ['in', 'out']);
export const messageSenderKindEnum = pgEnum('message_sender_kind', ['contact', 'bot', 'agent', 'system']);
export const messageTypeEnum = pgEnum('message_type', [
  'text', 'image', 'audio', 'video', 'document', 'interactive', 'template', 'location', 'system',
]);
export const messageStatusEnum = pgEnum('message_status', ['received', 'sent', 'delivered', 'read', 'failed']);

export const users = pgTable(
  'users',
  {
    id: binaryUuid('id').primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    displayName: varchar('display_name', { length: 100 }),
    isSuperadmin: boolean('is_superadmin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    emailIdx: index('idx_users_email').on(t.email),
  }),
);

// Token de sesión: el cliente recibe un token random base64url en cookie httpOnly.
// En DB guardamos SHA256(token) en sessions.id → si DB se filtra, los tokens no son utilizables.
export const sessions = pgTable(
  'sessions',
  {
    id: char('id', { length: 64 }).primaryKey(), // SHA256 hex del token
    userId: binaryUuid('user_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ipHash: char('ip_hash', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    userIdx: index('idx_sessions_user').on(t.userId),
    expiresIdx: index('idx_sessions_expires').on(t.expiresAt),
  }),
);

export const organizations = pgTable('organizations', {
  id: binaryUuid('id').primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  tier: tierEnum('tier').notNull().default('basico'),
  tierExpiresAt: timestamp('tier_expires_at', { withTimezone: true, mode: 'date' }),
  demoOnly: boolean('demo_only').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
});

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: binaryUuid('org_id').notNull(),
    userId: binaryUuid('user_id').notNull(),
    role: orgMemberRoleEnum('role').notNull().default('admin_org'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
    userIdx: index('idx_org_members_user').on(t.userId),
  }),
);

// Email verification (Turn 2 lo usa; schema listo desde ya).
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: binaryUuid('id').primaryKey(),
    userId: binaryUuid('user_id').notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    userIdx: index('idx_email_verif_user').on(t.userId),
  }),
);

export const passwordResets = pgTable('password_resets', {
  id: binaryUuid('id').primaryKey(),
  userId: binaryUuid('user_id').notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
});

// ═══════════════════════════════════════════════════════════════════
// CRM — Fase 2. Multi-tenancy estricto: org_id en TODO.
// ═══════════════════════════════════════════════════════════════════

// Companies (empresas B2B). Un contact puede tener company o no.
export const companies = pgTable(
  'companies',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    website: varchar('website', { length: 255 }),
    industry: varchar('industry', { length: 100 }),
    sizeBucket: sizeBucketEnum('size_bucket'),
    country: char('country', { length: 2 }), // ISO-3166 alpha-2; default 'CO' al insertar desde UI
    city: varchar('city', { length: 100 }),
    notesShort: text('notes_short'),
    custom: jsonb('custom'), // reservado para custom fields (Fase 5+)
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_companies_org').on(t.orgId),
    nameIdx: index('idx_companies_name').on(t.name),
  }),
);

// Contacts (personas). Email único por org, no global.
export const contacts = pgTable(
  'contacts',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    companyId: binaryUuid('company_id'), // nullable: contact suelto sin empresa
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 30 }),
    jobTitle: varchar('job_title', { length: 100 }),
    source: varchar('source', { length: 80 }), // ej. "Web form", "Cold call", "Referido"
    score: integer('score').notNull().default(0), // lead scoring (Fase 4 lo llena)
    custom: jsonb('custom'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_contacts_org').on(t.orgId),
    companyIdx: index('idx_contacts_company').on(t.companyId),
    // Email único por org (no global) — permite mismo CEO en orgs distintas
    orgEmailUq: uniqueIndex('uq_contacts_org_email').on(t.orgId, t.email),
  }),
);

// Pipelines configurables. Cuota por tier: 1 Básico, 5 Pro, ilimitado Max (control en endpoint).
export const pipelines = pgTable(
  'pipelines',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_pipelines_org').on(t.orgId),
  }),
);

// Stages ordenadas dentro de un pipeline. Ej: Lead → Calificado → Propuesta → Cierre.
export const stages = pgTable(
  'stages',
  {
    id: binaryUuid('id').primaryKey(),
    pipelineId: binaryUuid('pipeline_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    position: integer('position').notNull(), // orden visual en el kanban
    winProbability: integer('win_probability').notNull().default(50), // 0..100, para forecast
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    pipelineIdx: index('idx_stages_pipeline').on(t.pipelineId),
  }),
);

// Deals — el corazón del CRM. Monto en COP por default.
export const deals = pgTable(
  'deals',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    pipelineId: binaryUuid('pipeline_id').notNull(),
    stageId: binaryUuid('stage_id').notNull(),
    contactId: binaryUuid('contact_id'), // contacto principal del deal
    companyId: binaryUuid('company_id'), // denormalizado para queries rápidos
    assignedTo: binaryUuid('assigned_to'), // user_id del responsable
    title: varchar('title', { length: 200 }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
    currency: char('currency', { length: 3 }).notNull().default('COP'),
    status: dealStatusEnum('status').notNull().default('open'),
    expectedCloseDate: date('expected_close_date', { mode: 'string' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    lostReason: varchar('lost_reason', { length: 200 }),
    custom: jsonb('custom'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_deals_org').on(t.orgId),
    pipelineIdx: index('idx_deals_pipeline').on(t.pipelineId),
    stageIdx: index('idx_deals_stage').on(t.stageId),
    contactIdx: index('idx_deals_contact').on(t.contactId),
    assignedIdx: index('idx_deals_assigned').on(t.assignedTo),
    statusIdx: index('idx_deals_status').on(t.status),
  }),
);

// Notes polimórficas: pueden colgar de contact, company o deal.
// Sin FK por la polimorfía; validación de entity_id en código.
export const notes = pgTable(
  'notes',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    authorId: binaryUuid('author_id').notNull(), // user que escribió
    entityType: noteEntityTypeEnum('entity_type').notNull(),
    entityId: binaryUuid('entity_id').notNull(),
    body: text('body').notNull(),
    isAiGenerated: boolean('is_ai_generated').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('idx_notes_org').on(t.orgId),
    entityIdx: index('idx_notes_entity').on(t.entityType, t.entityId),
  }),
);

// Tasks con due date. También polimórficas.
export const tasks = pgTable(
  'tasks',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    createdBy: binaryUuid('created_by').notNull(),
    assignedTo: binaryUuid('assigned_to'),
    entityType: taskEntityTypeEnum('entity_type').notNull().default('none'),
    entityId: binaryUuid('entity_id'),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }),
    status: taskStatusEnum('status').notNull().default('todo'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('idx_tasks_org').on(t.orgId),
    assignedIdx: index('idx_tasks_assigned').on(t.assignedTo),
    dueIdx: index('idx_tasks_due').on(t.dueAt),
    statusIdx: index('idx_tasks_status').on(t.status),
  }),
);

// Activities — log inmutable. Generado automáticamente desde endpoints.
// "Andrés movió Deal X de Calificación a Propuesta a las 10:32".
export const activities = pgTable(
  'activities',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    actorId: binaryUuid('actor_id'), // null si el actor es el sistema (automatización, IA)
    actorKind: activityActorKindEnum('actor_kind').notNull().default('user'),
    entityType: activityEntityTypeEnum('entity_type').notNull(),
    entityId: binaryUuid('entity_id').notNull(),
    verb: varchar('verb', { length: 50 }).notNull(), // ej. 'created', 'updated', 'moved', 'won', 'lost'
    payload: jsonb('payload'), // datos extra (from_stage, to_stage, old_amount, new_amount, etc.)
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    orgIdx: index('idx_activities_org').on(t.orgId),
    entityIdx: index('idx_activities_entity').on(t.entityType, t.entityId),
    createdIdx: index('idx_activities_created').on(t.createdAt),
  }),
);

// ═══════════════════════════════════════════════════════════════════
// KNOWLEDGE GRAPH — Fase 2.5. Tags + relaciones polimórficas + parser de notas.
// ═══════════════════════════════════════════════════════════════════

// Tags: etiquetas semánticas (intereses, comportamientos, segmentos).
// El parser de notas las crea automáticamente desde #hashtags.
export const tags = pgTable(
  'tags',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    category: tagCategoryEnum('category').notNull().default('custom'),
    color: char('color', { length: 7 }).notNull().default('#39ff14'), // hex con #
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    orgIdx: index('idx_tags_org').on(t.orgId),
    // Mismo nombre dentro de una org = mismo tag.
    orgNameUq: uniqueIndex('uq_tags_org_name').on(t.orgId, t.name),
  }),
);

// Many-to-many polimórfico: tag asignado a una entidad (contact/company/deal).
export const entityTags = pgTable(
  'entity_tags',
  {
    orgId: binaryUuid('org_id').notNull(),
    tagId: binaryUuid('tag_id').notNull(),
    entityType: entityTagEntityTypeEnum('entity_type').notNull(),
    entityId: binaryUuid('entity_id').notNull(),
    assignedBy: binaryUuid('assigned_by'), // userId; null si vino del parser de notas
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.tagId, t.entityType, t.entityId] }),
    entityIdx: index('idx_entity_tags_entity').on(t.entityType, t.entityId),
    tagIdx: index('idx_entity_tags_tag').on(t.tagId),
  }),
);

// Relaciones directas entre entidades (más allá de los FKs naturales).
// Captura [[wikilinks]] del parser de notas + relaciones manuales.
export const entityLinks = pgTable(
  'entity_links',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    fromType: entityLinkFromTypeEnum('from_type').notNull(),
    fromId: binaryUuid('from_id').notNull(),
    toType: entityLinkToTypeEnum('to_type').notNull(),
    toId: binaryUuid('to_id').notNull(),
    relationKind: entityLinkRelationKindEnum('relation_kind').notNull().default('related_to'),
    source: entityLinkSourceEnum('source').notNull().default('manual'),
    sourceNoteId: binaryUuid('source_note_id'), // si vino del parser, qué nota lo generó
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    orgIdx: index('idx_entity_links_org').on(t.orgId),
    fromIdx: index('idx_entity_links_from').on(t.fromType, t.fromId),
    toIdx: index('idx_entity_links_to').on(t.toType, t.toId),
    // Evitar duplicar mismo link.
    uq: uniqueIndex('uq_entity_links_dedup').on(t.orgId, t.fromType, t.fromId, t.toType, t.toId, t.relationKind),
  }),
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type PipelineRow = typeof pipelines.$inferSelect;
export type StageRow = typeof stages.$inferSelect;
export type DealRow = typeof deals.$inferSelect;
export type NoteRow = typeof notes.$inferSelect;
export type TaskRow = typeof tasks.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
// ═══════════════════════════════════════════════════════════════════
// CHAT IA — Fase 3. Conversaciones del usuario con el CRM via LLM.
// ═══════════════════════════════════════════════════════════════════

export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    userId: binaryUuid('user_id').notNull(),
    title: varchar('title', { length: 200 }), // auto-generado por LLM tras N mensajes
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    orgIdx: index('idx_chat_sessions_org').on(t.orgId),
    userIdx: index('idx_chat_sessions_user').on(t.userId),
    lastIdx: index('idx_chat_sessions_last').on(t.lastMessageAt),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: binaryUuid('id').primaryKey(),
    sessionId: binaryUuid('session_id').notNull(),
    orgId: binaryUuid('org_id').notNull(),
    role: chatMessageRoleEnum('role').notNull(),
    content: jsonb('content').notNull(), // contenido estructurado de Anthropic SDK
    toolName: varchar('tool_name', { length: 80 }),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    sessionIdx: index('idx_chat_messages_session').on(t.sessionId),
    orgIdx: index('idx_chat_messages_org').on(t.orgId),
  }),
);

export type TagRow = typeof tags.$inferSelect;
export type EntityTagRow = typeof entityTags.$inferSelect;
export type EntityLinkRow = typeof entityLinks.$inferSelect;
// ═══════════════════════════════════════════════════════════════════
// API KEYS por org — superadmin las configura para Demo/Básico/Pro.
// Max permite que el cliente las setee (mismo schema, distinto endpoint).
// ═══════════════════════════════════════════════════════════════════
export const orgApiKeys = pgTable(
  'org_api_keys',
  {
    orgId: binaryUuid('org_id').notNull(),
    provider: orgApiKeyProviderEnum('provider').notNull(),
    keyCiphertext: varchar('key_ciphertext', { length: 500 }).notNull(), // AES-256-GCM ciphertext en base64
    keyHint: varchar('key_hint', { length: 16 }), // últimos 4 chars para identificar visualmente
    priority: integer('priority').notNull().default(0), // orden de fallback en chat (menor = mayor prioridad)
    setBy: binaryUuid('set_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.provider] }),
  }),
);

// ═══════════════════════════════════════════════════════════════════
// FALSA IA — Fase 4. Reglas de scoring + automatizaciones + plantillas email.
// Sin LLM. Pure rules engine: event → match condition → apply delta/action.
// ═══════════════════════════════════════════════════════════════════

// Eventos que pueden disparar reglas o automatizaciones.
// Coinciden con los `verb` que logActivity inserta en `activities`.
export const RULE_TRIGGERS = [
  'contact_created', 'contact_updated', 'contact_deleted',
  'company_created', 'company_updated', 'company_deleted',
  'deal_created', 'deal_updated', 'deal_moved', 'deal_won', 'deal_lost', 'deal_reopened',
  'note_created',
  'task_created', 'task_completed',
  'tag_assigned',
] as const;
export type RuleTrigger = typeof RULE_TRIGGERS[number];

export const scoringRules = pgTable(
  'scoring_rules',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    trigger: varchar('trigger', { length: 50 }).notNull(), // RuleTrigger
    delta: integer('delta').notNull(), // puede ser negativo
    conditionJson: jsonb('condition_json'), // ej. { amountMin: 5000000, tagName: 'interesado' }
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('idx_scoring_rules_org').on(t.orgId),
    triggerIdx: index('idx_scoring_rules_trigger').on(t.trigger),
  }),
);

export const automations = pgTable(
  'automations',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    description: varchar('description', { length: 500 }),
    trigger: varchar('trigger', { length: 50 }).notNull(),
    conditionJson: jsonb('condition_json'),
    actionsJson: jsonb('actions_json').notNull(), // [{ type, ...params }, ...]
    enabled: boolean('enabled').notNull().default(true),
    runsCount: integer('runs_count').notNull().default(0),
    lastRunAt: timestamp('last_run_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('idx_automations_org').on(t.orgId),
    triggerIdx: index('idx_automations_trigger').on(t.trigger),
  }),
);

export const emailTemplates = pgTable(
  'email_templates',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    subject: varchar('subject', { length: 300 }).notNull(),
    body: text('body').notNull(),
    category: emailTemplateCategoryEnum('category').notNull().default('custom'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    orgIdx: index('idx_email_templates_org').on(t.orgId),
  }),
);

export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type OrgApiKeyRow = typeof orgApiKeys.$inferSelect;
// ═══════════════════════════════════════════════════════════════════
// IA GENERATIVA — Fase 5. Tracking de uso de tokens + cuotas por tier.
// Una fila por cada llamada IA (no batch). Permite calcular consumo por user/mes.
// ═══════════════════════════════════════════════════════════════════
export const iaUsage = pgTable(
  'ia_usage',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    userId: binaryUuid('user_id').notNull(),
    feature: varchar('feature', { length: 60 }).notNull(), // 'email_draft' | 'deal_summary' | 'suggest_action' | 'export_md_ai'
    model: varchar('model', { length: 80 }).notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costMicrosUsd: integer('cost_micros_usd').notNull().default(0), // millonésimas de USD (precisión sin float)
    entityType: varchar('entity_type', { length: 20 }), // contexto (contact/company/deal/note/etc)
    entityId: binaryUuid('entity_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    orgIdx: index('idx_ia_usage_org').on(t.orgId),
    userIdx: index('idx_ia_usage_user').on(t.userId),
    createdIdx: index('idx_ia_usage_created').on(t.createdAt),
  }),
);

export type ScoringRuleRow = typeof scoringRules.$inferSelect;
export type AutomationRow = typeof automations.$inferSelect;
export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
// ═══════════════════════════════════════════════════════════════════
// DEMO PÚBLICO — Fase 6. Sesiones temporales de prueba con consent Habeas Data.
// Estrategia Opción B (decidida con Andrés): los datos cargados en demo se quedan
// con Tr3sC3rb3r0 como lead intelligence + training de producto.
// ═══════════════════════════════════════════════════════════════════
export const demoSessions = pgTable(
  'demo_sessions',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(), // la org demo_only=true que se crea
    userId: binaryUuid('user_id').notNull(), // pseudo-user de la sesión
    ipHash: char('ip_hash', { length: 64 }).notNull(),
    userAgent: varchar('user_agent', { length: 255 }),
    fingerprint: varchar('fingerprint', { length: 128 }), // ip+ua hash en MVP, podría sumar FingerprintJS futuro
    consentedAt: timestamp('consented_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    consentText: text('consent_text').notNull(), // snapshot exacto del texto mostrado al consentir
    contactEmail: varchar('contact_email', { length: 255 }), // si el user lo proveyó para follow-up
    contactName: varchar('contact_name', { length: 150 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }), // solicitud de supresión (Habeas Data art. 8)
  },
  (t) => ({
    fingerprintIdx: index('idx_demo_sessions_fingerprint').on(t.fingerprint),
    ipIdx: index('idx_demo_sessions_ip').on(t.ipHash),
    expiresIdx: index('idx_demo_sessions_expires').on(t.expiresAt),
  }),
);

export type IaUsageRow = typeof iaUsage.$inferSelect;
export type DemoSessionRow = typeof demoSessions.$inferSelect;

// ════════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — Inbox omnicanal (canal de entrada). Soporta el motor "Fake IA"
// (src/modules/bot) y el handoff al Live Chat (Módulo 2). Multi-tenant por org_id.
// ════════════════════════════════════════════════════════════════════════════

// Un canal conectado: número de WhatsApp, widget web, IG, etc. El flow_json es
// el árbol del bot "Fake IA", editable sin deploy. Los secretos (tokens) NO van
// acá en claro: se guardan cifrados aparte (reusar lib/crypto, como org_api_keys).
export const channels = pgTable(
  'channels',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    kind: channelKindEnum('kind').notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    externalId: varchar('external_id', { length: 120 }), // WhatsApp phone_number_id / WABA id
    config: jsonb('config'), // settings no sensibles (display number, idioma, horario)
    flowJson: jsonb('flow_json'), // árbol del bot "Fake IA" (tier Start)
    status: channelStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_channels_org').on(t.orgId),
    // un canal por (org, tipo, identificador externo) — evita duplicar el mismo número
    extUq: uniqueIndex('uq_channels_kind_external').on(t.orgId, t.kind, t.externalId),
  }),
);

// Un hilo con un usuario final en un canal. `botState` persiste el estado del
// motor entre mensajes (nodeId/vars/misses). `status`: bot → open (handoff) → closed.
export const conversations = pgTable(
  'conversations',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    channelId: binaryUuid('channel_id').notNull(),
    contactId: binaryUuid('contact_id'), // se llena cuando el bot captura el lead
    externalId: varchar('external_id', { length: 120 }).notNull(), // wa_id (teléfono del usuario)
    displayName: varchar('display_name', { length: 150 }), // nombre del perfil de WhatsApp
    status: conversationStatusEnum('status').notNull().default('bot'),
    assignedTo: binaryUuid('assigned_to'), // agente humano (Módulo 2) cuando hay handoff
    botState: jsonb('bot_state'), // BotState serializado (motor Fake IA)
    unread: integer('unread').notNull().default(0),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().default(now()).$onUpdate(() => new Date()),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    orgIdx: index('idx_conversations_org').on(t.orgId),
    channelExtIdx: index('idx_conversations_channel_ext').on(t.channelId, t.externalId), // find-or-create activo
    statusIdx: index('idx_conversations_status').on(t.orgId, t.status),
    assignedIdx: index('idx_conversations_assigned').on(t.assignedTo),
  }),
);

// Mensajes individuales. `waMessageId` UNIQUE = idempotencia: Meta reintenta el
// webhook y NO debemos duplicar. `direction` in/out, `senderKind` quién lo envió.
export const messages = pgTable(
  'messages',
  {
    id: binaryUuid('id').primaryKey(),
    orgId: binaryUuid('org_id').notNull(),
    conversationId: binaryUuid('conversation_id').notNull(),
    direction: messageDirectionEnum('direction').notNull(),
    senderKind: messageSenderKindEnum('sender_kind').notNull(),
    senderId: binaryUuid('sender_id'), // user_id del agente cuando senderKind='agent'
    waMessageId: varchar('wa_message_id', { length: 128 }), // id de WhatsApp → dedupe
    type: messageTypeEnum('type').notNull().default('text'),
    body: text('body'), // texto plano (o transcripción de voz en Enterprise)
    payload: jsonb('payload'), // crudo/extra: botones, refs de media, selección interactiva
    status: messageStatusEnum('status').notNull().default('received'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().default(now()),
  },
  (t) => ({
    convIdx: index('idx_messages_conversation').on(t.conversationId),
    orgIdx: index('idx_messages_org').on(t.orgId),
    // idempotencia del webhook entrante (NULL permitido para mensajes salientes propios)
    waUq: uniqueIndex('uq_messages_wa_id').on(t.waMessageId),
  }),
);

export type ChannelRow = typeof channels.$inferSelect;
export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
