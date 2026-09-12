import type { Partner, Purchase } from './core';

export const LEAD_SOURCES = ['Unclassified', 'Google', 'Google Ads', 'LSAs', 'Meta', 'Print', 'Referral', 'Website', 'Phone', 'Repeat customer', 'Other'];
export const DEMO_OPERATIONS_OWNERS = ['Shawn', 'Neil', 'Alex Morgan', 'Jordan Lee', 'Taylor Brooks'];
export const PARTNER_LABELS: Record<Partner['kind'], string> = {crew:'Internal Crew',subcontractor:'Subcontractor',vendor:'Vendor'};
export const ORDER_LABELS: Record<Purchase['order_kind'], string> = {materials:'Materials Purchase',subcontract:'Subcontract Work Order',internal:'Internal Work Order'};
export function partnerLabel(partner: Pick<Partner,'name'|'kind'>) { return `${partner.name} (${PARTNER_LABELS[partner.kind]})`; }
export function matchesOrderKind(kind: Purchase['order_kind'], partnerKind: Partner['kind']) {
  return partnerKind === ({materials:'vendor',subcontract:'subcontractor',internal:'crew'} as const)[kind];
}
export function purchaseStatusLabel(kind: Purchase['order_kind'], status: Purchase['status']) {
  return kind==='materials' ? ({planned:'Planned',ordered:'Ordered',received:'Received'})[status] : ({planned:'Planned',ordered:'Assigned',received:'Completed'})[status];
}
/** Keep historic/custom values selectable when introducing standard dropdown options. */
export function withCurrentOption(options: string[], current: string) { return [...new Set([...options,...(current?[current]:[])])]; }
