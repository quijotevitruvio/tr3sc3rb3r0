// Contacts CRUD. Email único por org (no global). Soft-delete con deleted_at.
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, isNull, count, desc, like, or } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { contacts, companies } from '../../../db/schema.js';
import { newId, idToString } from '../../../lib/uuid.js';
import { authedOrg } from '../../../middleware/org-context.js';
import { logActivity, tryParseId, parsePagination } from '../helpers.js';
import { contactCreateSchema, contactUpdateSchema } from '../schemas.js';

export const contactRoutes = new Hono();
contactRoutes.use('*', ...authedOrg);

// ─── LIST contacts (paginado, búsqueda opcional) ─────────────────
contactRoutes.get('/', async (c) => {
  const { orgId } = c.get('org');
  const q = c.req.query();
  const { page, pageSize, offset } = parsePagination(q);
  const search = (q.q || '').trim();

  const where = search
    ? and(
        eq(contacts.orgId, orgId),
        isNull(contacts.deletedAt),
        or(
          like(contacts.firstName, `%${search}%`),
          like(contacts.lastName, `%${search}%`),
          like(contacts.email, `%${search}%`),
        ),
      )
    : and(eq(contacts.orgId, orgId), isNull(contacts.deletedAt));

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        jobTitle: contacts.jobTitle,
        score: contacts.score,
        companyId: contacts.companyId,
        companyName: companies.name,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(where)
      .orderBy(desc(contacts.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ value: count() }).from(contacts).where(where),
  ]);

  return c.json({
    contacts: rows.map((r) => ({
      id: idToString(r.id),
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      jobTitle: r.jobTitle,
      score: r.score,
      company: r.companyId ? { id: idToString(r.companyId), name: r.companyName } : null,
      createdAt: r.createdAt,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ─── GET contact ─────────────────────────────────────────────────
contactRoutes.get('/:id', async (c) => {
  const { orgId } = c.get('org');
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [row] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt)))
    .limit(1);
  if (!row) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  return c.json({
    contact: {
      id: idToString(row.id),
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      jobTitle: row.jobTitle,
      source: row.source,
      score: row.score,
      companyId: row.companyId ? idToString(row.companyId) : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  });
});

// ─── CREATE ──────────────────────────────────────────────────────
contactRoutes.post('/', zValidator('json', contactCreateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const input = c.req.valid('json');

  const companyBuf = input.companyId ? tryParseId(input.companyId) : null;
  if (input.companyId && !companyBuf) {
    return c.json({ error: { code: 'INVALID_COMPANY_ID' } }, 400);
  }
  // Validar que la company es de la org (sin esto, fuga cross-tenant).
  if (companyBuf) {
    const [owned] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyBuf), eq(companies.orgId, orgId), isNull(companies.deletedAt)))
      .limit(1);
    if (!owned) return c.json({ error: { code: 'COMPANY_NOT_FOUND' } }, 404);
  }

  // Email único por org — chequeo previo para error claro (UNIQUE index lo cubre igual).
  if (input.email) {
    const [dup] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.email, input.email), isNull(contacts.deletedAt)))
      .limit(1);
    if (dup) return c.json({ error: { code: 'EMAIL_TAKEN', message: 'Ya existe un contacto con ese email.' } }, 409);
  }

  const id = newId();
  await db.insert(contacts).values({
    id,
    orgId,
    companyId: companyBuf,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    jobTitle: input.jobTitle ?? null,
    source: input.source ?? null,
  });
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'contact',
    entityId: id,
    verb: 'created',
    payload: { firstName: input.firstName, lastName: input.lastName },
  });

  return c.json({ contact: { id: idToString(id), ...input } }, 201);
});

// ─── UPDATE ──────────────────────────────────────────────────────
contactRoutes.patch('/:id', zValidator('json', contactUpdateSchema), async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  const patch = c.req.valid('json');
  if (Object.keys(patch).length === 0) return c.json({ ok: true });

  // Si cambia companyId, validar ownership.
  let companyBuf: Buffer | null | undefined = undefined;
  if (patch.companyId !== undefined) {
    companyBuf = patch.companyId ? tryParseId(patch.companyId) : null;
    if (patch.companyId && !companyBuf) return c.json({ error: { code: 'INVALID_COMPANY_ID' } }, 400);
    if (companyBuf) {
      const [owned] = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyBuf), eq(companies.orgId, orgId), isNull(companies.deletedAt)))
        .limit(1);
      if (!owned) return c.json({ error: { code: 'COMPANY_NOT_FOUND' } }, 404);
    }
  }

  const setPatch: Record<string, unknown> = { ...patch };
  if (companyBuf !== undefined) setPatch.companyId = companyBuf;
  delete (setPatch as any).companyId; // re-set abajo

  await db.update(contacts).set({
    ...patch,
    ...(companyBuf !== undefined ? { companyId: companyBuf } : {}),
  } as any).where(and(eq(contacts.id, id), eq(contacts.orgId, orgId)));

  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'contact',
    entityId: id,
    verb: 'updated',
    payload: { fields: Object.keys(patch) },
  });

  return c.json({ ok: true });
});

// ─── SOFT DELETE ─────────────────────────────────────────────────
contactRoutes.delete('/:id', async (c) => {
  const { orgId } = c.get('org');
  const user = c.get('user')!;
  const id = tryParseId(c.req.param('id'));
  if (!id) return c.json({ error: { code: 'INVALID_ID' } }, 400);

  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.orgId, orgId), isNull(contacts.deletedAt)))
    .limit(1);
  if (!existing) return c.json({ error: { code: 'NOT_FOUND' } }, 404);

  await db.update(contacts).set({ deletedAt: new Date() }).where(eq(contacts.id, id));
  await logActivity({
    orgId,
    actorId: user.id,
    entityType: 'contact',
    entityId: id,
    verb: 'deleted',
  });

  return c.json({ ok: true });
});
