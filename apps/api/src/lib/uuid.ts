// UUID v7 (sortable temporal) ↔ Buffer BINARY(16) helpers.
// v7 expone timestamp en los primeros 48 bits, ventaja sobre v4 para index locality.
import { v7 as uuidv7, parse as parseUuid, stringify as stringifyUuid } from 'uuid';

export function newId(): Buffer {
  return Buffer.from(parseUuid(uuidv7()));
}

export function idToString(b: Buffer | Uint8Array): string {
  return stringifyUuid(b);
}

export function idFromString(s: string): Buffer {
  return Buffer.from(parseUuid(s));
}

// SHA256 hex (para hashear session tokens, codes de verificación, etc.)
import { createHash, randomBytes } from 'node:crypto';

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
