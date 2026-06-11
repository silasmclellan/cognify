import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sql, initDb } from '@/lib/db';
import { Course } from '@/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await initDb();
  const rows = await sql`
    SELECT data FROM courses WHERE id = ${id} AND user_id = ${session.user.id} LIMIT 1
  `;

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(JSON.parse(rows[0].data));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const course: Course = await req.json();
  await initDb();

  await sql`
    INSERT INTO courses (id, user_id, data) VALUES (${id}, ${session.user.id}, ${JSON.stringify(course)})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await initDb();
  await sql`DELETE FROM courses WHERE id = ${id} AND user_id = ${session.user.id}`;
  return NextResponse.json({ ok: true });
}
