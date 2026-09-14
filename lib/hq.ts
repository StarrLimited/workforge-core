import type { Role } from './core';

export const HQ_WORKSPACE_ID = '8ac08858-038c-41df-90a8-4a84f25cb400';
export const HQ_STAGES = ['new', 'discovery', 'blueprint', 'proposal', 'won', 'lost'] as const;
export type HQStage = typeof HQ_STAGES[number];
export const HQ_STAGE_LABELS: Record<HQStage, string> = {
  new: 'New inquiry', discovery: 'Discovery', blueprint: 'Blueprint', proposal: 'Proposal', won: 'Won', lost: 'Lost',
};
export const HQ_OWNERS = ['Shawn', 'Neil'] as const;
export const HQ_SOURCES = ['Website', 'Google Ads', 'Google LSA', 'Meta', 'Print', 'Referral', 'Outbound', 'Other'] as const;
export const HQ_SERVICES = ['blueprint', 'implementation', 'migration', 'support'] as const;
export const HQ_SERVICE_LABELS = { blueprint: 'Blueprint', implementation: 'Implementation / custom build', migration: 'Data migration', support: 'Managed support' };
export const HQ_DELIVERY = ['onboarding', 'building', 'testing', 'ready', 'live', 'on_hold'] as const;
export const HQ_DELIVERY_LABELS = { onboarding: 'Onboarding', building: 'Building', testing: 'Testing', ready: 'Ready to launch', live: 'Live', on_hold: 'On hold' };
export type HQAccount = {
  id: string; company: string; contact_name: string; email: string; phone: string; source: string;
  product: 'field' | 'core' | 'both' | 'undecided'; stage: HQStage; owner: string; next_action: string;
  due_on: string | null; scope: string; notes: string; lost_reason: string; created_at: string; updated_at: string;
};
export type HQImplementation = { id: string; account_id: string; status: typeof HQ_DELIVERY[number]; owner: string; target_on: string | null; scope_snapshot: string; blocker: string; updated_at: string };
export type HQTask = { id: string; account_id: string | null; implementation_id: string | null; title: string; owner: string; due_on: string | null; completed: boolean; updated_at: string };
export type HQEngagement = { id: string; account_id: string; service: typeof HQ_SERVICES[number]; description: string; cadence: 'one_time' | 'monthly'; amount_cents: number; paid_cents: number; status: 'proposed' | 'agreed' | 'ended'; updated_at: string };
export type HQEvent = { id: string; account_id: string | null; title: string; owner: string; starts_at: string; ends_at: string; notes: string; updated_at: string };
export type HQActivity = { id: string; action: string; created_at: string };
export type HQSupportPlan = { id: string; account_id: string; owner: string; terms: string; next_review_on: string; launched_at: string | null; updated_at: string };
export type HQTicket = { id: string; account_id: string; title: string; description: string; priority: 'urgent' | 'high' | 'normal' | 'low'; status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved'; owner: string; response_due_at: string; first_response_at: string | null; resolution: string; resolved_at: string | null; updated_at: string };
export type HQSubscription = { id: string; account_id: string; plan: string; service: 'software' | 'support'; cadence: 'monthly' | 'annual'; amount_cents: number; status: 'pending' | 'trial' | 'active' | 'paused' | 'cancelled'; starts_on: string; renews_on: string; ends_on: string | null; payment_status: 'unknown' | 'current' | 'past_due'; notes: string; updated_at: string };
export type HQAdIntegration = { provider: 'google_ads' | 'meta'; enabled: boolean; default_owner: string; page_id: string; form_ids: string[]; last_received_at: string | null; last_test_at: string | null; last_error: string };
export type HQAdReceipt = { provider: string; external_id: string; account_id: string | null; form_id: string; status: string; error_code: string; attribution: Record<string, unknown>; updated_at: string };
export type HQData = { role: Role; accounts: HQAccount[]; implementations: HQImplementation[]; tasks: HQTask[]; engagements: HQEngagement[]; events: HQEvent[]; activity: HQActivity[]; supportPlans: HQSupportPlan[]; tickets: HQTicket[]; subscriptions: HQSubscription[]; adIntegrations: HQAdIntegration[]; adReceipts: HQAdReceipt[] };

export function subscriptionMRR(subscriptions: HQSubscription[], today: string) {
  return subscriptions.filter(s => s.status === 'active' && s.starts_on <= today && (!s.ends_on || s.ends_on > today))
    .reduce((total, s) => total + (s.cadence === 'annual' ? s.amount_cents / 12 : s.amount_cents), 0);
}

export function workflowIssues(d: HQData, today: string) {
  const issues: { accountId: string; message: string }[] = [];
  for (const a of d.accounts) {
    const i = d.implementations.find(i => i.account_id === a.id);
    if (a.stage === 'won' && !i) issues.push({ accountId: a.id, message: 'Won account has no implementation.' });
    if (i && !i.target_on && i.status !== 'live') issues.push({ accountId: a.id, message: 'Set the implementation target date.' });
    if (i?.blocker) issues.push({ accountId: a.id, message: i.blocker });
    if (i && i.status !== 'live' && i.target_on && i.target_on < today) issues.push({ accountId: a.id, message: 'Implementation target date is overdue.' });
    if (i && !d.supportPlans.some(p => p.account_id === a.id)) issues.push({ accountId: a.id, message: 'Define the support handoff before launch.' });
  }
  return issues;
}

export function hqMetrics(data: Pick<HQData, 'accounts' | 'implementations' | 'tasks' | 'engagements'>, today: string) {
  const agreed = data.engagements.filter(e => e.status === 'agreed');
  return {
    openLeads: data.accounts.filter(a => !['won', 'lost'].includes(a.stage)).length,
    activeImplementations: data.implementations.filter(i => !['live', 'on_hold'].includes(i.status)).length,
    monthlyCommitted: agreed.filter(e => e.cadence === 'monthly').reduce((n, e) => n + e.amount_cents, 0),
    oneTimeAgreed: agreed.filter(e => e.cadence === 'one_time').reduce((n, e) => n + e.amount_cents, 0),
    oneTimeOutstanding: agreed.filter(e => e.cadence === 'one_time').reduce((n, e) => n + Math.max(0, e.amount_cents - e.paid_cents), 0),
    overdue: data.tasks.filter(t => !t.completed && t.due_on && t.due_on < today).length
      + data.accounts.filter(a => !['won', 'lost'].includes(a.stage) && a.due_on && a.due_on < today).length,
  };
}

export function hqDay(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}
