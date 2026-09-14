'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signInCallbackUrl } from '@/lib/auth-redirect';
export default function LoginForm({ callbackFailed = false }: { callbackFailed?: boolean }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(callbackFailed
    ? 'That sign-in link could not be verified. Request a new link here and open it in this same browser.' : '');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(), options: { emailRedirectTo: signInCallbackUrl(window.location.href) },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed. Please retry.');
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: signInCallbackUrl(window.location.href) },
      });
      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed. Please retry.');
      setBusy(false);
    }
  }

  return <>
    {sent ? <div>
      <div className="notice" role="status">
        <div>
        <strong>Check your email.</strong>
        <p>We sent a sign-in link to {email.trim()}. Open that link in this browser to continue.</p>
        </div>
      </div>
      <p className="muted small">Use the newest email. If it has not arrived, check your spam folder.</p>
      <button type="button" className="secondary wide" onClick={() => { setSent(false); setError(''); }}>Request a new link</button>
    </div> : <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label>
      <p className="muted small">We’ll email you a link to sign in. Open it in this same browser.</p>
      <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : 'Email me a sign-in link'}</button>
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true' && <button className="wide secondary" onClick={google} disabled={busy}>Continue with Google</button>}
  </>;
}
