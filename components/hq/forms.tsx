'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { HQ_OWNERS, HQ_SOURCES, HQ_SERVICES, HQ_SERVICE_LABELS, HQ_DELIVERY, HQ_DELIVERY_LABELS, HQ_STAGES, HQ_STAGE_LABELS,
  type HQAccount, type HQData, type HQEngagement, type HQEvent, type HQImplementation, type HQTask, type HQSupportPlan, type HQTicket, type HQSubscription } from '@/lib/hq';

export type HQForm = { kind: 'account'; record?: HQAccount } | { kind: 'task'; record?: HQTask; accountId?: string; implementationId?: string }
  | { kind: 'engagement'; record?: HQEngagement; accountId?: string } | { kind: 'event'; record?: HQEvent; accountId?: string }
  | { kind: 'implementation'; record: HQImplementation } | { kind: 'stage'; record: HQAccount }
  | {kind:'support_plan'; record?:HQSupportPlan; accountId?:string} | {kind:'ticket'; record?:HQTicket; accountId?:string}
  | {kind:'subscription'; record?:HQSubscription; accountId?:string};

export function HQDialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="hq-dialog" aria-label={title} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}
  </dialog>;
}

function Owner({ value = 'Shawn' }: { value?: string }) { return <label>Owner<select name="owner" defaultValue={value}>{HQ_OWNERS.map(o => <option key={o}>{o}</option>)}</select></label>; }
function AccountPicker({ data, value = '', required = false }: { data: HQData; value?: string | null; required?: boolean }) {
  return <label>Account<select name="account_id" required={required} defaultValue={value ?? ''}><option value="">{required ? 'Choose an account' : 'Internal / no account'}</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.company}</option>)}</select></label>;
}
function localDateTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
const titles = { account: 'Account', task: 'Task', engagement: 'Commercial agreement', event: 'Calendar event', implementation: 'Implementation', stage: 'Sales stage', support_plan:'Support handoff',ticket:'Support ticket',subscription:'Subscription' };

