'use server';

import { z } from 'zod';
import { membership } from '@/lib/data';
import { HQ_WORKSPACE_ID } from '@/lib/hq';
import { responseAnswers, type FormResponse } from '@/lib/hq-form-responses';

export async function loadFormResponses(accountId: string): Promise<{ responses?: FormResponse[]; error?: string }> {
  const id = z.uuid().safeParse(accountId);
  if (!id.success) return { error: 'Choose an account first.' };
  try {
    const { db } = await membership(HQ_WORKSPACE_ID);
    // Query this account directly so older answers do not disappear behind the
    // recent-deliveries list's workspace-wide limit. RLS enforces HQ membership.
    const [ads, website] = await Promise.all([
      db.from('hq_ad_receipts').select('provider,external_id,form_id,submitted_at,attribution')
        .eq('workspace_id', HQ_WORKSPACE_ID).eq('account_id', id.data).eq('status', 'received')
        .order('submitted_at', { ascending: false }).limit(1000),
      db.from('hq_intake_receipts').select('submission_id,form_id,submitted_at,attribution')
        .eq('workspace_id', HQ_WORKSPACE_ID).eq('account_id', id.data)
        .order('submitted_at', { ascending: false }).limit(1000),
    ]);
    if (ads.error || website.error) throw new Error('read_failed');
    if (ads.data.length === 1000 || website.data.length === 1000) return { error: 'This account has too many submissions to display. Contact your administrator.' };
    const responses: FormResponse[] = [
      ...ads.data.map(r => ({ id: `${r.provider}:${r.external_id}`, source: r.provider === 'meta' ? 'Meta' : 'Google Ads',
        formId: r.form_id, formName: typeof r.attribution.form_name === 'string' ? r.attribution.form_name : 'Lead form',
        submittedAt: r.submitted_at, answers: responseAnswers(r.attribution),
        campaign: typeof r.attribution.campaign_name === 'string' ? r.attribution.campaign_name : '',
        ad: typeof r.attribution.ad_name === 'string' ? r.attribution.ad_name : '' })),
      ...website.data.map(r => ({ id: `website:${r.submission_id}`, source: 'Website', formId: r.form_id,
        formName: typeof r.attribution.form === 'string' ? r.attribution.form : 'Website inquiry',
        submittedAt: r.submitted_at, answers: responseAnswers(r.attribution, true),
        campaign: typeof r.attribution['UTM Campaign'] === 'string' ? r.attribution['UTM Campaign'] : '', ad: '' })),
    ];
    responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return { responses };
  } catch { return { error: 'Form responses could not load. Please retry.' }; }
}
