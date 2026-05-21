// Chat endpoint: orquesta la conversación con Claude Haiku + tool calling.
// Persiste sesiones y mensajes para historial + auditoría de uso de tokens.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, asc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../../db/client.js';
import { chatSessions, chatMessages } from '../../db/schema.js';
import { newId, idToString, idFromString } from '../../lib/uuid.js';
import { env } from '../../config/env.js';
import { authedOrg } from '../../middleware/org-context.js';
import { tryParseId } from '../crm/helpers.js';
import { TOOL_DEFINITIONS, runTool } from './tools.js';
import { resolveAnthropicKey } from './key-resolver.js';

export const chatRoutes = new Hono();
chatRoutes.use('*', ...authedOrg);

const MODEL_BY_NAME: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6', // Sonnet 4.6 — disponible solo para Max
};
const DEFAULT_MODEL = MODEL_BY_NAME.haiku;
// Max puede pedir Sonnet. Otros tiers se quedan en Haiku.
// Aumentamos límite de iteraciones para Max (agentes más complejos).
const MAX_TOOL_ITERATIONS_BY_TIER: Record<string, number> = {
  demo: 5, basico: 5, pro: 6, max: 12,
};

const SYSTEM_PROMPT = `Sos L-IA, el asistente del CRM L-IA CRM de Tr3sC3rb3r0. Hablás español rioplatense (tuteo/voseo informal pero profesional).
Tenés PARIDAD TOTAL con la UI: cualquier cosa que el usuario haría manualmente (crear/editar/borrar contactos, empresas, deals, notas, tareas, pipelines, stages, tags, conexiones del knowledge graph) la podés hacer vos por chat.

REGLAS:
- Cuando el usuario pida algo concreto, USÁ las tools. No inventes datos ni IDs.
- Si necesitás un ID y no lo tenés, buscá primero (search_contacts, search_companies, list_deals, list_pipelines, list_tags).
- Si una entidad referenciada no existe, ofrecé crearla. Ej. "creá deal con Acme" → si Acme no existe → ofrecer crear empresa + deal.
- Sé conciso. Tras ejecutar acciones, confirmá brevemente qué hiciste con nombre/monto/id corto.
- Para fechas usá ISO 8601 (ej. 2026-06-15T10:00:00.000Z para tasks con due time).
- Para tags asignados vía notas, usá add_note con #hashtag y [[entidades]] — el parser las crea automáticamente.
- Para conexiones manuales del knowledge graph (ej. "Juan reporta a María") usá create_entity_link.
- Si una tool devuelve {"error": "..."} explicá el error y proponé alternativa.
- NO podés enviar emails, llamar por teléfono, ni acceder a sistemas externos. Si te lo piden, decilo claro.
- Si el usuario pide overview, usá get_context primero.

EFICIENCIA: combiná tools en una sola respuesta cuando sea posible (ej. crear empresa + crear contacto vinculado + crear deal en un mismo turno).`;

const startSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
  // Modelo opcional: 'haiku' (default, todos los tiers) o 'sonnet' (solo Max).
  model: z.enum(['haiku', 'sonnet']).optional(),
});

// ─── LIST sessions del usuario ────────────────────────────────────
chatRoutes.get('/sessions', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const rows = await db
    .select({ id: chatSessions.id, title: chatSessions.title, lastMessageAt: chatSessions.lastMessageAt, createdAt: chatSessions.createdAt })
    .from(chatSessions)
    .where(and(eq(chatSessions.orgId, orgId), eq(chatSessions.userId, user.id)))
    .orderBy(desc(chatSessions.lastMessageAt))
    .limit(50);
  return c.json({ sessions: rows.map((r) => ({ ...r, id: idToString(r.id) })) });
});

// ─── GET messages de una session ─────────────────────────────────
chatRoutes.get('/sessions/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [session] = await db.select().from(chatSessions)
    .where(and(eq(chatSessions.id, id), eq(chatSessions.orgId, orgId))).limit(1);
  if (!session) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const messages = await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, id))
    .orderBy(asc(chatMessages.createdAt));

  return c.json({
    session: { ...session, id: idToString(session.id) },
    messages: messages.map((m) => ({
      ...m,
      id: idToString(m.id),
      sessionId: idToString(m.sessionId),
    })),
  });
});

