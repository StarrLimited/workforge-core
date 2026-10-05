'use client';

import { useEffect, useState } from 'react';
import { loadFormResponses } from '@/app/hq/form-response-actions';
import type { FormResponse } from '@/lib/hq-form-responses';

export default function FormResponses({ accountId }: { accountId: string }) {
  const [result, setResult] = useState<{ responses?: FormResponse[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    loadFormResponses(accountId).then(value => { if (active) setResult(value); })
      .catch(() => { if (active) setResult({ error: 'Form responses could not load. Please retry.' }); });
    return () => { active = false; };
  }, [accountId, attempt]);
  return <section className="hq-form-responses" aria-label="Lead form responses">
    <div className="hq-section-heading"><h3>Form responses</h3><button type="button" className="hq-link" onClick={() => { setResult({}); setAttempt(n => n + 1); }}>Refresh</button></div>
    {result.error ? <p role="alert" className="error">{result.error}</p> : !result.responses ? <p className="hq-muted" role="status">Loading form responses…</p>
      : result.responses.length === 0 ? <p className="hq-muted">No lead form submissions are linked to this account.</p>
      : result.responses.map(r => <article className="hq-form-response" key={r.id}>
        <header><strong>{r.source} · {r.formName}</strong><time dateTime={r.submittedAt}>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Denver' }).format(new Date(r.submittedAt))} MT</time></header>
        {r.answers.length ? <dl>{r.answers.map((a, i) => <div key={i}><dt>{a.question}</dt><dd>{a.answer}</dd></div>)}</dl>
          : <p className="hq-muted">This submission arrived without form answers. Its contact details are saved above.</p>}
        <footer>{r.campaign && <span>Campaign: {r.campaign}</span>}{r.ad && <span>Ad: {r.ad}</span>}<small>Form {r.formId}</small></footer>
      </article>)}
  </section>;
}
