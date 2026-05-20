// Cifrado simétrico para secretos en DB (API keys de proveedores LLM).
// Usa AES-256-GCM con master key derivada de ENCRYPTION_KEY (env).
// Si la DB se filtra sin la master key, los secretos siguen seguros.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '../config/env.js';

// Derivamos la key de 32 bytes desde env. ENCRYPTION_KEY debe tener ≥32 chars
// (sha256 normaliza al tamaño correcto sin importar el largo).
function getMasterKey(): Buffer {
  const raw = env.ENCRYPTION_KEY || 'dev-only-CAMBIAR-EN-PROD-32-chars';
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12); // 96 bits para GCM
  const cipher = createCipheriv('aes-256-gcm', getMasterKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Formato: iv|tag|ciphertext, todo en base64url
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function decryptSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, 'base64url');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getMasterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Devuelve los últimos 4 chars para mostrar como "hint" en UI sin exponer el secreto.
export function maskKeyHint(plaintext: string): string {
  if (plaintext.length <= 4) return '****';
  return `…${plaintext.slice(-4)}`;
}
