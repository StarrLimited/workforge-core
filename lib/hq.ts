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
export type HQData = { role: Role; accounts: HQAccount[]; implementations: HQImplementation[]; tasks: HQTask[]; engagements: HQEngagement[]; events: HQEvent[]; activity: HQActivity[] };

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
