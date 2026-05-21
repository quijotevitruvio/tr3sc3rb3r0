// Funciones de IA generativa multi-proveedor (Anthropic + OpenRouter).
// El caller pasa { provider, apiKey } resuelto vía resolveLlmProvider.
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { contacts, companies, deals, notes, stages, activities } from '../../db/schema.js';
import { callLlm, type LlmProvider } from './llm-client.js';

interface GenInput {
  provider: LlmProvider;
  apiKey: string;
  orgId: Buffer;
}

interface GenResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: LlmProvider;
}

// ─── EMAIL DRAFT ──────────────────────────────────────────────
export async function generateEmailDraft(input: GenInput & {
  contactId: Buffer;
  dealId?: Buffer | null;
  brief: string;
  tone?: 'formal' | 'casual' | 'directo';
}): Promise<GenResult & { subject: string; body: string }> {
  const [contact] = await db.select().from(contacts)
    .where(and(eq(contacts.id, input.contactId), eq(contacts.orgId, input.orgId), isNull(contacts.deletedAt))).limit(1);
  if (!contact) throw new Error('Contacto no encontrado');

  let company: any = null;
  if (contact.companyId) {
    const [c] = await db.select().from(companies)
      .where(and(eq(companies.id, contact.companyId), eq(companies.orgId, input.orgId))).limit(1);
    company = c;
  }

  let deal: any = null;
  if (input.dealId) {
    const [d] = await db.select().from(deals)
      .where(and(eq(deals.id, input.dealId), eq(deals.orgId, input.orgId))).limit(1);
    deal = d;
  }

  const tone = input.tone ?? 'directo';
  const context = [
    `Destinatario: ${contact.firstName} ${contact.lastName ?? ''}${contact.jobTitle ? ` (${contact.jobTitle})` : ''}`,
    company ? `Empresa: ${company.name}${company.industry ? ` - ${company.industry}` : ''}` : '',
    deal ? `Deal en curso: "${deal.title}" por ${deal.amount} ${deal.currency} (status: ${deal.status})` : '',
    `Tono pedido: ${tone}`,
    '',
    `Intención del email: ${input.brief}`,
  ].filter(Boolean).join('\n');

  const r = await callLlm(input.provider, input.apiKey, {
    system: 'Sos un asistente comercial. Escribís emails breves y efectivos en español rioplatense (tuteo/voseo). Devolvés EXACTAMENTE este formato:\n\nASUNTO: <una línea>\n---\n<cuerpo del email, máximo 200 palabras>',
    user: context,
    maxTokens: 800,
  });

  const [subjectLine, ...rest] = r.text.split('---');
  const subject = subjectLine.replace(/^ASUNTO:\s*/i, '').trim();
  const body = rest.join('---').trim();

  return { ...r, subject, body };
}

