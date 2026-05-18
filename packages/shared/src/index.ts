// @tr3sc3rb3r0/shared
// Tipos y constantes compartidas entre frontend (apps/web) y backend (apps/api).
// Cuando crezca, separar por dominio: services.ts, plans.ts, schemas.ts, etc.

export const SERVICES = ['chat_ia', 'crm', 'software', 'seo', 'smm', 'bundle'] as const;
export type Service = typeof SERVICES[number];

export const PLAN_TIERS = ['start', 'pro', 'custom'] as const;
export type PlanTier = typeof PLAN_TIERS[number];

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'lost'] as const;
export type LeadStatus = typeof LEAD_STATUSES[number];

export const DEAL_STAGES = ['discovery', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type DealStage = typeof DEAL_STAGES[number];

// Plan pricing snapshot — alineado con apps/web/public/index.html
// Cuando migremos a Astro, esto será la fuente única de verdad para precios.
export const PLAN_PRICES_USD: Record<Service, Partial<Record<PlanTier, number>>> = {
  chat_ia:  { start: 50,  pro: 200, custom: 0 },
  crm:      { start: 80,  pro: 400, custom: 0 },
  software: { start: 50,  pro: 200, custom: 600 },
  seo:      { start: 80,  pro: 250, custom: 0 },
  smm:      { start: 250, pro: 600, custom: 0 },
  bundle:   { custom: 0 },
};

export const WA_NUMBER = '573003000958';
export const DOMAIN = 'trescerbero.com';
