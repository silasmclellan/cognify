'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Zap, Building2 } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: '',
    description: 'Try Pansophia with your first course.',
    features: ['1 course (lifetime)', 'Full AI-generated curriculum', 'Quizzes & lesson content', 'All learning formats'],
    cta: 'Get started',
    highlight: false,
  },
  {
    id: 'per_course',
    name: 'Pay per course',
    price: '$5',
    interval: 'per course',
    description: 'Pay only when you need a new course.',
    features: ['$5 per course, no subscription', 'Full AI-generated curriculum', 'Quizzes & lesson content', 'All learning formats'],
    cta: 'Buy a course',
    highlight: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$15',
    interval: '/month',
    description: 'For regular learners building new skills.',
    features: ['5 courses per month', 'Full AI-generated curriculum', 'Quizzes & lesson content', 'Academic paper search', 'All learning formats'],
    cta: 'Start Starter',
    highlight: false,
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: '$25',
    interval: '/month',
    description: 'For serious learners with no limits.',
    features: ['Unlimited courses', 'Full AI-generated curriculum', 'Quizzes & lesson content', 'Academic paper search', 'Adaptive remediation', 'All learning formats'],
    cta: 'Go Unlimited',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$50',
    interval: '/month',
    description: 'Train your whole team with one account.',
    features: ['Up to 20 employees', 'Unlimited courses', 'Assign courses to employees', 'Track employee progress', 'Manager dashboard', 'All features included'],
    cta: 'Start Business',
    highlight: false,
    icon: Building2,
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (planId: string) => {
    if (planId === 'free') {
      router.push(session ? '/dashboard' : '/signup');
      return;
    }
    if (!session) {
      router.push(`/signin?callbackUrl=/pricing`);
      return;
    }

    setLoading(planId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? 'Something went wrong');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          Pansophia
        </Link>
        <div className="flex items-center gap-4">
          {session ? (
            <Link href="/dashboard" className="btn-secondary" style={{ padding: '8px 18px', fontSize: 14 }}>Dashboard</Link>
          ) : (
            <><Link href="/signin" className="btn-secondary" style={{ padding: '8px 18px', fontSize: 14 }}>Sign in</Link>
            <Link href="/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>Sign up</Link></>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 24px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h1 style={{ fontSize: 48, fontWeight: 800, marginBottom: 16 }}>Simple pricing</h1>
          <p style={{ fontSize: 18, color: 'var(--text-muted)', maxWidth: 520, margin: '0 auto' }}>
            Your first course is always free. Upgrade when you're ready to learn more.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, alignItems: 'start' }}>
          {plans.map(plan => (
            <div
              key={plan.id}
              className="card"
              style={{
                padding: '28px 24px',
                position: 'relative',
                border: plan.highlight ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: plan.highlight ? 'var(--accent-bg)' : undefined,
              }}
            >
              {plan.highlight && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 12px', borderRadius: 20 }}>
                  Most popular
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {plan.icon && <plan.icon size={16} color="var(--text-muted)" />}
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{plan.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 800 }}>{plan.price}</span>
                  {plan.interval && <span style={{ color: 'var(--text-muted)', fontSize: 15 }}>{plan.interval}</span>}
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{plan.description}</p>
              </div>

              <button
                className={plan.highlight ? 'btn-primary' : 'btn-secondary'}
                style={{ width: '100%', marginBottom: 20, fontSize: 15 }}
                onClick={() => handleSelect(plan.id)}
                disabled={loading === plan.id}
              >
                {loading === plan.id ? <span className="spinner" /> : plan.cta}
              </button>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, fontSize: 14, color: 'var(--text-muted)' }}>
                    <Check size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 48, fontSize: 14, color: 'var(--text-faint)' }}>
          All plans include a 100% satisfaction guarantee. Cancel anytime.{' '}
          <Link href="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>View your current plan →</Link>
        </p>
      </div>
    </div>
  );
}
