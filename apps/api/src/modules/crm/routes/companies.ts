// Companies CRUD. Soft-delete con deleted_at.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, isNull, count, desc, like } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { companies } from '../../../db/schema.js';
import { newId, idToString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId, parsePagination } from '../helpers.js';
import { companyCreateSchema, companyUpdateSchema } from '../schemas.js';

export const companyRoutes = new Hono();
companyRoutes.use('*', ...authedOrg);

companyRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);
  const search = (q.q || '').trim();

  const where = search
    ? and(eq(companies.orgId, orgId), isNull(companies.deletedAt), like(companies.name, `%${search}%`))
    : and(eq(companies.orgId, orgId), isNull(companies.deletedAt));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(where)
      .orderBy(desc(companies.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(companies).where(where),
  ]);

  return c.json({
    companies: rows.map((r) => ({
      id: idToString(r.id),
      name: r.name,
      website: r.website,
      industry: r.industry,
      sizeBucket: r.sizeBucket,
      country: r.country,
      city: r.city,
      createdAt: r.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

companyRoutes.get('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt)))
    .limit(1);
  if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  return c.json({ company: { ...row, id: idToString(row.id) } });
});

companyRoutes.post('/', zValidator('json', companyCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const input = c.req.valid('json');

  const id = newId();
  await db.insert(companies).values({
    id,
    orgId,
    name: input.name,
    website: input.website ?? null,
    industry: input.industry ?? null,
    sizeBucket: input.sizeBucket ?? null,
    country: input.country ?? null,
    city: input.city ?? null,
    notesShort: input.notesShort ?? null,
  });
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'company',
    entityId: id,
    verb: 'created',
    payload: { name: input.name },
  });

  return c.json({ company: { id: idToString(id), ...input } }, 201);
});

companyRoutes.patch('/:id', zValidator('json', companyUpdateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const patch = c.req.valid('json');
  if (Object.keys(patch).length === 0) return c.json({ ok: true });

  await db.update(companies).set(patch as any).where(and(eq(companies.id, id), eq(companies.orgId, orgId)));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'company',
    entityId: id,
    verb: 'updated',
    payload: { fields: Object.keys(patch) },
  });

  return c.json({ ok: true });
});

companyRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.orgId, orgId), isNull(companies.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  await db.update(companies).set({ deletedAt: new Date() }).where(eq(companies.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'company',
    entityId: id,
    verb: 'deleted',
  });

  return c.json({ ok: true });
});
