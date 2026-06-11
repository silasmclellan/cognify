import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

async function upsertSubscription(
  userId: string,
  planId: string,
  stripeSubId: string | null,
  status: string,
) {
  const sql = getDb();
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();

  await sql`
    INSERT INTO subscriptions (id, user_id, plan_id, stripe_subscription_id, status, period_start, period_end, courses_created_this_month)
    VALUES (
      gen_random_uuid()::text,
      ${userId},
      ${planId},
      ${stripeSubId},
      ${status},
      ${now.toISOString()},
      ${periodEnd},
      0
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      stripe_subscription_id = EXCLUDED.stripe_subscription_id,
      status = EXCLUDED.status,
      period_start = CASE WHEN subscriptions.plan_id != EXCLUDED.plan_id THEN EXCLUDED.period_start ELSE subscriptions.period_start END,
      period_end = CASE WHEN subscriptions.plan_id != EXCLUDED.plan_id THEN EXCLUDED.period_end ELSE subscriptions.period_end END,
      courses_created_this_month = CASE WHEN subscriptions.plan_id != EXCLUDED.plan_id THEN 0 ELSE subscriptions.courses_created_this_month END,
      updated_at = NOW()
  `;
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        if (!userId || !planId) break;

        if (session.mode === 'payment' && planId === 'per_course') {
          // One-time purchase: bump course credit by 1
          const sql = getDb();
          await sql`
            UPDATE subscriptions
            SET plan_id = 'per_course', status = 'active', updated_at = NOW()
            WHERE user_id = ${userId}
          `;
          // Record as a credit (set period_end far in future so counter doesn't reset)
          await sql`
            UPDATE subscriptions
            SET period_start = NOW(), period_end = NOW() + INTERVAL '100 years', courses_created_this_month = 0
            WHERE user_id = ${userId} AND plan_id = 'per_course'
          `;
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const planId = subscription.metadata?.planId;
        if (!userId || !planId) break;
        await upsertSubscription(userId, planId, subscription.id, subscription.status);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;
        const sql = getDb();
        await sql`
          UPDATE subscriptions
          SET plan_id = 'free', status = 'canceled', stripe_subscription_id = NULL, updated_at = NOW()
          WHERE user_id = ${userId}
        `;
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as { subscription?: string }).subscription;
        if (subId) {
          const sql = getDb();
          await sql`UPDATE subscriptions SET status = 'past_due', updated_at = NOW() WHERE stripe_subscription_id = ${subId}`;
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
