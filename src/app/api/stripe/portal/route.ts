import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getOrCreateSubscription, initDb } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const sub = await getOrCreateSubscription(session.user.id);

  if (!sub.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 400 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${baseUrl}/dashboard`,
  });

  return NextResponse.json({ url: portalSession.url });
}
