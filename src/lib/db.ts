import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Lazily initialize so the connection string isn't required at build time
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error('POSTGRES_URL environment variable is not set');
    _sql = neon(url);
  }
  return _sql;
}

// Tagged-template proxy so call sites look the same: sql`SELECT ...`
export const sql: NeonQueryFunction<false, false> = new Proxy(
  {} as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args) {
      return (getSql() as unknown as (...a: unknown[]) => unknown)(...args);
    },
    get(_target, prop) {
      return (getSql() as unknown as Record<string | symbol, unknown>)[prop];
    },
  }
);

// Called on each cold start to ensure tables exist.
export async function initDb() {
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id)
  `;
}

export interface DbUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}
