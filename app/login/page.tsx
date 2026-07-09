'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(''); setNote('');
    const res = mode === 'up'
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    // signUp with email confirmation returns a user but no session
    if (mode === 'up' && !res.data.session) {
      setNote('Check your email to confirm, then sign in.');
      setMode('in');
      return;
    }
    router.push('/');
    router.refresh();
  };

  const google = async () => {
    setErr(''); setNote('');
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setErr(error.message);
  };

  return (
    <main className="gate">
      <form className="gate-card" onSubmit={submit}>
        <div className="gate-mark">LOHO KUR</div>
        <h1 className="gate-h">{mode === 'up' ? 'Create your studio' : 'Welcome back'}</h1>
        <p className="gate-sub">{mode === 'up' ? 'Sign up to start building.' : 'Sign in to your studio.'}</p>
        <button type="button" className="gate-google" onClick={google}>
          <svg viewBox="0 0 48 48" aria-hidden="true" width="16" height="16">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.4z" />
            <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
          </svg>
          Continue with Google
        </button>
        <div className="gate-or"><span>or</span></div>
        <input
          className="gate-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          autoFocus
          required
        />
        <input
          className="gate-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          minLength={6}
          required
        />
        {err ? <div className="gate-err">{err}</div> : null}
        {note ? <div className="gate-note">{note}</div> : null}
        <button className="gate-btn" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'up' ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="gate-switch"
          onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setErr(''); setNote(''); }}
        >
          {mode === 'up' ? 'Have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </main>
  );
}
