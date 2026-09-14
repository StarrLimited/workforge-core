'use server';

import { z } from 'zod';
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
      const values = z.object({ account_id: uuid, service: z.enum(HQ_SERVICES), description: required(500), cadence: z.enum(['one_time', 'monthly']),
        amount: required(30), paid: required(30), status: z.enum(['proposed', 'agreed', 'ended']) }).parse(raw);
      const amount_cents = moneyToCents(values.amount); const paid_cents = moneyToCents(values.paid);
      if (amount_cents <= 0) throw new Error('The fee must be greater than zero.');
      if (values.cadence === 'monthly' && paid_cents !== 0) throw new Error('Payment tracking currently supports one-time fees.');
      if (values.cadence === 'one_time' && paid_cents > amount_cents) throw new Error('Recorded payments cannot exceed the fee.');
      const record = { account_id: values.account_id, service: values.service, description: values.description, cadence: values.cadence, amount_cents, paid_cents, status: values.status };
      result = raw.id ? await update('hq_engagements', record) : await db.from('hq_engagements').insert({ ...record, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else if (action === 'event') {
      const values = z.object({ account_id: linked, title: required(200), owner, starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }), notes: text(3000) }).parse(raw);
      if (Date.parse(values.ends_at) <= Date.parse(values.starts_at)) throw new Error('End time must be after start time.');
      result = raw.id ? await update('hq_events', values) : await db.from('hq_events').insert({ ...values, workspace_id: HQ_WORKSPACE_ID }).select('id').single();
    } else return { ok: false, error: 'Unknown action.' };
    if (result.error) throw new Error(result.error.code === '23505' ? 'This record already exists.' : result.error.message);
    revalidatePath('/hq');
    return { ok: true, id: typeof result.data === 'object' && result.data && 'id' in result.data ? String(result.data.id) : undefined };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Check the form fields.' };
    return { ok: false, error: error instanceof Error ? error.message : 'Unable to save. Please retry.' };
  }
}
