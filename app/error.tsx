'use client';
export default function ErrorPage({reset}:{reset:()=>void}) {return <main className="login-card"><h1>We couldn’t load this workspace.</h1><p>Your records are safe. Please retry, or sign in again if your session has expired.</p><button onClick={reset}>Try again</button><a href="/login">Sign in</a></main>;}
