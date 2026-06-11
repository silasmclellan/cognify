import { getDb, getOrCreateSubscription, DbSubscription } from './db';
import { PlanId, PLANS } from '@/types';

export type SubscriptionCheckResult =
  | { allowed: true; subscription: DbSubscription }
  | { allowed: false; reason: 'no_plan' | 'limit_reached' | 'inactive'; subscription: DbSubscription };

/**
 * Check whether a user is allowed to create a new course.
 * Enforces free (1 lifetime), starter (5/month), unlimited, business (unlimited).
 */
export async function canCreateCourse(userId: string): Promise<SubscriptionCheckResult> {
  const sub = await getOrCreateSubscription(userId);

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return { allowed: false, reason: 'inactive', subscription: sub };
  }

  const plan = PLANS[sub.plan_id as PlanId] ?? PLANS.free;

  // Unlimited plans
  if (plan.courseLimit === null) {
    return { allowed: true, subscription: sub };
  }

  // Free plan: 1 course lifetime (check total courses created)
  if (sub.plan_id === 'free') {
    const sql = getDb();
    const rows = await sql`SELECT COUNT(*) as cnt FROM courses WHERE user_id = ${userId}`;
    const total = Number(rows[0]?.cnt ?? 0);
    if (total >= 1) {
      return { allowed: false, reason: 'limit_reached', subscription: sub };
    }
    return { allowed: true, subscription: sub };
  }

  // Monthly plans: check courses_created_this_month
  // Reset counter if we're in a new period
  const now = new Date();
  const periodEnd = sub.period_end ? new Date(sub.period_end) : null;

  let coursesUsed = sub.courses_created_this_month;
  if (!periodEnd || now > periodEnd) {
    // Period rolled over — reset counter in DB
    const sql = getDb();
    const newPeriodStart = now.toISOString();
    const newPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
    await sql`
      UPDATE subscriptions
      SET courses_created_this_month = 0,
          period_start = ${newPeriodStart},
          period_end = ${newPeriodEnd},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `;
    coursesUsed = 0;
  }

  if (coursesUsed >= plan.courseLimit) {
    return { allowed: false, reason: 'limit_reached', subscription: sub };
  }

  return { allowed: true, subscription: sub };
}

/** Increment the course counter after a successful course creation. */
export async function recordCourseCreation(userId: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE subscriptions
    SET courses_created_this_month = courses_created_this_month + 1,
        updated_at = NOW()
    WHERE user_id = ${userId}
  `;
}

export function planLabel(planId: string): string {
  return PLANS[planId as PlanId]?.name ?? 'Free';
}

export function courseLimitLabel(planId: string): string {
  const p = PLANS[planId as PlanId] ?? PLANS.free;
  if (p.courseLimit === null) return 'Unlimited courses';
  if (planId === 'free') return '1 course (lifetime)';
  return `${p.courseLimit} courses/month`;
}
