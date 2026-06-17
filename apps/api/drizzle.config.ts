// Config de drizzle-kit. Solo lo usa el CLI (generate, push, studio).
// El runtime no lo toca — eso vive en src/db/client.ts.
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
