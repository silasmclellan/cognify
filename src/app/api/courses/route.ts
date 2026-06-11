import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, initDb } from '@/lib/db';
import { canCreateCourse, recordCourseCreation } from '@/lib/subscription';
import { Course } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const sql = getDb();
  const rows = await sql`
    SELECT data FROM courses WHERE user_id = ${session.user.id} ORDER BY created_at DESC
  `;

  return NextResponse.json(rows.map(r => JSON.parse(r.data)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();

  // Check if the user is saving an EXISTING course (update) vs creating new
  const course: Course = await req.json();
  const sql = getDb();
  const existing = await sql`SELECT id FROM courses WHERE id = ${course.id} LIMIT 1`;

  if (existing.length === 0) {
    // New course — enforce subscription limit
    const check = await canCreateCourse(session.user.id);
    if (!check.allowed) {
      return NextResponse.json(
        { error: 'limit_reached', plan: check.subscription.plan_id },
        { status: 402 }
      );
    }

    await sql`
      INSERT INTO courses (id, user_id, data)
      VALUES (${course.id}, ${session.user.id}, ${JSON.stringify(course)})
    `;

    await recordCourseCreation(session.user.id);
  } else {
    // Update existing course — no limit check needed
    await sql`
      UPDATE courses SET data = ${JSON.stringify(course)}, updated_at = NOW()
      WHERE id = ${course.id} AND user_id = ${session.user.id}
    `;
  }

  return NextResponse.json({ ok: true });
}
