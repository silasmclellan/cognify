'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const callbackUrl = params.get('callbackUrl') ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError('Invalid email or password.');
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={{ display: 'block', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
          Email
        </label>
        <input
          type="email"
          className="input-field"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoFocus
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
          Password
        </label>
        <input
          type="password"
          className="input-field"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 15 }}>{error}</p>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{ marginTop: 8, width: '100%', fontSize: 17, padding: '12px' }}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          Pansophia
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h1 style={{ fontSize: 38, marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 36, fontSize: 17 }}>
            Sign in to access your courses.
          </p>

          <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
            <SignInForm />
          </Suspense>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 32, paddingTop: 24, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
              No account?{' '}
              <Link href="/signup" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
