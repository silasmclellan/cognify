import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql, initDb } from '@/lib/db';
import { Course } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const rows = await sql`
    SELECT data FROM courses WHERE user_id = ${session.user.id} ORDER BY created_at DESC
  `;

  return NextResponse.json(rows.map(r => JSON.parse(r.data)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const course: Course = await req.json();
  await initDb();

  await sql`
    INSERT INTO courses (id, user_id, data) VALUES (${course.id}, ${session.user.id}, ${JSON.stringify(course)})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
