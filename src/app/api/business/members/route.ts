import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { randomUUID } from 'crypto';

/** GET /api/business/members?orgId=xxx  — list members with progress */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const sql = getDb();

  // Verify caller owns this org
  const org = await sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const members = await sql`
    SELECT
      m.id, m.invite_email, m.role, m.status, m.joined_at, m.user_id,
      u.name as user_name, u.email as user_email,
      (SELECT COUNT(*) FROM course_assignments a WHERE a.assigned_to_user_id = m.user_id AND a.org_id = ${orgId}) as assigned_courses,
      (SELECT COUNT(*) FROM courses c
        JOIN course_assignments a2 ON a2.course_id = c.id
        WHERE a2.assigned_to_user_id = m.user_id AND a2.org_id = ${orgId}
        AND (c.data::jsonb->'progress'->'completedLessons') IS NOT NULL) as started_courses
    FROM org_members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ${orgId}
    ORDER BY m.created_at DESC
  `;

  return NextResponse.json({ members });
}

/** POST — invite an employee by email */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { orgId, email } = await req.json();
  if (!orgId || !email) return NextResponse.json({ error: 'orgId and email required' }, { status: 400 });

  const sql = getDb();

  // Verify caller owns org
  const org = await sql`SELECT id, employee_limit FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check employee limit
  const memberCount = await sql`SELECT COUNT(*) as cnt FROM org_members WHERE org_id = ${orgId}`;
  if (Number(memberCount[0].cnt) >= org[0].employee_limit) {
    return NextResponse.json({ error: 'Employee limit reached' }, { status: 402 });
  }

  // Check for duplicate
  const dupe = await sql`SELECT id FROM org_members WHERE org_id = ${orgId} AND invite_email = ${email.toLowerCase()} LIMIT 1`;
  if (dupe.length > 0) return NextResponse.json({ error: 'Already invited' }, { status: 409 });

  // Check if user already exists
  const user = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
  const userId = user.length > 0 ? user[0].id : null;

  const id = randomUUID();
  await sql`
    INSERT INTO org_members (id, org_id, user_id, invite_email, role, status, joined_at)
    VALUES (
      ${id}, ${orgId}, ${userId}, ${email.toLowerCase()},
      'employee',
      ${userId ? 'active' : 'pending'},
      ${userId ? new Date().toISOString() : null}
    )
  `;

  return NextResponse.json({ id, status: userId ? 'active' : 'pending' });
}

/** DELETE — remove a member */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { memberId, orgId } = await req.json();
  const sql = getDb();

  const org = await sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM org_members WHERE id = ${memberId} AND org_id = ${orgId}`;
  return NextResponse.json({ ok: true });
}
