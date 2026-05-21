// Cliente LLM unificado para generators (sin tool calling).
// Soporta Anthropic directo + OpenRouter (vía OpenAI SDK con baseURL custom).
// Para tool calling completo, ver chat/routes.ts (Anthropic-only por ahora).
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { orgApiKeys } from '../../db/schema.js';
import { decryptSecret } from '../../lib/crypto.js';
import { env } from '../../config/env.js';

export type LlmProvider = 'anthropic' | 'openrouter';

// Modelo "canónico" Haiku-equivalente por proveedor.
// Permite que el caller no se preocupe del modelo exacto si solo quiere "el rápido y barato".
const DEFAULT_MODEL: Record<LlmProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openrouter: 'anthropic/claude-haiku-4-5', // OpenRouter routea al mismo modelo
};

export interface LlmCallInput {
  system: string;
  user: string;
  maxTokens?: number;
  modelOverride?: string;
}

export interface LlmCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: LlmProvider;
  model: string;
}

// Resuelve qué provider usar para una org. Prioridad explícita:
// 1) Anthropic key de la org
// 2) OpenRouter key de la org
// 3) ANTHROPIC_API_KEY del env (fallback global)
// Devuelve null si no hay ninguna.
export async function resolveLlmProvider(orgId: Buffer): Promise<{ provider: LlmProvider; key: string } | null> {
  const rows = await db
    .select({ provider: orgApiKeys.provider, ciphertext: orgApiKeys.keyCiphertext, priority: orgApiKeys.priority })
    .from(orgApiKeys)
    .where(eq(orgApiKeys.orgId, orgId))
    .orderBy(asc(orgApiKeys.priority));

  // Filtrar a providers que soportamos para generators (anthropic + openrouter).
  for (const row of rows) {
    if (row.provider !== 'anthropic' && row.provider !== 'openrouter') continue;
    try {
      const key = decryptSecret(row.ciphertext);
      return { provider: row.provider as LlmProvider, key };
    } catch {
      // Cifrado roto, seguir al siguiente
    }
  }

  // Fallback global
  if (env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', key: env.ANTHROPIC_API_KEY };
  }
  return null;
}

export async function callLlm(provider: LlmProvider, apiKey: string, input: LlmCallInput): Promise<LlmCallResult> {
  const model = input.modelOverride || DEFAULT_MODEL[provider];
  const maxTokens = input.maxTokens ?? 800;

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
    });
    const text = resp.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    return {
      text,
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      provider,
      model,
    };
  }

  if (provider === 'openrouter') {
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        // Recomendado por OpenRouter para attribution.
        'HTTP-Referer': 'https://trescerbero.com',
        'X-Title': 'L-IA CRM',
      },
    });
    const resp = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    });
    const text = resp.choices[0]?.message?.content?.trim() ?? '';
    return {
      text,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
      provider,
      model,
    };
  }

  throw new Error(`Provider no soportado para generators: ${provider}`);
}
