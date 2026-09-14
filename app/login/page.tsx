import BrandLogo from '@/components/brand-logo';
import LoginForm from './login-form';
import { googleSignInEnabled } from '@/lib/auth-providers';
import './login.css';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
  const [{error}, googleEnabled] = await Promise.all([searchParams, googleSignInEnabled({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })]);
  return <main className="login"><section className="login-story"><BrandLogo/><div><p className="eyebrow">BUILT AROUND YOUR WORK</p><h1>One place.<br/>Every next step.</h1><p>From the first conversation to the finished job, keep your people and your work moving together.</p></div><small>WorkForge Systems Limited</small></section><section className="login-panel"><div className="login-form"><span className="chip">WorkForge development</span><h2>Welcome back.</h2><p>Sign in to your dedicated workspace.</p><LoginForm callbackFailed={error==='callback'} googleEnabled={googleEnabled}/><p className="muted small">Workspace access is by invitation.</p></div></section></main>;
}
