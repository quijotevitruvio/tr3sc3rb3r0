// Datos de muestra que se inyectan en cada org demo nueva.
// Objetivo: que el usuario vea el CRM "lleno" desde el primer click — no la pantalla vacía.
// Los nombres son ficticios pero realistas para el mercado colombiano B2B.
import { eq, asc } from 'drizzle-orm';
import { companies, contacts, deals, pipelines, stages, notes } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';

const COMPANY_NAMES = [
  { name: 'Acme Colombia SAS', industry: 'Tech', sizeBucket: '51-200' as const, country: 'CO', city: 'Bogotá', website: 'acme.co' },
  { name: 'Beta Solutions', industry: 'Consultoría', sizeBucket: '11-50' as const, country: 'CO', city: 'Medellín', website: 'beta-solutions.co' },
  { name: 'Tienda La Quinta', industry: 'Retail', sizeBucket: '1-10' as const, country: 'CO', city: 'Cali', website: 'tiendalaquinta.com' },
];

const CONTACT_NAMES = [
  { firstName: 'María',  lastName: 'Lopez',     jobTitle: 'CEO',                  email: 'maria@acme.co',          phone: '+57 300 111 2222', source: 'Web form',  companyIdx: 0 },
  { firstName: 'Carlos', lastName: 'Rivas',     jobTitle: 'Director Comercial',   email: 'carlos@acme.co',         phone: '+57 301 333 4444', source: 'Referido',  companyIdx: 0 },
  { firstName: 'Lucía',  lastName: 'Fernandez', jobTitle: 'Marketing Manager',    email: 'lucia@beta-solutions.co', phone: '+57 310 555 6666', source: 'LinkedIn',  companyIdx: 1 },
  { firstName: 'Diego',  lastName: 'Quintero',  jobTitle: 'Dueño',                email: 'diego@tiendalaquinta.com', phone: '+57 315 777 8888', source: 'Cold call', companyIdx: 2 },
];

const DEAL_DATA = [
  { title: 'Acme Colombia · Plan Pro anual',     amount: 12_000_000, stageIdx: 0, contactIdx: 0, companyIdx: 0 },
  { title: 'Beta Solutions · Migración CRM',     amount:  5_000_000, stageIdx: 1, contactIdx: 2, companyIdx: 1 },
  { title: 'La Quinta · Demo y onboarding',      amount:  1_500_000, stageIdx: 0, contactIdx: 3, companyIdx: 2 },
];

const SAMPLE_NOTES = [
  { entityIdx: 0, kind: 'contact' as const, body: 'María tiene interés alto. Mencionó que están evaluando 3 herramientas — la nuestra, HubSpot y Pipedrive. Punto débil: el chat-first. #interesado #decision-maker' },
  { entityIdx: 0, kind: 'deal' as const, body: 'Llamada inicial OK. Próximos pasos: propuesta detallada antes del jueves. Mencionó [[Carlos Rivas]] como el técnico que evaluará la integración.' },
  { entityIdx: 1, kind: 'deal' as const, body: 'Beta ya tiene CRM viejo. Migración crítica de 8.000 contactos. Cuidado con la duplicación. #migración' },
];

export async function seedDemoData(tx: any, orgId: Buffer, userId: Buffer) {
  // Obtener pipeline default ya bootstrappeado (no lo creamos acá)
  const [pipe] = await tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.orgId, orgId))
    .orderBy(asc(pipelines.createdAt))
    .limit(1);
  if (!pipe) return; // pipeline aún no creado, raro pero seguro

  const stageRows = await tx
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(eq(stages.pipelineId, pipe.id))
    .orderBy(asc(stages.position));

  // Crear empresas
  const companyIds: Buffer[] = [];
  for (const c of COMPANY_NAMES) {
    const id = newId();
    await tx.insert(companies).values({ id, orgId, ...c });
    companyIds.push(id);
  }

  // Crear contactos
  const contactIds: Buffer[] = [];
  for (const c of CONTACT_NAMES) {
    const id = newId();
    await tx.insert(contacts).values({
      id, orgId,
      companyId: companyIds[c.companyIdx],
      firstName: c.firstName, lastName: c.lastName,
      email: c.email, phone: c.phone, jobTitle: c.jobTitle, source: c.source,
    });
    contactIds.push(id);
  }

  // Crear deals
  const dealIds: Buffer[] = [];
  for (const d of DEAL_DATA) {
    const id = newId();
    await tx.insert(deals).values({
      id, orgId,
      pipelineId: pipe.id,
      stageId: stageRows[d.stageIdx]?.id ?? stageRows[0].id,
      contactId: contactIds[d.contactIdx],
      companyId: companyIds[d.companyIdx],
      title: d.title,
      amount: String(d.amount),
      currency: 'COP',
    });
    dealIds.push(id);
  }

  // Crear notas (sample para mostrar el parser con #tags y [[wikilinks]])
  for (const n of SAMPLE_NOTES) {
    const entityId = n.kind === 'contact' ? contactIds[n.entityIdx] : dealIds[n.entityIdx];
    await tx.insert(notes).values({
      id: newId(), orgId, authorId: userId,
      entityType: n.kind, entityId, body: n.body, isAiGenerated: false,
    });
  }
}
