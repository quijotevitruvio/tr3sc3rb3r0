// Migration runner oficial de drizzle. Maneja --> statement-breakpoint y journal automáticamente.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env.js';

// Cliente dedicado al migrador: max:1 (una sola conexión, sin pooling).
const migrationClient = postgres(env.DATABASE_URL, { max: 1, prepare: false });
const db = drizzle(migrationClient);

await migrate(db, { migrationsFolder: './src/db/migrations' });
console.log('[migrate] done.');
await migrationClient.end();
