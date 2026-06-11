import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { randomUUID } from 'crypto';

/** GET /api/business/assignments?orgId=xxx  — list assignments with progress */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const sql = getDb();

  // Manager view
  const org = await sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const assignments = await sql`
    SELECT
      a.id, a.course_id, a.assigned_to_user_id, a.due_date, a.created_at,
      c.data::jsonb->>'title' as course_title,
      u.name as assignee_name, u.email as assignee_email,
      c.data::jsonb->'progress' as progress_data
    FROM course_assignments a
    JOIN courses c ON c.id = a.course_id
    JOIN users u ON u.id = a.assigned_to_user_id
    WHERE a.org_id = ${orgId}
    ORDER BY a.created_at DESC
  `;

  // Compute completion % for each assignment
  const enriched = assignments.map(a => {
    let pct = 0;
    try {
      const prog = typeof a.progress_data === 'string' ? JSON.parse(a.progress_data) : a.progress_data;
      // We don't have total lessons here without parsing the full course, so just show has_progress
      pct = prog?.completedLessons?.length ?? 0;
    } catch { /* ignore */ }
    return { ...a, completedLessons: pct };
  });

  return NextResponse.json({ assignments: enriched });
}

/** POST — assign a course to an employee */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { orgId, courseId, assignToUserId, dueDate } = await req.json();
  if (!orgId || !courseId || !assignToUserId) {
    return NextResponse.json({ error: 'orgId, courseId, and assignToUserId required' }, { status: 400 });
  }

  const sql = getDb();

  const org = await sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Verify the assignee is a member of the org
  const member = await sql`SELECT id FROM org_members WHERE org_id = ${orgId} AND user_id = ${assignToUserId} AND status = 'active' LIMIT 1`;
  if (member.length === 0) return NextResponse.json({ error: 'User is not an active member of this org' }, { status: 400 });

  const id = randomUUID();
  await sql`
    INSERT INTO course_assignments (id, org_id, course_id, assigned_to_user_id, assigned_by_user_id, due_date)
    VALUES (
      ${id}, ${orgId}, ${courseId}, ${assignToUserId}, ${session.user.id},
      ${dueDate ?? null}
    )
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ id });
}

/** DELETE — remove an assignment */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { assignmentId, orgId } = await req.json();
  const sql = getDb();

  const org = await sql`SELECT id FROM organizations WHERE id = ${orgId} AND owner_user_id = ${session.user.id} LIMIT 1`;
  if (org.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM course_assignments WHERE id = ${assignmentId} AND org_id = ${orgId}`;
  return NextResponse.json({ ok: true });
}
