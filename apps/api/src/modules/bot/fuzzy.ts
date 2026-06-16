// Fuzzy matching mínimo y SIN dependencias (no metemos thefuzz/fuse.js para
// mantener el motor "Fake IA" puro y portable). Suficiente para tipificar
// intenciones de WhatsApp: normaliza tildes/mayúsculas y compara por
// inclusión de tokens + ratio de Levenshtein.
//
// Determinista a propósito: mismas entradas → misma salida. Cero tokens, cero red.

/** Normaliza: minúsculas, sin tildes, sin signos, espacios colapsados. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ñ/g, 'n') // preserva la ñ como 'n' antes de descomponer
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita diacríticos combinantes (á→a, é→e…)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de Levenshtein clásica (iterativa, O(n*m)). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similitud 0..1 entre dos strings (1 = idénticos). */
export function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

/** Largo del prefijo común entre dos strings. */
function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  const m = Math.min(a.length, b.length);
  while (i < m && a[i] === b[i]) i++;
  return i;
}

/**
 * Puntúa dos TOKENS (palabras sueltas). 0..1.
 * - Igualdad exacta → 1.
 * - Misma raíz + longitud similar → 0.9 (conjugaciones es: agendo/agendar/agenda).
 *   Exige longitud parecida para NO confundir 'hora' con 'horarios'.
 * - Si no, ratio de Levenshtein (tolera typos).
 */
export function tokenScore(tok: string, kw: string): number {
  if (tok === kw) return 1;
  const p = commonPrefixLen(tok, kw);
  const shorter = Math.min(tok.length, kw.length);
  if (Math.abs(tok.length - kw.length) <= 2 && p >= 4 && p >= shorter - 1) return 0.9;
  return ratio(tok, kw);
}

/**
 * Puntúa cuánto matchea `input` contra un `keyword` (ya normalizados afuera).
 * Token-aware: promedio del mejor score por token del keyword. SIN substring
 * (evita que 'hora' matchee 'horarios'). Devuelve 0..1.
 */
export function scoreKeyword(inputNorm: string, keywordNorm: string): number {
  const inputTokens = inputNorm.split(' ').filter(Boolean);
  const kwTokens = keywordNorm.split(' ').filter(Boolean);
  if (!kwTokens.length || !inputTokens.length) return 0;
  let acc = 0;
  for (const kw of kwTokens) {
    let best = 0;
    for (const tok of inputTokens) {
      const s = tokenScore(tok, kw);
      if (s > best) best = s;
    }
    acc += best;
  }
  return acc / kwTokens.length;
}

/**
 * Mejor score de `input` contra una lista de keywords. Devuelve el máximo 0..1.
 * El umbral de aceptación lo decide el motor (no acá), para que sea ajustable.
 */
export function bestKeywordScore(input: string, keywords: string[]): number {
  const inputNorm = normalize(input);
  let best = 0;
  for (const kw of keywords) {
    const s = scoreKeyword(inputNorm, normalize(kw));
    if (s > best) best = s;
  }
  return best;
}
