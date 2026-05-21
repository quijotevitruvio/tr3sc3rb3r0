// Seed de 6 reglas de scoring + 2 automations + 2 templates al crear una org nueva.
// Andrés decidió que toda org arranca con valor inmediato, no con la pantalla vacía.
import { scoringRules, automations, emailTemplates } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';

const DEFAULT_RULES = [
  { name: 'Deal ganado', trigger: 'deal_won', delta: 25, conditionJson: null },
  { name: 'Deal perdido', trigger: 'deal_lost', delta: -10, conditionJson: null },
  { name: 'Deal creado', trigger: 'deal_created', delta: 5, conditionJson: null },
  { name: 'Deal alto valor (>5M COP)', trigger: 'deal_created', delta: 10, conditionJson: { amountMin: 5000000 } },
  { name: 'Nota agregada', trigger: 'note_created', delta: 3, conditionJson: null },
  { name: 'Tag asignado', trigger: 'tag_assigned', delta: 2, conditionJson: null },
];

const DEFAULT_AUTOMATIONS = [
  {
    name: 'Follow-up al crear deal grande',
    description: 'Crea una task de seguimiento cuando se crea un deal de más de 5M COP',
    trigger: 'deal_created',
    conditionJson: { amountMin: 5000000 },
    actionsJson: [
      { type: 'create_task', title: 'Llamar al cliente del deal grande', dueOffsetDays: 1, attachToSource: true },
      { type: 'add_tag', tagName: 'deal-grande' },
    ],
  },
  {
    name: 'Marcar contacto nuevo',
    description: 'Auto-tagea como "nuevo" a todo contacto recién creado',
    trigger: 'contact_created',
    conditionJson: null,
    actionsJson: [
      { type: 'add_tag', tagName: 'nuevo' },
    ],
  },
];

const DEFAULT_TEMPLATES = [
  {
    name: 'Bienvenida a nuevo contacto',
    subject: 'Hola {{firstName}}, gracias por tu interés',
    body: 'Hola {{firstName}},\n\nGracias por contactarnos desde {{companyName}}. Quería confirmarte que ya estamos revisando tu solicitud.\n\nEn las próximas 24h te llegará una propuesta más concreta.\n\nSaludos,\n{{userName}}',
    category: 'welcome' as const,
  },
  {
    name: 'Seguimiento sin respuesta',
    subject: 'Re: {{dealTitle}} — ¿seguimos?',
    body: 'Hola {{firstName}},\n\nQuería retomar la conversación sobre {{dealTitle}}. ¿Tenés 15 minutos esta semana para una llamada rápida?\n\nQuedo atento,\n{{userName}}',
    category: 'follow_up' as const,
  },
];

export async function bootstrapDefaultEngine(tx: any, orgId: Buffer) {
  for (const r of DEFAULT_RULES) {
    await tx.insert(scoringRules).values({ id: newId(), orgId, ...r });
  }
  for (const a of DEFAULT_AUTOMATIONS) {
    await tx.insert(automations).values({ id: newId(), orgId, ...a });
  }
  for (const t of DEFAULT_TEMPLATES) {
    await tx.insert(emailTemplates).values({ id: newId(), orgId, ...t });
  }
}