// ─── POST /chat — envía un mensaje, devuelve respuesta + acciones ───
chatRoutes.post('/', zValidator('json', startSchema), async (c) => {
  const { orgId, tier } = c.get('org');
  const user = c.get('user')!;
  const { message, sessionId, model: requestedModel } = c.req.valid('json');

  // Resolver API key: primero la de la org (configurada por admin), después fallback global.
  const apiKey = await resolveAnthropicKey(orgId);
  if (!apiKey) {
    return c.json({
      error: {
        code: 'NO_API_KEY',
        message: 'Esta organización no tiene API key de Anthropic configurada. Pedí al admin que la asigne en el panel.',
      },
    }, 503);
  }

  // Resolver modelo: Sonnet solo para Max. Otros tiers ignoran el override.
  const modelKey = requestedModel === 'sonnet' && tier === 'max' ? 'sonnet' : 'haiku';
  const model = MODEL_BY_NAME[modelKey];
  const maxIterations = MAX_TOOL_ITERATIONS_BY_TIER[tier] ?? 5;

  // Resolver o crear session
  let sessionBuf: Buffer;
  if (sessionId) {
    sessionBuf = idFromString(sessionId);
    const [s] = await db.select({ id: chatSessions.id }).from(chatSessions)
      .where(and(eq(chatSessions.id, sessionBuf), eq(chatSessions.orgId, orgId), eq(chatSessions.userId, user.id))).limit(1);
    if (!s) return c.json({ error: { code: 'SESSION_NOT_FOUND' } }, 404);
  } else {
    sessionBuf = newId();
    await db.insert(chatSessions).values({ id: sessionBuf, orgId, userId: user.id });
  }

  // Cargar historial reciente (últimos 20 mensajes)
  const historyRows = await db.select().from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionBuf))
    .orderBy(asc(chatMessages.createdAt))
    .limit(40);

  // Reconstruir messages array para Anthropic (formato: { role, content })
  const conversationHistory: any[] = historyRows.map((m) => ({
    role: m.role === 'tool' ? 'user' : m.role, // tool_result va dentro de user en Anthropic format
    content: m.content,
  })).filter((m) => m.role === 'user' || m.role === 'assistant');

  // Append nuevo user message
  conversationHistory.push({ role: 'user', content: message });
  await db.insert(chatMessages).values({
    id: newId(), sessionId: sessionBuf, orgId, role: 'user',
    content: message, inputTokens: 0, outputTokens: 0,
  });

  const anthropic = new Anthropic({ apiKey: apiKey.key });
  const actions: any[] = [];
  let totalInput = 0, totalOutput = 0;
  let finalText = '';

  // Loop de tool calling: repetimos hasta que el modelo no pida más tools.
  for (let iter = 0; iter < maxIterations; iter++) {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: modelKey === 'sonnet' ? 2048 : 1024,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS as any,
      messages: conversationHistory,
    });

    totalInput += resp.usage.input_tokens;
    totalOutput += resp.usage.output_tokens;

    // Agregar respuesta del modelo al historial
    conversationHistory.push({ role: 'assistant', content: resp.content });

    // Persistir assistant message
    await db.insert(chatMessages).values({
      id: newId(), sessionId: sessionBuf, orgId, role: 'assistant',
      content: resp.content as any,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
    });

    // Si el modelo terminó (sin tool calls), salimos.
    if (resp.stop_reason === 'end_turn' || !resp.content.some((b: any) => b.type === 'tool_use')) {
      finalText = resp.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      break;
    }

    // Si hay tool_use, ejecutar todas las tools y devolver tool_result.
    const toolBlocks = resp.content.filter((b: any) => b.type === 'tool_use');
    const toolResults: any[] = [];
    for (const tb of toolBlocks) {
      const result = await runTool((tb as any).name, (tb as any).input, { orgId, userId: user.id, tier: c.get('org').tier });
      actions.push({ tool: (tb as any).name, input: (tb as any).input, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: (tb as any).id,
        content: JSON.stringify(result),
      });
      await db.insert(chatMessages).values({
        id: newId(), sessionId: sessionBuf, orgId, role: 'tool',
        content: { tool_use_id: (tb as any).id, name: (tb as any).name, input: (tb as any).input, result } as any,
        toolName: (tb as any).name,
        inputTokens: 0, outputTokens: 0,
      });
    }
    conversationHistory.push({ role: 'user', content: toolResults });
  }

  // Actualizar lastMessageAt
  await db.update(chatSessions).set({ lastMessageAt: new Date() }).where(eq(chatSessions.id, sessionBuf));

  return c.json({
    sessionId: idToString(sessionBuf),
    reply: finalText,
    actions,
    usage: { inputTokens: totalInput, outputTokens: totalOutput },
    model: modelKey,
    modelId: model,
  });
});
