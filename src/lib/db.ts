import { neon } from '@neondatabase/serverless';

export function getDb() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL environment variable is not set');
  return neon(url);
}

export async function initDb() {
  const sql = getDb();

  // Core user table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Courses
  await sql`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id)`;

  // Subscriptions / billing
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      courses_created_this_month INTEGER NOT NULL DEFAULT 0,
      period_start TIMESTAMPTZ,
      period_end TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`;

  // Organizations (business accounts)
  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stripe_subscription_id TEXT,
      employee_limit INTEGER NOT NULL DEFAULT 20,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_user_id)`;

  // Org members
  await sql`
    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      invite_email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      status TEXT NOT NULL DEFAULT 'pending',
      joined_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id) WHERE user_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_org_members_email ON org_members(invite_email)`;

  // Course assignments
  await sql`
    CREATE TABLE IF NOT EXISTS course_assignments (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      assigned_to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_assignments_org ON course_assignments(org_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_assignments_assignee ON course_assignments(assigned_to_user_id)`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  courses_created_this_month: number;
  period_start: string | null;
  period_end: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Fetch or bootstrap a subscription row for the given user. */
export async function getOrCreateSubscription(userId: string): Promise<DbSubscription> {
  const sql = getDb();
  const rows = await sql`SELECT * FROM subscriptions WHERE user_id = ${userId} LIMIT 1`;
  if (rows.length > 0) return rows[0] as DbSubscription;

  // New user → free plan
  const { randomUUID } = await import('crypto');
  const id = randomUUID();
  const created = await sql`
    INSERT INTO subscriptions (id, user_id, plan_id, status)
    VALUES (${id}, ${userId}, 'free', 'active')
    RETURNING *
  `;
  return created[0] as DbSubscription;
}