// ─── DEAL SUMMARY ─────────────────────────────────────────────
export async function generateDealSummary(input: GenInput & {
  dealId: Buffer;
}): Promise<GenResult & { summary: string }> {
  const [deal] = await db.select().from(deals)
    .where(and(eq(deals.id, input.dealId), eq(deals.orgId, input.orgId), isNull(deals.deletedAt))).limit(1);
  if (!deal) throw new Error('Deal no encontrado');

  const [stage] = deal.stageId ? await db.select({ name: stages.name }).from(stages).where(eq(stages.id, deal.stageId)).limit(1) : [null];
  const dealContact = deal.contactId ? (await db.select().from(contacts).where(eq(contacts.id, deal.contactId)).limit(1))[0] : null;
  const dealCompany = deal.companyId ? (await db.select().from(companies).where(eq(companies.id, deal.companyId)).limit(1))[0] : null;

  const dealNotes = await db.select({ body: notes.body, createdAt: notes.createdAt }).from(notes)
    .where(and(eq(notes.orgId, input.orgId), eq(notes.entityType, 'deal'), eq(notes.entityId, input.dealId)))
    .orderBy(desc(notes.createdAt)).limit(20);

  const dealActivity = await db.select({ verb: activities.verb, payload: activities.payload, createdAt: activities.createdAt }).from(activities)
    .where(and(eq(activities.orgId, input.orgId), eq(activities.entityType, 'deal'), eq(activities.entityId, input.dealId)))
    .orderBy(desc(activities.createdAt)).limit(30);

  const context = [
    `Deal: "${deal.title}"`,
    `Monto: ${deal.amount} ${deal.currency}`,
    `Status: ${deal.status}${deal.lostReason ? ` (razón: ${deal.lostReason})` : ''}`,
    stage ? `Stage actual: ${stage.name}` : '',
    dealContact ? `Contacto: ${dealContact.firstName} ${dealContact.lastName ?? ''}` : '',
    dealCompany ? `Empresa: ${dealCompany.name}` : '',
    deal.expectedCloseDate ? `Cierre esperado: ${deal.expectedCloseDate}` : '',
    '',
    `Notas (${dealNotes.length}):`,
    dealNotes.map((n) => `- ${n.body.slice(0, 200)}`).join('\n') || '(sin notas)',
    '',
    `Eventos (${dealActivity.length}):`,
    dealActivity.map((a) => `- ${a.verb}`).join(', '),
  ].filter(Boolean).join('\n');

  const r = await callLlm(input.provider, input.apiKey, {
    system: 'Resumís deals comerciales de CRM en máximo 150 palabras. Estructura: ¿Qué pasó? ¿Por qué se ganó/perdió o dónde está trabado? ¿Qué hacer ahora? Español rioplatense, claro y directo.',
    user: context,
    maxTokens: 600,
  });

  return { ...r, summary: r.text };
}

// ─── NEXT BEST ACTION ─────────────────────────────────────────
export async function generateNextAction(input: GenInput & {
  contactId: Buffer;
}): Promise<GenResult & { suggestion: string }> {
  const [contact] = await db.select().from(contacts)
    .where(and(eq(contacts.id, input.contactId), eq(contacts.orgId, input.orgId), isNull(contacts.deletedAt))).limit(1);
  if (!contact) throw new Error('Contacto no encontrado');

  const company = contact.companyId ? (await db.select().from(companies).where(eq(companies.id, contact.companyId)).limit(1))[0] : null;

  const contactDeals = await db.select().from(deals)
    .where(and(eq(deals.orgId, input.orgId), eq(deals.contactId, input.contactId), isNull(deals.deletedAt)))
    .orderBy(desc(deals.createdAt)).limit(10);

  const contactNotes = await db.select({ body: notes.body, createdAt: notes.createdAt }).from(notes)
    .where(and(eq(notes.orgId, input.orgId), eq(notes.entityType, 'contact'), eq(notes.entityId, input.contactId)))
    .orderBy(desc(notes.createdAt)).limit(10);

  const context = [
    `Contacto: ${contact.firstName} ${contact.lastName ?? ''}`,
    `Cargo: ${contact.jobTitle ?? '—'}`,
    `Score actual: ${contact.score}`,
    `Source: ${contact.source ?? '—'}`,
    company ? `Empresa: ${company.name} (${company.industry ?? 'industria sin def'}, ${company.sizeBucket ?? 'tamaño sin def'})` : '',
    '',
    `Deals (${contactDeals.length}):`,
    contactDeals.map((d) => `- "${d.title}" ${d.amount} ${d.currency} (${d.status})`).join('\n') || '(sin deals)',
    '',
    `Notas recientes:`,
    contactNotes.slice(0, 5).map((n) => `- ${n.body.slice(0, 150)}`).join('\n') || '(sin notas)',
  ].filter(Boolean).join('\n');

  const r = await callLlm(input.provider, input.apiKey, {
    system: 'Sos un coach de ventas. Dado un contacto y su historial, sugerís 1 sola acción concreta a tomar AHORA. Máximo 80 palabras. Formato: "ACCIÓN: <qué hacer>. POR QUÉ: <razón en 1 línea>." Español rioplatense, directo.',
    user: context,
    maxTokens: 400,
  });

  return { ...r, suggestion: r.text };
}
