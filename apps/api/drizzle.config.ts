// Config de drizzle-kit. Solo lo usa el CLI (generate, push, studio).
// El runtime no lo toca — eso vive en src/db/client.ts.
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'tr3sc3rb3r0_dev',
  },
  verbose: true,
  strict: true,
});
