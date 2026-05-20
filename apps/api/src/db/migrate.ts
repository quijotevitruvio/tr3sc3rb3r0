// Migration runner oficial de drizzle. Maneja --> statement-breakpoint y journal automáticamente.
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool } from './client.js';

await migrate(db, { migrationsFolder: './src/db/migrations' });
console.log('[migrate] done.');
await pool.end();
