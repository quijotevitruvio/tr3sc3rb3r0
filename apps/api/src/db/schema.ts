// Drizzle schema MySQL. IDs BINARY(16) UUID v7. Soft-delete con deleted_at donde aplique.
// Multi-tenancy: org_id obligatorio en toda tabla de negocio (no aplica todavía a auth/users).
import {
  mysqlTable,
  varchar,
  binary,
  datetime,
  char,
  boolean,
  mysqlEnum,
  index,
  primaryKey,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

const now = () => sql`CURRENT_TIMESTAMP`;

export const users = mysqlTable(
  'users',
  {
    id: binary('id', { length: 16 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    emailVerifiedAt: datetime('email_verified_at'),
    displayName: varchar('display_name', { length: 100 }),
    isSuperadmin: boolean('is_superadmin').notNull().default(false),
    createdAt: datetime('created_at').notNull().default(now()),
    updatedAt: datetime('updated_at').notNull().default(now()).$onUpdate(() => new Date()),
  },
  (t) => ({
    emailIdx: index('idx_users_email').on(t.email),
  }),
);

// Token de sesión: el cliente recibe un token random base64url en cookie httpOnly.
// En DB guardamos SHA256(token) en sessions.id → si DB se filtra, los tokens no son utilizables.
export const sessions = mysqlTable(
  'sessions',
  {
    id: char('id', { length: 64 }).primaryKey(), // SHA256 hex del token
    userId: binary('user_id', { length: 16 }).notNull(),
    expiresAt: datetime('expires_at').notNull(),
    ipHash: char('ip_hash', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: datetime('created_at').notNull().default(now()),
  },
  (t) => ({
    userIdx: index('idx_sessions_user').on(t.userId),
    expiresIdx: index('idx_sessions_expires').on(t.expiresAt),
  }),
);

export const organizations = mysqlTable('organizations', {
  id: binary('id', { length: 16 }).primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  tier: mysqlEnum('tier', ['free', 'pro', 'enterprise']).notNull().default('free'),
  tierExpiresAt: datetime('tier_expires_at'),
  demoOnly: boolean('demo_only').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(now()),
  updatedAt: datetime('updated_at').notNull().default(now()).$onUpdate(() => new Date()),
  deletedAt: datetime('deleted_at'),
});

export const orgMembers = mysqlTable(
  'org_members',
  {
    orgId: binary('org_id', { length: 16 }).notNull(),
    userId: binary('user_id', { length: 16 }).notNull(),
    role: mysqlEnum('role', ['admin_org', 'user_org']).notNull().default('admin_org'),
    createdAt: datetime('created_at').notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.orgId, t.userId] }),
    userIdx: index('idx_org_members_user').on(t.userId),
  }),
);

// Email verification (Turn 2 lo usa; schema listo desde ya).
export const emailVerifications = mysqlTable(
  'email_verifications',
  {
    id: binary('id', { length: 16 }).primaryKey(),
    userId: binary('user_id', { length: 16 }).notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    expiresAt: datetime('expires_at').notNull(),
    consumedAt: datetime('consumed_at'),
    createdAt: datetime('created_at').notNull().default(now()),
  },
  (t) => ({
    userIdx: index('idx_email_verif_user').on(t.userId),
  }),
);

export const passwordResets = mysqlTable('password_resets', {
  id: binary('id', { length: 16 }).primaryKey(),
  userId: binary('user_id', { length: 16 }).notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  expiresAt: datetime('expires_at').notNull(),
  consumedAt: datetime('consumed_at'),
  createdAt: datetime('created_at').notNull().default(now()),
});

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type OrgRow = typeof organizations.$inferSelect;
