'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function LoginForm(){
  const [email,setEmail]=useState('');const [code,setCode]=useState('');const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try {const db=createClient();
    if(sent){const {error}=await db.auth.verifyOtp({email:email.trim(),token:code.trim(),type:'email'});if(error)throw error;window.location.assign('/');}
    else{const {error}=await db.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:`${window.location.origin}/auth/callback`}});if(error)throw error;setSent(true);}
  }catch(e){setError(e instanceof Error?e.message:'Sign-in failed. Please retry.');}finally{setBusy(false);}}
  async function google(){setBusy(true);setError('');const {error}=await createClient().auth.signInWithOAuth({provider:'google',options:{redirectTo:`${window.location.origin}/auth/callback`}});if(error){setError(error.message);setBusy(false);}}
  return <><form onSubmit={submit}><label>Email address<input type="email" autoComplete="email" required value={email} disabled={sent} onChange={e=>setEmail(e.target.value)}/></label>{sent&&<><p className="notice">Check your email for the sign-in link or verification code.</p><label>Verification code<input autoComplete="one-time-code" inputMode="numeric" required value={code} onChange={e=>setCode(e.target.value)}/></label></>}{error&&<p role="alert" className="error">{error}</p>}<button className="primary wide" disabled={busy}>{busy?'Please wait…':sent?'Verify and sign in':'Email me a sign-in link'}</button>{sent&&<button type="button" className="quiet" onClick={()=>{setSent(false);setCode('');}}>Use another email</button>}</form>{process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED==='true'&&<button className="wide secondary" onClick={google} disabled={busy}>Continue with Google</button>}</>;
}
