import postgres from 'postgres';
const common = { user: process.env.PGUSER, password: process.env.PGPASSWORD, database: 'postgres', prepare: false, ssl: 'require', connect_timeout: 10 };
async function tryConn(label, opts) {
  const sql = postgres({ ...common, ...opts });
  try {
    const r = await sql`select count(*)::int as orgs from organizations`;
    console.log(`OK [${label}] → orgs=${r[0].orgs}`);
    return true;
  } catch (e) {
    console.error(`FAIL [${label}] → ${e.code || ''} ${e.message}`);
    return false;
  } finally { await sql.end({ timeout: 5 }); }
}
const ok = await tryConn('pooler', { host: process.env.POOLER_HOST, port: 6543, user: process.env.POOLER_USER });
if (!ok) await tryConn('direct', { host: process.env.DIRECT_HOST, port: 5432, user: 'postgres' });
