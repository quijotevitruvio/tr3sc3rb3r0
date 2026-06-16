// ───────────────────────────────────────────────────────────────────────────
// Motor "Fake IA" conversacional — Módulo 1 (canal de entrada), tier Start.
//
// FILOSOFÍA: determinista, CERO tokens, CERO red, CERO DB. Es PURO: recibe
// (flow, estado, input) y devuelve (respuesta, nuevo estado, acciones). Las
// acciones (crear lead, handoff, agendar) NO las ejecuta el motor — las devuelve
// para que el caller (canal WhatsApp / worker) las aplique contra el CRM
// existente. Así el motor se cubre 100% con unit tests y nunca toca un LLM.
//
// El "flow" es un grafo serializable a JSONB (columna `flow_json`), editable
// sin deploy. Cuando una intención no matchea N veces, escala a humano (handoff).
// ───────────────────────────────────────────────────────────────────────────

import { bestKeywordScore, normalize } from './fuzzy.js';

// ── Acciones que el motor pide ejecutar al caller (side-effects) ──────────────
export type BotAction =
  | { type: 'capture'; key: string; value: string }                 // guardar dato del usuario
  | { type: 'create_lead' }                                         // → CRM: contacto/deal
  | { type: 'show_catalog'; ref?: string }                          // mostrar catálogo
  | { type: 'schedule' }                                            // iniciar agendamiento
  | { type: 'tag'; tag: string }                                    // etiquetar
  | { type: 'handoff'; reason: 'requested' | 'fallback' | 'flow' }; // pasar a humano (Módulo 2)

// ── Botones interactivos de WhatsApp ──────────────────────────────────────────
export interface BotButton {
  id: string;     // payload del botón (match exacto)
  title: string;  // texto visible (≤20 chars en WhatsApp)
}

// ── Una intención = forma de SALIR de un nodo ─────────────────────────────────
export interface Intent {
  id: string;
  /** Match exacto contra el id del botón presionado. */
  buttons?: string[];
  /** Palabras/frases para fuzzy match (tolera typos y tildes). */
  keywords?: string[];
  /** Regex cruda (source). Útil para teléfonos, cédulas, "#3", etc. */
  regex?: string;
  /** Nodo destino. */
  next: string;
  /** Acciones a ejecutar al tomar esta intención. */
  actions?: BotAction[];
  /** Si la intención captura texto libre, en qué var guardarlo. */
  captureAs?: string;
}

// ── Nodo del flujo ────────────────────────────────────────────────────────────
export interface FlowNode {
  id: string;
  /** Mensaje a enviar al entrar (soporta {{var}}). */
  say: string;
  /** Botones interactivos opcionales. */
  buttons?: BotButton[];
  /** Salidas posibles (se evalúan en orden). */
  intents?: Intent[];
  /** Qué hacer si nada matchea. */
  fallback?: { say?: string; next?: string };
  /** Nodo final de conversación. */
  terminal?: boolean;
}

export interface Flow {
  id: string;
  start: string;
  /** Umbral de aceptación fuzzy 0..1 (default 0.72). */
  threshold?: number;
  /** Misses consecutivos antes de escalar a humano (default 2). */
  maxMisses?: number;
  nodes: Record<string, FlowNode>;
}

// ── Estado de la conversación (serializable, va en la columna del mensaje) ─────
export interface BotState {
  nodeId: string;
  vars: Record<string, string>;
  misses: number;
}

// ── Entrada normalizada del usuario ───────────────────────────────────────────
export interface BotInput {
  /** Texto libre (de un mensaje de texto o transcripción). */
  text?: string;
  /** Id del botón interactivo presionado, si aplica. */
  buttonId?: string;
}

// ── Resultado de un paso ──────────────────────────────────────────────────────
export interface StepResult {
  reply: { text: string; buttons?: BotButton[] };
  state: BotState;
  actions: BotAction[];
  /** true si la conversación debe pasar a un humano (Módulo 2). */
  handoff: boolean;
  /** true si se llegó a un nodo terminal. */
  done: boolean;
}

const DEFAULT_THRESHOLD = 0.72;
const DEFAULT_MAX_MISSES = 2;

/** Estado inicial: arranca en el nodo `start` del flujo. */
export function initState(flow: Flow): BotState {
  return { nodeId: flow.start, vars: {}, misses: 0 };
}

/** Reemplaza {{var}} en un texto con los valores capturados. */
export function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? '');
}

