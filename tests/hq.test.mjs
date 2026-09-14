import test from 'node:test';
import assert from 'node:assert/strict';
import { hqMetrics } from '../lib/hq.ts';

const base = { accounts: [], tasks: [], implementations: [], engagements: [] };
test('HQ separates recurring commitments from one-time collections and proposed fees', () => {
  const actual = hqMetrics({ ...base, engagements: [
    { status: 'agreed', cadence: 'monthly', amount_cents: 29900, paid_cents: 0 },
    { status: 'agreed', cadence: 'one_time', amount_cents: 250000, paid_cents: 100000 },
    { status: 'proposed', cadence: 'monthly', amount_cents: 99900, paid_cents: 0 },
    { status: 'ended', cadence: 'one_time', amount_cents: 400000, paid_cents: 0 },
  ] }, '2026-09-14');
  assert.equal(actual.monthlyCommitted, 29900);
  assert.equal(actual.oneTimeAgreed, 250000);
  assert.equal(actual.oneTimeOutstanding, 150000);
});
test('HQ attention counts open overdue actions, excluding closed accounts and completed tasks', () => {
  const actual = hqMetrics({ ...base, accounts: [
    { stage: 'new', due_on: '2026-09-13' }, { stage: 'won', due_on: '2026-09-12' },
    { stage: 'lost', due_on: '2026-09-12' }, { stage: 'proposal', due_on: '2026-09-14' },
  ], tasks: [ { completed: false, due_on: '2026-09-13' }, { completed: true, due_on: '2026-09-12' } ] }, '2026-09-14');
  assert.equal(actual.overdue, 2);
  assert.equal(actual.openLeads, 2);
});
test('HQ delivery totals distinguish active work from live and paused accounts', () => {
  const actual = hqMetrics({ ...base, implementations: [{ status: 'onboarding' }, { status: 'testing' }, { status: 'live' }, { status: 'on_hold' }] }, '2026-09-14');
  assert.equal(actual.activeImplementations, 2);
});
