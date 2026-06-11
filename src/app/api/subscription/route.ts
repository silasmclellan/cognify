import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { initDb, getOrCreateSubscription, getDb } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const sub = await getOrCreateSubscription(session.user.id);

  // Also fetch total courses created (for free plan display)
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*) as cnt FROM courses WHERE user_id = ${session.user.id}`;
  const totalCourses = Number(rows[0]?.cnt ?? 0);

  return NextResponse.json({ ...sub, totalCourses });
}
