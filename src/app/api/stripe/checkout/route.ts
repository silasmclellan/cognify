import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, initDb, getOrCreateSubscription } from '@/lib/db';
import { getStripe, PRICE_IDS } from '@/lib/stripe';
import { PlanId } from '@/types';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initDb();
  const { planId, courseId } = await req.json() as { planId: PlanId; courseId?: string };

  if (!planId || planId === 'free') {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const stripe = getStripe();
  const sub = await getOrCreateSubscription(session.user.id);

  const baseUrl = process.env.AUTH_URL ?? 'http://localhost:3000';
  const successUrl = courseId
    ? `${baseUrl}/onboarding?payment_success=1&courseId=${courseId}`
    : `${baseUrl}/dashboard?payment_success=1`;
  const cancelUrl = `${baseUrl}/pricing?canceled=1`;

  // Upsert Stripe customer
  let customerId = sub.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    const sql = getDb();
    await sql`
      UPDATE subscriptions SET stripe_customer_id = ${customerId}, updated_at = NOW()
      WHERE user_id = ${session.user.id}
    `;
  }

  if (planId === 'per_course') {
    // One-time payment of $5
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 500,
          product_data: { name: 'Pansophia — One Course', description: 'Access to create 1 course' },
        },
        quantity: 1,
      }],
      metadata: { userId: session.user.id, planId, courseId: courseId ?? '' },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    return NextResponse.json({ url: checkoutSession.url });
  }

  // Subscription plans
  const priceId = PRICE_IDS[planId as keyof typeof PRICE_IDS];
  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured. Set STRIPE_PRICE_* env vars.' }, { status: 500 });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: session.user.id, planId },
    subscription_data: { metadata: { userId: session.user.id, planId } },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
