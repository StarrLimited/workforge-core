'use server';

import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { membership } from '@/lib/data';
import { canWrite, moneyToCents } from '@/lib/core';
import { HQ_WORKSPACE_ID, HQ_STAGES, HQ_OWNERS, HQ_SOURCES, HQ_SERVICES, HQ_DELIVERY } from '@/lib/hq';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number) => text(max).min(1, 'Complete the required fields.');
const day = z.union([z.literal(''), z.iso.date()]).transform(v => v || null);
const uuid = z.uuid();
const linked = z.union([z.literal(''), uuid]).transform(v => v || null);
const owner = z.enum(HQ_OWNERS);
const accountSchema = z.object({ company: required(200), contact_name: required(200), email: z.union([z.literal(''), z.email()]),
  phone: text(40), source: z.enum(HQ_SOURCES), product: z.enum(['field', 'core', 'both', 'undecided']), owner,
  next_action: required(300), due_on: z.iso.date(), scope: text(20000), notes: text(20000),
}).refine(v => v.email || v.phone, { message: 'Add an email address or phone number.', path: ['email'] });

export async function mutateHQ(action: string, form: FormData): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { db, role } = await membership(HQ_WORKSPACE_ID);
  if (!canWrite(role)) return { ok: false, error: 'Your account has read-only access.' };
  const raw = Object.fromEntries(form.entries());
  try {
    let result: { error: { message: string; code?: string } | null; data?: unknown };
    const update = async (table: string, values: Record<string, unknown>) => {
      const id = uuid.parse(raw.id);
      const expected = z.iso.datetime({ offset: true }).parse(raw.updated_at);
      const res = await db.from(table).update(values).eq('workspace_id', HQ_WORKSPACE_ID).eq('id', id).eq('updated_at', expected).select('id').maybeSingle();
      if (!res.error && !res.data) throw new Error('This record has changed. Refresh and reopen it before saving.');
      return res;
    };
    if (action === 'account') {
      const values = accountSchema.parse(raw);
      result = raw.id ? await update('hq_accounts', values) : await db.from('hq_accounts').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'stage') {
      const values = z.object({ id: uuid, expected_stage: z.enum(HQ_STAGES), stage: z.enum(HQ_STAGES), lost_reason: text(1000) }).parse(raw);
      result = await db.rpc('hq_set_stage', { p_account_id: values.id, p_expected: values.expected_stage, p_stage: values.stage, p_lost_reason: values.lost_reason });
    } else if (action === 'implementation') {
      result = await update('hq_implementations', z.object({ status: z.enum(HQ_DELIVERY), owner, target_on: day, blocker: text(3000) }).parse(raw));
    } else if (action === 'task') {
      const values = z.object({ account_id: linked, implementation_id: linked, title: required(300), owner, due_on: z.iso.date() }).parse(raw);
      result = raw.id ? await update('hq_tasks', values) : await db.from('hq_tasks').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'toggle_task') {
      result = await update('hq_tasks', { completed: z.enum(['true', 'false']).parse(raw.completed) === 'true' });
    } else if (action === 'engagement') {
      const values = z.object({ account_id: uuid, service: z.enum(HQ_SERVICES), description: required(500), cadence: z.enum(['one_time', 'monthly', 'annual']),
        amount: required(30), paid: required(30), status: z.enum(['proposed', 'agreed', 'ended']) }).parse(raw);
      const amount_cents = moneyToCents(values.amount); const paid_cents = moneyToCents(values.paid);
      if (amount_cents <= 0) throw new Error('The fee must be greater than zero.');
      if (values.cadence !== 'one_time' && paid_cents !== 0) throw new Error('Payment tracking currently supports one-time fees.');
      if (values.cadence === 'one_time' && paid_cents > amount_cents) throw new Error('Recorded payments cannot exceed the fee.');
      const record = { account_id: values.account_id, service: values.service, description: values.description, cadence: values.cadence, amount_cents, paid_cents, status: values.status };
      result = raw.id ? await update('hq_engagements', record) : await db.from('hq_engagements').insert({ ...record, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'event') {
      const values = z.object({ account_id: linked, title: required(200), owner, starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }), notes: text(3000) }).parse(raw);
      if (Date.parse(values.ends_at) <= Date.parse(values.starts_at)) throw new Error('End time must be after start time.');
      result = raw.id ? await update('hq_events', values) : await db.from('hq_events').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'support_plan') {
      const values = z.object({ account_id: uuid, owner, terms: required(5000), next_review_on: z.iso.date() }).parse(raw);
      result = raw.id ? await update('hq_support_plans', values) : await db.from('hq_support_plans').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'ticket') {
      const values = z.object({ account_id: uuid, title: required(300), description: text(20000), owner,
        priority: z.enum(['urgent','high','normal','low']), status: z.enum(['open','in_progress','waiting_customer','resolved']),
        response_due_at: z.iso.datetime({ offset: true }), first_response_at: z.union([z.literal(''),z.iso.datetime({ offset: true })]).transform(v=>v||null), resolution: text(10000) }).parse(raw);
      if (values.status === 'resolved' && !values.resolution) throw new Error('Record the resolution before closing this ticket.');
      if (values.first_response_at && Date.parse(values.first_response_at) > Date.now()) throw new Error('First response cannot be in the future.');
      result = raw.id ? await update('hq_tickets', values) : await db.from('hq_tickets').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'subscription') {
      const v = z.object({ account_id: uuid, plan: required(200), service: z.enum(['software','support']), cadence: z.enum(['monthly','annual']), amount: required(30),
        status: z.enum(['pending','trial','active','paused','cancelled']), starts_on: z.iso.date(), renews_on: z.iso.date(), ends_on: day,
        payment_status: z.enum(['unknown','current','past_due']), notes: text(10000) }).parse(raw);
      const {amount,...values}=v; const amount_cents=moneyToCents(amount);
      if(amount_cents<=0) throw new Error('The fee must be greater than zero.');
      if(v.renews_on<=v.starts_on) throw new Error('Renewal must be after the start date.');
      if(v.status==='cancelled'&&!v.ends_on) throw new Error('Record the cancellation end date.');
      result = raw.id ? await update('hq_subscriptions', {...values,amount_cents}) : await db.from('hq_subscriptions').insert({ ...values,amount_cents,workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else return { ok: false, error: 'Unknown action.' };
    if (result.error) throw new Error(result.error.code === '23505' ? 'This record already exists.' : result.error.message);
    revalidatePath('/hq');
    return { ok: true, id: typeof result.data === 'object' && result.data && 'id' in result.data ? String(result.data.id) : undefined };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Check the form fields.' };
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to save. Please retry.' };
  }
}

export async function configureAdIntake(form: FormData): Promise<{ok: boolean; error?: string; key?: string}> {
  const {db,role}=await membership(HQ_WORKSPACE_ID);
  if(!['owner','administrator'].includes(role)) return {ok:false,error:'HQ administrator access required.'};
  try {
    const v=z.object({provider:z.enum(['google_ads','meta']),enabled:z.enum(['true','false']),default_owner:owner,page_id:text(100),form_ids:text(4000),app_secret:text(1000),page_token:text(8000),graph_version:text(20)}).parse(Object.fromEntries(form));
    const enabled=v.enabled==='true';
    const ids=v.form_ids.split(/[\s,]+/).filter(Boolean);
    if(enabled&&(!ids.length||ids.some(i=>!/^\d+$/.test(i)))) throw new Error('Enter the numeric lead form IDs, separated by commas.');
    const key=enabled?randomBytes(32).toString('hex'):'';
    const {error}=await db.rpc('hq_configure_ads',{p_provider:v.provider,p_values:{...v,enabled,form_ids:ids,key_hash:key?createHash('sha256').update(key).digest('hex'):''}});
    if(error) throw new Error(error.message);
    revalidatePath('/hq'); return {ok:true,key};
  } catch(e) {return {ok:false,error:e instanceof z.ZodError?'Check the connection fields.':e instanceof Error?e.message:'Unable to save connection.'};}
}

export async function retryAdIntake(externalId: string): Promise<{ok:boolean;error?:string}> {
  const {db,role}=await membership(HQ_WORKSPACE_ID);
  if(!canWrite(role)) return {ok:false,error:'HQ write access required.'};
  try {
    const external_id=required(200).parse(externalId);
    const {data:{session}}=await db.auth.getSession();
    if(!session) return {ok:false,error:'Sign in again.'};
    const res=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/hq-ad-intake?provider=meta&retry=1`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({external_id}),signal:AbortSignal.timeout(45000)});
    revalidatePath('/hq');
    return res.ok?{ok:true}:{ok:false,error:'Retry failed. Check the connection permissions and retry.'};
  } catch {return {ok:false,error:'Retry could not complete. Please try again.'};}
}
