'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Trash2, BookOpen, Award, Building2, CreditCard, Zap } from 'lucide-react';
import { Course } from '@/types';
import { getCoursesRemote, deleteCourseRemote, getCoursesLocal, saveCourseRemote, clearLocalCourses } from '@/lib/courseStorage';
import { computeMastery } from '@/lib/prompts';

interface SubInfo {
  plan_id: string;
  status: string;
  courses_created_this_month: number;
  totalCourses: number;
  stripe_customer_id: string | null;
}

function DashboardInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [importing, setImporting] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [sub, setSub] = useState<SubInfo | null>(null);
  const [paymentSuccess] = useState(searchParams.get('payment_success') === '1');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signin?callbackUrl=/dashboard'); return; }
    if (status === 'authenticated') {
      const local = getCoursesLocal();
      if (local.length > 0) {
        Promise.all(local.map(c => saveCourseRemote(c)))
          .then(() => { clearLocalCourses(); setLocalCount(0); })
          .finally(() => loadCourses());
      } else {
        loadCourses();
      }
      loadSub();
    }
  }, [status]);

  const loadCourses = async () => setCourses(await getCoursesRemote());
  const loadSub = async () => {
    const res = await fetch('/api/subscription');
    if (res.ok) setSub(await res.json());
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    await deleteCourseRemote(id);
    setCourses(c => c.filter(x => x.id !== id));
  };

  const getProgress = (course: Course) => {
    const total = course.weeks.reduce((acc, w) => acc + w.lessons.length, 0);
    return total > 0 ? Math.round((course.progress.completedLessons.length / total) * 100) : 0;
  };

  const manageBilling = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert('Billing portal not available. Please contact support.');
  };

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;

  const planLabel = sub ? (
    sub.plan_id === 'free' ? 'Free'
    : sub.plan_id === 'per_course' ? 'Pay per course'
    : sub.plan_id === 'starter' ? 'Starter'
    : sub.plan_id === 'unlimited' ? 'Unlimited'
    : sub.plan_id === 'business' ? 'Business'
    : sub.plan_id
  ) : null;

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          Pansophia
        </Link>
        <div className="flex items-center gap-4">
          {sub?.plan_id === 'business' && (
            <Link href="/business" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none' }}>
              <Building2 size={14} /> Business
            </Link>
          )}
          <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{session?.user?.name}</span>
          <Link href="/onboarding">
            <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> New Course
            </button>
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '60px 40px' }}>
        {paymentSuccess && (
          <div className="card" style={{ padding: '16px 24px', marginBottom: 32, background: '#22c55e11', borderColor: '#22c55e44', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Award size={18} color="#22c55e" />
            <span style={{ color: '#22c55e', fontWeight: 600 }}>Payment successful! Your plan has been upgraded.</span>
          </div>
        )}

        {/* Subscription card */}
        {sub && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Zap size={18} color="var(--accent)" />
              <div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{planLabel} plan</span>
                {sub.plan_id === 'free' && (
                  <span style={{ fontSize: 13, color: 'var(--text-faint)', marginLeft: 10 }}>
                    {sub.totalCourses >= 1 ? 'Course limit reached' : `${sub.totalCourses}/1 courses used`}
                  </span>
                )}
                {sub.plan_id === 'starter' && (
                  <span style={{ fontSize: 13, color: 'var(--text-faint)', marginLeft: 10 }}>
                    {sub.courses_created_this_month}/5 courses this month
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {sub.plan_id !== 'business' && sub.plan_id !== 'unlimited' && (
                <Link href="/pricing">
                  <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 13 }}>Upgrade</button>
                </Link>
              )}
              {sub.stripe_customer_id && (
                <button className="btn-secondary" style={{ padding: '7px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={manageBilling}>
                  <CreditCard size={13} /> Billing
                </button>
              )}
            </div>
          </div>
        )}

        <h1 style={{ fontSize: 42, marginBottom: 8 }}>My Courses</h1>
        <p style={{ color: 'var(--text-faint)', marginBottom: localCount > 0 ? 24 : 48, fontSize: 16 }}>
          {courses.length} course{courses.length !== 1 ? 's' : ''} saved to your account
        </p>

        {localCount > 0 && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderColor: 'var(--border-strong)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{localCount} course{localCount !== 1 ? 's' : ''} found on this device</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Import them to save permanently to your account.</div>
            </div>
            <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 15 }}
              onClick={async () => {
                setImporting(true);
                const local = getCoursesLocal();
                for (const c of local) await saveCourseRemote(c);
                clearLocalCourses(); setLocalCount(0);
                await loadCourses(); setImporting(false);
              }} disabled={importing}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        )}

        {courses.length === 0 ? (
          <div className="card" style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
            <h2 style={{ fontSize: 26, marginBottom: 12 }}>No courses yet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28, fontSize: 17 }}>Create your first AI-generated course to get started.</p>
            <Link href="/onboarding">
              <button className="btn-primary">Build My First Course</button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
            {courses.map(course => {
              const progress = getProgress(course);
              const totalLessons = course.weeks.reduce((acc, w) => acc + w.lessons.length, 0);
              const mastery = computeMastery(course.progress.scores);
              return (
                <div key={course.id} className="card" style={{ padding: 24, position: 'relative' }}>
                  <button
                    onClick={() => handleDelete(course.id)}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', opacity: 0, transition: 'opacity 0.15s', padding: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  ><Trash2 size={14} /></button>

                  <div style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: 20, marginBottom: 4, lineHeight: 1.3, paddingRight: 24 }}>{course.title}</h3>
                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-faint)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      <span className="capitalize">{course.depth}</span>
                      <span>·</span><span>{course.totalWeeks} weeks</span>
                      {course.creditHours && <><span>·</span><span>{course.creditHours} credit hrs</span></>}
                    </div>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.55, marginBottom: 16 }}>
                    {course.description.slice(0, 110)}{course.description.length > 110 ? '…' : ''}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, fontSize: 13, color: 'var(--text-faint)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BookOpen size={12} /> {course.progress.completedLessons.length}/{totalLessons} lessons</span>
                    {mastery.grade !== '—' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: mastery.color, fontWeight: 700 }}>
                        <Award size={12} /> {mastery.grade} · {mastery.average}%
                      </span>
                    )}
                  </div>

                  <div className="progress-bar" style={{ marginBottom: 20 }}>
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{new Date(course.createdAt).toLocaleDateString()}</span>
                    <Link href={`/course/${course.id}`}>
                      <button className="btn-primary" style={{ padding: '7px 16px', fontSize: 14 }}>
                        {progress === 0 ? 'Start' : progress === 100 ? 'Review' : 'Continue'} &rarr;
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>}><DashboardInner /></Suspense>;
}
