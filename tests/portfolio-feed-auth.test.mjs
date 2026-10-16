import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyStarrPortfolioFeed } from '../lib/portfolio-feed-auth.ts';

test('calendar authorization verifies the user, active profile, and current company access', async (t) => {
  let scenario = 'allowed';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url || input.toString());
    requests.push(url);
    if (url.pathname === '/auth/v1/user') {
      if (scenario === 'revoked') return Response.json({ message: 'Invalid token' }, { status: 401 });
      return Response.json({ id: 'verified-user', email: 'shawn@starrlimited.com', aud: 'authenticated', role: 'authenticated' });
    }
    if (url.pathname.endsWith('/portal_user_profiles')) {
      assert.equal(url.searchParams.get('email'), 'eq.shawn@starrlimited.com');
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      return Response.json(scenario === 'inactive' ? null : { id: 'profile', role: 'owner', is_active: true, full_name: 'Shawn Starr' });
    }
    if (url.pathname.endsWith('/portal_user_company_access')) {
      assert.equal(url.searchParams.get('profile_id'), 'eq.profile');
      assert.equal(url.searchParams.get('company_id'), 'eq.workforge');
      assert.equal(url.searchParams.get('is_active'), 'eq.true');
      return Response.json(scenario === 'no-access' ? null : { is_active: true, company_role: 'owner' });
    }
    throw new Error('Unexpected request');
  });
  assert.equal(await verifyStarrPortfolioFeed(null), null);
  assert.equal(requests.length, 0);
  scenario = 'revoked';
  assert.equal(await verifyStarrPortfolioFeed('Bearer test-token'), null);
  assert.equal(requests.length, 1);
  scenario = 'inactive';
  assert.equal(await verifyStarrPortfolioFeed('Bearer test-token'), null);
  scenario = 'no-access';
  assert.equal(await verifyStarrPortfolioFeed('Bearer test-token'), null);
  scenario = 'allowed';
  assert.deepEqual(await verifyStarrPortfolioFeed('Bearer test-token'), { email: 'shawn@starrlimited.com', fullName: 'Shawn Starr', role: 'owner' });
});
