// Zod schemas para endpoints auth.
// Reglas password: 8+ chars, al menos 1 letra y 1 número (sin forzar especiales — UX > teatro).
import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(200, 'Máximo 200 caracteres.')
  .regex(/[A-Za-z]/, 'Debe incluir al menos una letra.')
  .regex(/[0-9]/, 'Debe incluir al menos un número.');

export const registerSchema = z.object({
  email: z.string().email('Email inválido.').max(255).toLowerCase().trim(),
  password,
  displayName: z.string().min(1).max(100).trim().optional(),
  orgName: z.string().min(2, 'Nombre de la organización muy corto.').max(150).trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido.').max(255).toLowerCase().trim(),
  password: z.string().min(1).max(200),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// Slug helper desde nombre de org.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
