// Migration runner vanilla. Lee SQL files de ./migrations en orden alfabético,
// los aplica si no están en schema_migrations. Idempotente.
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function appliedSet(): Promise<Set<string>> {
  const [rows] = await pool.query<any[]>('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureMigrationsTable();
  const applied = await appliedSet();
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  for (const f of files) {
    if (applied.has(f)) {
      console.log(`[migrate] skip ${f} (ya aplicado)`);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf8');
    console.log(`[migrate] aplicando ${f}…`);
    // Splittear por ; respetando que el archivo no tenga procedures complejos.
    const stmts = sql
      .split(/;\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));
    for (const stmt of stmts) {
      await pool.query(stmt);
    }
    await pool.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f]);
    console.log(`[migrate] ✓ ${f}`);
  }
  console.log('[migrate] done.');
  await pool.end();
}

run().catch((err) => {
  console.error('[migrate] FAIL', err);
  process.exit(1);
});
