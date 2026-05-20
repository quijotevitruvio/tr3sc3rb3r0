// Argon2id wrapper. Configurable por env para ajustar a recursos de Hostinger.
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { env } from '../config/env.js';

const opts = {
  algorithm: 2 as Algorithm,
  memoryCost: env.ARGON_MEMORY_KIB,
  timeCost: env.ARGON_ITERATIONS,
  parallelism: env.ARGON_PARALLELISM,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, opts);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain, opts);
  } catch {
    return false;
  }
}
