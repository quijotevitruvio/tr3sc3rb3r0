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

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOOL_ITERATIONS = 6; // límite para evitar loops infinitos

const SYSTEM_PROMPT = `Sos el asistente de CRM de Tr3sC3rb3r0, en español rioplatense (tuteo/voseo informal pero profesional).
Tu trabajo es ayudar al usuario a manejar su CRM hablándole en lenguaje natural.

REGLAS:
- Siempre que el usuario pida hacer algo concreto (crear contacto, mover deal, buscar empresa, agregar nota), USÁ una tool. No inventes datos.
- Si necesitás info que no tenés (ej. el usuario dice "crear deal con Juan" pero no sabés qué Juan), primero usá search_contacts.
- Si una acción requiere algo que no existe (ej. asignar a una empresa que no está), proponé crearla primero.
- Sé conciso. Cuando ejecutes acciones, confirmá brevemente qué hiciste con datos clave (nombre, id, monto).
- Si el usuario pide un resumen general, usá get_context.
- Si una tool devuelve {"error": "..."} explicá el error al usuario y pediles aclaración o sugerí alternativa.
- NO INVENTES IDs ni UUIDs. Si necesitás un ID, búscalo primero.
- Para fechas, usá ISO 8601 (ej. 2026-06-15T10:00:00.000Z para tasks).
- NUNCA promesa de cosas que no podés hacer con tus tools (no enviás emails, no llamás por teléfono).`;

const startSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
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
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const { message, sessionId } = c.req.valid('json');

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
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
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
      const result = await runTool((tb as any).name, (tb as any).input, { orgId, userId: user.id });
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
  });
});
