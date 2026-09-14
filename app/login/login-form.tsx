'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signInCallbackUrl } from '@/lib/auth-redirect';
export default function LoginForm({ callbackFailed = false, googleEnabled = false }: { callbackFailed?: boolean; googleEnabled?: boolean }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState(callbackFailed
    ? googleEnabled ? 'Sign-in could not be completed. Please choose Google again to start a new sign-in.'
      : 'That sign-in link could not be verified. Request a new link here and open it in this same browser.' : '');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: email.trim(), options: { emailRedirectTo: signInCallbackUrl(window.location.href) },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      const rateLimited = error && typeof error === 'object' && 'code' in error && error.code === 'over_email_send_rate_limit';
      setError(rateLimited ? googleEnabled ? 'Sign-in emails are temporarily limited. Use Google above to continue.'
        : 'Sign-in emails are temporarily limited. Please wait before requesting another email.'
        : error instanceof Error ? error.message : 'Sign-in failed. Please retry.');
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError('');
    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider: 'google', options: { redirectTo: signInCallbackUrl(window.location.href), queryParams: { prompt: 'select_account' } },
      });
      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in failed. Please retry.');
      setBusy(false);
    }
  }

  return <>
    {googleEnabled && <div className="google-login">
      <button type="button" className="google-sign-in" onClick={google} disabled={busy} aria-label="Sign in with Google" aria-busy={busy}>
        <img src="/brand/google-sign-in.svg" alt="" width="180" height="40"/>
      </button>
      <p className="muted small">Use the Google account associated with your workspace invitation.</p>
      <button type="button" className="quiet" disabled={busy} aria-expanded={showEmail} onClick={() => { setShowEmail(!showEmail); setError(''); }}>
        {showEmail ? 'Hide email sign-in' : 'Use an email link instead'}
      </button>
    </div>}
    {(!googleEnabled || showEmail) && (sent ? <div>
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
    </form>)}
    {error && <p role="alert" className="error">{error}</p>}
  </>;
}
