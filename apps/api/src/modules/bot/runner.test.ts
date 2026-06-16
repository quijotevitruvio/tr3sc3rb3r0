// Tests del runner con PORTS fake en memoria — sin DB, sin Meta.
// Correr:  npx tsx --test src/modules/bot/runner.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleInbound } from './runner.js';
import type {
  RunnerDeps,
  ConversationRepo,
  ConversationLite,
  InboundMessage,
} from './runner.js';
import { EXAMPLE_FLOW } from './flow.example.js';

// ── Fakes en memoria ──────────────────────────────────────────────────────────
function makeDeps() {
  const seenWaIds = new Set<string>();
  const convs = new Map<string, ConversationLite & { channelId: string; from: string }>();
  const log: string[] = [];
  let convSeq = 0;

  const repo: ConversationRepo = {
    async messageExists(id) {
      return seenWaIds.has(id);
    },
    async findActive(channelId, from) {
      for (const c of convs.values()) {
        if (c.channelId === channelId && c.from === from && c.status !== 'closed') return c;
      }
      return null;
    },
    async createConversation(msg) {
      const c = {
        id: `conv-${++convSeq}`,
        status: 'bot' as const,
        botState: null,
        channelId: msg.channelId,
        from: msg.from,
      };
      convs.set(c.id, c);
      log.push(`create:${c.id}`);
      return c;
    },
    async saveInbound(convId, msg) {
      seenWaIds.add(msg.waMessageId);
      log.push(`in:${convId}:${msg.text ?? msg.buttonId}`);
    },
    async saveOutbound(convId, reply, _waId, kind) {
      log.push(`out:${convId}:${kind}:${reply.text.slice(0, 12)}`);
    },
    async updateBotState(convId, state) {
      const c = convs.get(convId);
      if (c) c.botState = state;
      log.push(`state:${convId}:${state.nodeId}`);
    },
    async setStatus(convId, status) {
      const c = convs.get(convId);
      if (c) c.status = status;
      log.push(`status:${convId}:${status}`);
    },
  };

  const crmCalls: string[] = [];
  const channelSends: string[] = [];

  const deps: RunnerDeps = {
    repo,
    crm: {
      async createLead(convId) {
        crmCalls.push(`lead:${convId}`);
      },
      async addTag(convId, tag) {
        crmCalls.push(`tag:${convId}:${tag}`);
      },
    },
    channel: {
      async sendText(_ch, to, text) {
        channelSends.push(`${to}:${text.slice(0, 12)}`);
        return { waMessageId: `wamid-out-${channelSends.length}` };
      },
    },
    flows: {
      async getFlow() {
        return EXAMPLE_FLOW;
      },
    },
  };

  return { deps, convs, log, crmCalls, channelSends };
}

const base = (over: Partial<InboundMessage> = {}): InboundMessage => ({
  channelId: 'ch-1',
  orgId: 'org-1',
  from: '573001234567',
  waMessageId: 'wamid-1',
  ...over,
});

// ── Tests ─────────────────────────────────────────────────────────────────────
test('crea conversación, corre el bot y responde', async () => {
  const { deps, channelSends, log } = makeDeps();
  const r = await handleInbound(base({ buttonId: 'catalogo', waMessageId: 'w1' }), deps);
  assert.equal(r.handled, true);
  assert.equal(r.handoff, false);
  assert.equal(channelSends.length, 1); // respondió
  assert.ok(log.some((l) => l.startsWith('create:')));
  assert.ok(log.some((l) => l.startsWith('state:')));
});

test('idempotencia: mismo waMessageId no se procesa dos veces', async () => {
  const { deps, channelSends } = makeDeps();
  await handleInbound(base({ text: 'hola', waMessageId: 'dup' }), deps);
  const before = channelSends.length;
  const r2 = await handleInbound(base({ text: 'hola', waMessageId: 'dup' }), deps);
  assert.equal(r2.handled, false);
  assert.equal(channelSends.length, before); // no respondió de nuevo
});

test('captura nombre+teléfono y dispara create_lead en el CRM', async () => {
  const { deps, crmCalls } = makeDeps();
  await handleInbound(base({ buttonId: 'agendar', waMessageId: 'a1' }), deps);
  await handleInbound(base({ text: 'Andrés', waMessageId: 'a2' }), deps);
  const r = await handleInbound(base({ text: '3001234567', waMessageId: 'a3' }), deps);
  assert.equal(r.handled, true);
  assert.ok(crmCalls.some((c) => c.startsWith('lead:')), 'debió crear el lead');
});

test('pedir asesor pasa la conversación a humano (handoff)', async () => {
  const { deps, log } = makeDeps();
  const r = await handleInbound(base({ text: 'quiero un asesor humano', waMessageId: 'h1' }), deps);
  assert.equal(r.handoff, true);
  assert.ok(log.some((l) => l === `status:${r.conversationId}:open`));
});

test('si ya la atiende un humano, el bot no interviene', async () => {
  const { deps } = makeDeps();
  // primer mensaje crea la conversación y la dejamos en 'open' manualmente
  const first = await handleInbound(base({ text: 'hola', waMessageId: 'o1' }), deps);
  await deps.repo.setStatus(first.conversationId!, 'open');
  const r = await handleInbound(base({ text: 'sigo escribiendo', waMessageId: 'o2' }), deps);
  assert.equal(r.handled, true);
  assert.equal(r.handoff, true); // está en modo humano
});