export function HQRecordForm({ form, data, busy, error, onSubmit, onClose }: {
  form: HQForm; data: HQData; busy: boolean; error: string; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onClose: () => void;
}) {
  return <HQDialog title={`${form.record ? 'Update' : 'New'} ${titles[form.kind].toLowerCase()}`} onClose={onClose} busy={busy}>
    <form className="hq-form" onSubmit={onSubmit}>
      <fieldset disabled={busy}>
        {form.record && <><input type="hidden" name="id" value={form.record.id}/><input type="hidden" name="updated_at" value={form.record.updated_at}/></>}
        {form.kind === 'account' && <>
          <div className="hq-form-grid"><label>Company<input name="company" required maxLength={200} defaultValue={form.record?.company}/></label><label>Contact name<input name="contact_name" required maxLength={200} defaultValue={form.record?.contact_name}/></label>
            <label>Email<input name="email" type="email" maxLength={254} defaultValue={form.record?.email}/></label><label>Phone<input name="phone" type="tel" maxLength={40} defaultValue={form.record?.phone}/></label>
            <label>Lead source<select name="source" defaultValue={form.record?.source ?? 'Website'}>{HQ_SOURCES.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Product interest<select name="product" defaultValue={form.record?.product ?? 'undecided'}><option value="undecided">To be determined</option><option value="field">Field OS</option><option value="core">Core / custom system</option><option value="both">Field OS + Core</option></select></label>
            <Owner value={form.record?.owner}/><label>Follow-up date<input name="due_on" type="date" required defaultValue={form.record?.due_on ?? ''}/></label></div>
          <label>Next action<input name="next_action" required maxLength={300} placeholder="Call to understand their current workflow" defaultValue={form.record?.next_action}/></label>
          <label>Requirements / agreed scope<textarea name="scope" rows={4} maxLength={20000} defaultValue={form.record?.scope}/></label>
          <label>Internal notes<textarea name="notes" rows={3} maxLength={20000} defaultValue={form.record?.notes}/></label>
          <p className="hq-hint">Add a phone number or email so the team can follow up.</p>
        </>}
        {form.kind === 'stage' && <><input type="hidden" name="expected_stage" value={form.record.stage}/>
          <label>Sales stage<select name="stage" defaultValue={form.record.stage}>{HQ_STAGES.map(s => <option key={s} value={s}>{HQ_STAGE_LABELS[s]}</option>)}</select></label>
          <label>Reason if lost<textarea name="lost_reason" rows={3} maxLength={1000} defaultValue={form.record.lost_reason}/></label>
          <p className="hq-hint">Use Sales & delivery to prepare and accept an agreement. Acceptance creates the scoped project and checklist; a manually entered fee does not authorize a build.</p>
        </>}
        {form.kind === 'implementation' && <><div className="hq-form-grid"><label>Status<select name="status" defaultValue={form.record.status}>{HQ_DELIVERY.map(s => <option key={s} value={s}>{HQ_DELIVERY_LABELS[s]}</option>)}</select></label><Owner value={form.record.owner}/></div>
          <label>Target launch date<input name="target_on" type="date" defaultValue={form.record.target_on ?? ''}/></label><label>Blocker / information needed<textarea name="blocker" rows={3} maxLength={3000} defaultValue={form.record.blocker}/></label>
          <p className="hq-hint">Complete the checklist, clear blockers and record the support handoff from the account before moving to Live. Launch creates a customer check-in task.</p>
        </>}
        {form.kind === 'task' && <><label>Task<input name="title" required maxLength={300} defaultValue={form.record?.title}/></label>
          {(form.record?.implementation_id || form.implementationId) ? <><input type="hidden" name="account_id" value={form.record?.account_id ?? form.accountId ?? ''}/><p className="hq-hint">Linked to this customer’s implementation.</p></> : <AccountPicker data={data} value={form.record?.account_id ?? form.accountId}/>}
          <input type="hidden" name="implementation_id" value={form.record?.implementation_id ?? form.implementationId ?? ''}/>
          <div className="hq-form-grid"><Owner value={form.record?.owner}/><label>Due date<input name="due_on" required type="date" defaultValue={form.record?.due_on ?? ''}/></label></div></>}
        {form.kind === 'engagement' && <><AccountPicker data={data} required value={form.record?.account_id ?? form.accountId}/>
          <label>Service<select name="service" defaultValue={form.record?.service ?? 'implementation'}>{HQ_SERVICES.map(s => <option key={s} value={s}>{HQ_SERVICE_LABELS[s]}</option>)}</select></label>
          <label>Description<input name="description" required maxLength={500} defaultValue={form.record?.description}/></label>
          <div className="hq-form-grid"><label>Billing basis<select name="cadence" defaultValue={form.record?.cadence ?? 'one_time'}><option value="one_time">One-time fee</option><option value="monthly">Monthly fee</option><option value="annual">Annual fee</option></select></label>
            <label>Status<select name="status" defaultValue={form.record?.status ?? 'proposed'}><option value="proposed">Proposed</option><option value="agreed">Agreed</option><option value="ended">Ended / cancelled</option></select></label>
            <label>Fee ($)<input name="amount" type="number" step="0.01" min="0.01" required defaultValue={form.record ? form.record.amount_cents / 100 : ''}/></label>
            <label>Paid toward one-time fee ($)<input name="paid" type="number" step="0.01" min="0" required defaultValue={form.record ? form.record.paid_cents / 100 : 0}/></label></div>
          <p className="hq-hint">Enter 0 paid for recurring fees. These records track commitments and manually recorded payments; they do not send invoices or charge customers.</p></>}
        {form.kind === 'event' && <><label>Event title<input name="title" required maxLength={200} defaultValue={form.record?.title}/></label>
          <div className="hq-form-grid"><AccountPicker data={data} value={form.record?.account_id ?? form.accountId}/><Owner value={form.record?.owner}/>
            <label>Starts<input type="datetime-local" name="starts_at" required defaultValue={localDateTime(form.record?.starts_at)}/></label><label>Ends<input type="datetime-local" name="ends_at" required defaultValue={localDateTime(form.record?.ends_at)}/></label></div>
          <label>Notes<textarea name="notes" rows={3} maxLength={3000} defaultValue={form.record?.notes}/></label><p className="hq-hint">Enter times in your device’s local time. The calendar displays Mountain Time.</p></>}
        {form.kind === 'support_plan' && <><AccountPicker data={data} required value={form.record?.account_id??form.accountId}/><div className="hq-form-grid"><Owner value={form.record?.owner}/><label>Next customer review<input name="next_review_on" type="date" required defaultValue={form.record?.next_review_on??''}/></label></div><label>Agreed support terms<textarea name="terms" required rows={5} maxLength={5000} placeholder="Coverage, contact method, response expectations, included work and exclusions. State if support is ad hoc." defaultValue={form.record?.terms}/></label><p className="hq-hint">Record the actual agreement. This does not enroll the customer in a paid support plan or send a message.</p></>}
        {form.kind === 'ticket' && <><AccountPicker data={data} required value={form.record?.account_id??form.accountId}/><label>Issue<input name="title" required maxLength={300} defaultValue={form.record?.title}/></label><label>Description / investigation notes<textarea name="description" rows={4} maxLength={20000} defaultValue={form.record?.description}/></label><div className="hq-form-grid"><Owner value={form.record?.owner??data.supportPlans.find(p=>p.account_id===form.accountId)?.owner}/><label>Priority<select name="priority" defaultValue={form.record?.priority??'normal'}>{['urgent','high','normal','low'].map(v=><option key={v}>{v}</option>)}</select></label><label>Status<select name="status" defaultValue={form.record?.status??'open'}>{['open','in_progress','waiting_customer','resolved'].map(v=><option key={v} value={v}>{v.replaceAll('_',' ')}</option>)}</select></label><label>First response due<input name="response_due_at" type="datetime-local" required defaultValue={localDateTime(form.record?.response_due_at)}/></label><label>First response sent<input name="first_response_at" type="datetime-local" defaultValue={localDateTime(form.record?.first_response_at??undefined)}/></label></div><label>Resolution<textarea name="resolution" rows={4} maxLength={10000} defaultValue={form.record?.resolution}/></label><p className="hq-hint">Times use your device’s local timezone. Record a resolution before closing. Entering a first response records a message already sent.</p></>}
        {form.kind === 'subscription' && <><AccountPicker data={data} required value={form.record?.account_id??form.accountId}/><label>Plan / product<input name="plan" required maxLength={200} defaultValue={form.record?.plan}/></label><div className="hq-form-grid"><label>Service<select name="service" defaultValue={form.record?.service??'software'}><option value="software">Software</option><option value="support">Managed support</option></select></label><label>Billing cadence<select name="cadence" defaultValue={form.record?.cadence??'monthly'}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label><label>Recurring fee ($)<input name="amount" required type="number" min="0.01" step="0.01" defaultValue={form.record?form.record.amount_cents/100:''}/></label><label>Status<select name="status" defaultValue={form.record?.status??'pending'}>{['pending','trial','active','paused','cancelled'].map(v=><option key={v}>{v}</option>)}</select></label><label>Start date<input name="starts_on" required type="date" defaultValue={form.record?.starts_on}/></label><label>Next renewal<input name="renews_on" required type="date" defaultValue={form.record?.renews_on}/></label><label>End date (if ending)<input name="ends_on" type="date" defaultValue={form.record?.ends_on??''}/></label><label>Payment status<select name="payment_status" defaultValue={form.record?.payment_status??'unknown'}><option value="unknown">Not verified</option><option value="current">Current</option><option value="past_due">Past due</option></select></label></div><label>Terms / change notes<textarea name="notes" rows={3} maxLength={10000} defaultValue={form.record?.notes}/></label><p className="hq-hint">Internal tracking only. Activation does not charge the customer. Cancellation requires an end date. For a plan change, end the previous record and add the replacement to preserve terms.</p></>}
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <footer><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
    </form>
  </HQDialog>;
}
