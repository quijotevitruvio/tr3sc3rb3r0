// ───────────────────────────────────────────────────────────────────────────
// Runner — orquesta UN mensaje entrante de cualquier canal.
//
// Flujo: dedupe (idempotencia) → persistir entrante → (si la conversación está
// en modo bot) correr engine.step() → ejecutar acciones (lead/tag/handoff) →
// persistir estado + responder → persistir saliente.
//
// Usa PORTS (interfaces) para DB, CRM y canal. Así el orquestador se testea con
// fakes en memoria, sin DB ni API de Meta. La implementación real (Drizzle +
// WhatsApp Cloud API) implementa estas interfaces aparte.
// ───────────────────────────────────────────────────────────────────────────

import type { Flow, BotState, BotButton } from './engine.js';
import { step, initState } from './engine.js';

// ── Mensaje entrante ya normalizado (el adaptador de canal lo produce) ────────
export interface InboundMessage {
  channelId: string;
  orgId: string;
  from: string; // id del usuario en el canal (wa_id / teléfono)
  displayName?: string;
  waMessageId: string; // id del proveedor → idempotencia
  text?: string;
  buttonId?: string;
}

// Vista mínima de conversación que el runner necesita.
export interface ConversationLite {
  id: string;
  status: 'bot' | 'open' | 'pending' | 'closed';
  botState: BotState | null;
}

// ── PORTS ─────────────────────────────────────────────────────────────────────
export interface ConversationRepo {
  /** Idempotencia: ¿ya vimos este id de mensaje del proveedor? */
  messageExists(waMessageId: string): Promise<boolean>;
  /** Busca la conversación activa (no cerrada) del usuario en el canal. */
  findActive(channelId: string, from: string): Promise<ConversationLite | null>;
  /** Crea una conversación nueva en estado 'bot'. */
  createConversation(msg: InboundMessage): Promise<ConversationLite>;
  saveInbound(conversationId: string, msg: InboundMessage): Promise<void>;
  saveOutbound(
    conversationId: string,
    reply: { text: string; buttons?: BotButton[] },
    waMessageId: string | undefined,
    senderKind: 'bot' | 'system',
  ): Promise<void>;
  updateBotState(conversationId: string, state: BotState): Promise<void>;
  setStatus(conversationId: string, status: ConversationLite['status']): Promise<void>;
}

export interface CrmPort {
  /** Crea contacto (y opcionalmente deal) desde las vars capturadas por el bot. */
  createLead(conversationId: string, vars: Record<string, string>): Promise<void>;
  addTag(conversationId: string, tag: string): Promise<void>;
}

export interface ChannelSender {
  /** Envía el mensaje saliente. Devuelve el id del proveedor si lo hay. */
  sendText(
    channelId: string,
    to: string,
    text: string,
    buttons?: BotButton[],
  ): Promise<{ waMessageId?: string }>;
}

export interface FlowProvider {
  /** El árbol "Fake IA" del canal (columna flow_json). null = sin bot → handoff directo. */
  getFlow(channelId: string): Promise<Flow | null>;
}

export interface RunnerDeps {
  repo: ConversationRepo;
  crm: CrmPort;
  channel: ChannelSender;
  flows: FlowProvider;
}

export interface RunnerResult {
  handled: boolean; // false = duplicado ignorado
  handoff: boolean; // true = pasó (o ya estaba) a humano
  conversationId?: string;
}

/**
 * Procesa un mensaje entrante de punta a punta. Idempotente y seguro:
 * cualquier rama termina en un estado consistente (peor caso: handoff).
 */
export async function handleInbound(msg: InboundMessage, deps: RunnerDeps): Promise<RunnerResult> {
  // 1) Idempotencia — Meta reintenta el webhook; no duplicamos.
  if (await deps.repo.messageExists(msg.waMessageId)) {
    return { handled: false, handoff: false };
  }

  // 2) Conversación activa o nueva.
  let conv = await deps.repo.findActive(msg.channelId, msg.from);
  if (!conv) conv = await deps.repo.createConversation(msg);

  // 3) Persistir el entrante.
  await deps.repo.saveInbound(conv.id, msg);

  // 4) Si ya la atiende un humano (o no hay flujo), el bot no interviene.
  const flow = await deps.flows.getFlow(msg.channelId);
  if (conv.status !== 'bot' || !flow) {
    return { handled: true, handoff: conv.status !== 'bot', conversationId: conv.id };
  }

  // 5) Correr el motor determinista.
  const state: BotState = conv.botState ?? initState(flow);
  const result = step(flow, state, { text: msg.text, buttonId: msg.buttonId });

  // 6) Ejecutar las acciones que pide el motor (side-effects contra el CRM/inbox).
  for (const action of result.actions) {
    switch (action.type) {
      case 'create_lead':
        await deps.crm.createLead(conv.id, result.state.vars);
        break;
      case 'tag':
        await deps.crm.addTag(conv.id, action.tag);
        break;
      case 'handoff':
        await deps.repo.setStatus(conv.id, 'open');
        break;
      // 'capture' | 'show_catalog' | 'schedule' → no requieren acción del runner
      default:
        break;
    }
  }

  // 7) Persistir estado del bot + responder + persistir el saliente.
  await deps.repo.updateBotState(conv.id, result.state);
  const sent = await deps.channel.sendText(msg.channelId, msg.from, result.reply.text, result.reply.buttons);
  await deps.repo.saveOutbound(conv.id, result.reply, sent.waMessageId, result.handoff ? 'system' : 'bot');

  return { handled: true, handoff: result.handoff, conversationId: conv.id };
}
