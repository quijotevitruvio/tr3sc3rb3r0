// Evaluador de condiciones para reglas de scoring y automatizaciones.
// El DSL es JSON simple: todos los campos son AND. Sin OR explícito (se modela con varias reglas).
// Campos soportados (todos opcionales):
//   amountMin, amountMax       — comparación numérica sobre payload.amount
//   stageName                  — payload.stageName del deal
//   tagName, tagIs             — payload.tagName / payload.tagIs (igualdad)
//   status                     — payload.status (open|won|lost)
//   currency                   — payload.currency
//   sourceContains             — substring en payload.source
//   verbIs                     — verb exacto (útil para deal_updated con field changes)

export interface ConditionInput {
  amount?: number;
  stageName?: string;
  tagName?: string;
  status?: string;
  currency?: string;
  source?: string;
  verb?: string;
}

export function matchesCondition(cond: any, input: ConditionInput): boolean {
  if (!cond || typeof cond !== 'object') return true; // sin condición = match siempre

  if (cond.amountMin !== undefined) {
    if (input.amount === undefined || input.amount < cond.amountMin) return false;
  }
  if (cond.amountMax !== undefined) {
    if (input.amount === undefined || input.amount > cond.amountMax) return false;
  }
  if (cond.stageName !== undefined && input.stageName !== cond.stageName) return false;
  if (cond.tagName !== undefined && input.tagName !== cond.tagName) return false;
  if (cond.tagIs !== undefined && input.tagName !== cond.tagIs) return false;
  if (cond.status !== undefined && input.status !== cond.status) return false;
  if (cond.currency !== undefined && input.currency !== cond.currency) return false;
  if (cond.sourceContains !== undefined) {
    if (!input.source || !input.source.toLowerCase().includes(String(cond.sourceContains).toLowerCase())) return false;
  }
  if (cond.verbIs !== undefined && input.verb !== cond.verbIs) return false;

  return true;
}
