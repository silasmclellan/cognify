'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  const authed = status === 'authenticated';

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Pansophia</span>
        <div className="flex items-center gap-6">
          {authed ? (
            <>
              <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>{session.user?.name}</span>
              <Link href="/dashboard">
                <button className="btn-secondary" style={{ padding: '7px 18px', fontSize: 15 }}>My Courses</button>
              </Link>
              <button className="btn-primary" style={{ padding: '7px 18px', fontSize: 15 }} onClick={() => signOut({ callbackUrl: '/' })}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" style={{ fontSize: 16, color: 'var(--text-muted)', textDecoration: 'none' }}>Sign In</Link>
              <Link href="/signup">
                <button className="btn-primary" style={{ padding: '8px 20px', fontSize: 15 }}>Get Started</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-32">
        <p style={{ fontSize: 13, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 32 }}>
          AI-Powered Education
        </p>
        <h1 style={{ fontSize: 'clamp(3.5rem, 8vw, 7rem)', fontWeight: 800, lineHeight: 1.05, marginBottom: 32, maxWidth: 800 }}>
          Learning that adapts<br />
          <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>to you</em>
        </h1>
        <p style={{ fontSize: 20, marginBottom: 48, maxWidth: 560, color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Tell us what you want to learn. Pansophia builds a complete, personalised curriculum &mdash; syllabus, lessons, homework, and quizzes &mdash; drawn from the world&rsquo;s best academic sources.
        </p>
        <Link href={authed ? '/onboarding' : '/signup'}>
          <button className="btn-primary" style={{ fontSize: 19, padding: '14px 44px' }}>
            {authed ? 'Build a Course' : 'Start Learning Free'}
          </button>
        </Link>
        {authed && (
          <Link href="/dashboard" style={{ marginTop: 16, display: 'block', fontSize: 15, color: 'var(--text-faint)', textDecoration: 'none' }}>
            Go to your courses &rarr;
          </Link>
        )}
      </section>

      <div style={{ borderTop: '1px solid var(--border)', maxWidth: 900, margin: '0 auto', width: '100%' }} />

      <section style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '80px 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
          {[
            { label: 'Academic Sources', desc: 'Every lesson grounded in peer-reviewed journals, university press texts, and seminal works.' },
            { label: 'Your Learning Style', desc: 'Reading, watching, listening, practising, collaborative — every lesson adapts to how you learn best.' },
            { label: 'Progress Saved', desc: 'Create an account and your courses, lessons, and quiz scores are saved across every device.' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 12 }}>{f.label}</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 17, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: '0 auto', width: '100%', padding: '0 40px 80px' }}>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 60, marginBottom: 40 }}>
          <h2 style={{ fontSize: 28, marginBottom: 32, textAlign: 'center' }}>Built for every learner</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { emoji: '🎓', label: 'Students', desc: 'Credit-hour courses' },
              { emoji: '💼', label: 'Professionals', desc: 'Upskill with rigour' },
              { emoji: '🏢', label: 'Businesses', desc: 'Train your team' },
              { emoji: '🧠', label: 'Curious Minds', desc: 'Learn anything' },
            ].map(u => (
              <div key={u.label} className="card" style={{ padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{u.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{u.label}</div>
                <div style={{ color: 'var(--text-faint)', fontSize: 14 }}>{u.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '0 40px 80px', textAlign: 'center' }}>
        <div className="card generating" style={{ maxWidth: 560, margin: '0 auto', padding: '56px 40px' }}>
          <h2 style={{ fontSize: 32, marginBottom: 16 }}>Ready to begin?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 17 }}>
            Create a free account and build your first AI-generated course in two minutes.
          </p>
          <Link href={authed ? '/onboarding' : '/signup'}>
            <button className="btn-primary" style={{ fontSize: 18, padding: '13px 40px' }}>
              {authed ? 'Build a Course' : 'Create Free Account'}
            </button>
          </Link>
        </div>
      </section>

      <footer style={{ textAlign: 'center', paddingBottom: 32, color: 'var(--text-faint)', fontSize: 13, letterSpacing: '0.05em' }}>
        &copy; 2025 Pansophia &mdash; AI-Powered Learning Platform
      </footer>
    </div>
  );
}
