// Validación Zod para inputs del CRM. Reutilizado por endpoints.
import { z } from 'zod';

const uuid = z.string().uuid('UUID inválido');
const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

// ─── COMPANIES ───────────────────────────────────────────────────
export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(200),
  website: optStr(255),
  industry: optStr(100),
  sizeBucket: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
  country: z.string().length(2).optional().or(z.literal('').transform(() => undefined)),
  city: optStr(100),
  notesShort: optStr(2000),
});

export const companyUpdateSchema = companyCreateSchema.partial();

// ─── CONTACTS ────────────────────────────────────────────────────
export const contactCreateSchema = z.object({
  firstName: z.string().trim().min(1, 'Nombre requerido').max(100),
  lastName: optStr(100),
  email: z.string().trim().email('Email inválido').max(255).optional().or(z.literal('').transform(() => undefined)),
  phone: optStr(30),
  jobTitle: optStr(100),
  source: optStr(80),
  companyId: uuid.optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

// ─── PIPELINES & STAGES ──────────────────────────────────────────
export const pipelineCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nombre requerido').max(100),
});

export const stageCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  position: z.number().int().min(0).max(99),
  winProbability: z.number().int().min(0).max(100).default(50),
});

export const stageUpdateSchema = stageCreateSchema.partial();

export const stagesReorderSchema = z.object({
  order: z.array(uuid).min(1, 'Lista de stages vacía'),
});

// ─── DEALS ───────────────────────────────────────────────────────
export const dealCreateSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(200),
  pipelineId: uuid,
  stageId: uuid,
  contactId: uuid.optional(),
  companyId: uuid.optional(),
  assignedTo: uuid.optional(), // userId; null = sin dueño
  amount: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('COP'),
  expectedCloseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD').optional(),
});

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  stageId: uuid.optional(),
});

export const dealMoveStageSchema = z.object({
  stageId: uuid,
});

export const dealCloseSchema = z.object({
  outcome: z.enum(['won', 'lost']),
  lostReason: optStr(200),
});

// ─── NOTES (polimórficas) ────────────────────────────────────────
export const noteCreateSchema = z.object({
  entityType: z.enum(['contact', 'company', 'deal']),
  entityId: uuid,
  body: z.string().trim().min(1, 'Texto requerido').max(10_000),
});

// ─── TASKS ───────────────────────────────────────────────────────
export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, 'Título requerido').max(200),
  description: optStr(2000),
  dueAt: z.string().datetime({ offset: true }).optional(), // ISO 8601 con timezone
  assignedTo: uuid.optional(),
  entityType: z.enum(['contact', 'company', 'deal', 'none']).default('none'),
  entityId: uuid.optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();