/** ¿La intención matchea la entrada? Devuelve score 0..1 (0 = no matchea). */
function matchIntent(intent: Intent, input: BotInput, threshold: number): number {
  // 1) Botón exacto → match seguro.
  if (input.buttonId && intent.buttons?.includes(input.buttonId)) return 1;
  const text = input.text ?? '';
  if (!text.trim()) return 0;
  // 2) Regex (case-insensitive) → match seguro si dispara.
  if (intent.regex) {
    try {
      if (new RegExp(intent.regex, 'i').test(text)) return 1;
    } catch {
      /* regex inválida en el flow → se ignora, no rompe la conversación */
    }
  }
  // 3) Fuzzy por keywords → score, aceptado si supera el umbral.
  if (intent.keywords?.length) {
    const s = bestKeywordScore(text, intent.keywords);
    return s >= threshold ? s : 0;
  }
  return 0;
}

/**
 * Avanza UN paso. PURO: no muta el estado de entrada, devuelve uno nuevo.
 * - Si nada matchea: incrementa `misses`; al llegar a `maxMisses` → handoff.
 * - Las acciones de la intención (más un `create_lead`/`handoff` implícito) se
 *   devuelven para que el caller las ejecute.
 */
export function step(flow: Flow, state: BotState, input: BotInput): StepResult {
  const threshold = flow.threshold ?? DEFAULT_THRESHOLD;
  const maxMisses = flow.maxMisses ?? DEFAULT_MAX_MISSES;
  const node = flow.nodes[state.nodeId];

  // Estado corrupto / nodo inexistente → escala a humano en vez de romper.
  if (!node) {
    return {
      reply: { text: 'Te paso con un asesor.' },
      state: { ...state, misses: 0 },
      actions: [{ type: 'handoff', reason: 'flow' }],
      handoff: true,
      done: false,
    };
  }

  // Buscar la primera intención que matchee (orden = prioridad).
  let chosen: Intent | null = null;
  let bestScore = 0;
  for (const intent of node.intents ?? []) {
    const score = matchIntent(intent, input, threshold);
    if (score > bestScore) {
      bestScore = score;
      chosen = intent;
      if (score === 1) break; // match exacto: no hace falta seguir
    }
  }

  // ── No matcheó nada ──────────────────────────────────────────────────────
  if (!chosen) {
    const misses = state.misses + 1;
    if (misses >= maxMisses) {
      return {
        reply: { text: 'Dejame que te conecte con alguien del equipo 🙌' },
        state: { ...state, misses: 0 },
        actions: [{ type: 'handoff', reason: 'fallback' }],
        handoff: true,
        done: false,
      };
    }
    const fb = node.fallback;
    const nextId = fb?.next ?? node.id; // por defecto se queda en el mismo nodo
    const next = flow.nodes[nextId] ?? node;
    const text = fb?.say
      ? render(fb.say, state.vars)
      : render(next.say, state.vars);
    return {
      reply: { text, buttons: next.buttons },
      state: { nodeId: nextId, vars: state.vars, misses },
      actions: [],
      handoff: false,
      done: false,
    };
  }

  // ── Matcheó: aplicar captura + acciones + transición ─────────────────────
  const vars = { ...state.vars };
  const actions: BotAction[] = [];

  if (chosen.captureAs && input.text) {
    // Si la intención tiene regex, capturamos SOLO lo que matchea (grupo 1 o match
    // completo) — ej. "mi celu es 3001234567" → "3001234567". Si no, el texto entero.
    let value = input.text.trim();
    if (chosen.regex) {
      try {
        const m = input.text.match(new RegExp(chosen.regex, 'i'));
        if (m) value = (m[1] ?? m[0]).trim();
      } catch {
        /* regex inválida → se queda el texto completo */
      }
    }
    vars[chosen.captureAs] = value;
    actions.push({ type: 'capture', key: chosen.captureAs, value });
  }
  for (const a of chosen.actions ?? []) actions.push(a);

  const nextNode = flow.nodes[chosen.next];
  if (!nextNode) {
    // Destino inválido → handoff seguro.
    return {
      reply: { text: 'Te paso con un asesor.' },
      state: { nodeId: state.nodeId, vars, misses: 0 },
      actions: [...actions, { type: 'handoff', reason: 'flow' }],
      handoff: true,
      done: false,
    };
  }

  const handoff = actions.some((a) => a.type === 'handoff');
  return {
    reply: { text: render(nextNode.say, vars), buttons: nextNode.buttons },
    state: { nodeId: nextNode.id, vars, misses: 0 },
    actions,
    handoff,
    done: !!nextNode.terminal,
  };
}

/** Primer mensaje del bot (entra al nodo start). Útil al iniciar conversación. */
export function greeting(flow: Flow, state: BotState = initState(flow)): StepResult {
  const node = flow.nodes[flow.start];
  return {
    reply: { text: render(node.say, state.vars), buttons: node.buttons },
    state,
    actions: [],
    handoff: false,
    done: !!node.terminal,
  };
}
