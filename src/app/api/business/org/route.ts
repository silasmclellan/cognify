import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, initDb, getOrCreateSubscription } from '@/lib/db';
import { randomUUID } from 'crypto';

// GET — fetch the org the current user owns
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const sql = getDb();

  const orgs = await sql`
    SELECT o.*,
           (SELECT COUNT(*) FROM org_members m WHERE m.org_id = o.id AND m.status = 'active') as member_count
    FROM organizations o
    WHERE o.owner_user_id = ${session.user.id}
    LIMIT 1
  `;

  if (orgs.length === 0) {
    // Also check if this user is a member of an org (employee view)
    const membership = await sql`
      SELECT m.*, o.name as org_name, o.owner_user_id
      FROM org_members m
      JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = ${session.user.id} AND m.status = 'active'
      LIMIT 1
    `;
    if (membership.length > 0) {
      return NextResponse.json({ membership: membership[0], org: null });
    }
    return NextResponse.json({ org: null, membership: null });
  }

  return NextResponse.json({ org: orgs[0], membership: null });
}

// POST — create a new org
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const sql = getDb();

  // Check they have a business subscription
  const sub = await getOrCreateSubscription(session.user.id);
  if (sub.plan_id !== 'business') {
    return NextResponse.json({ error: 'Business plan required', plan: sub.plan_id }, { status: 402 });
  }

  // Check they don't already own one
  const existing = await sql`SELECT id FROM organizations WHERE owner_user_id = ${session.user.id} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'You already have an organization', id: existing[0].id }, { status: 409 });
  }

  const id = randomUUID();
  await sql`
    INSERT INTO organizations (id, name, owner_user_id, employee_limit)
    VALUES (${id}, ${name.trim()}, ${session.user.id}, 20)
  `;

  return NextResponse.json({ id, name: name.trim() });
}
