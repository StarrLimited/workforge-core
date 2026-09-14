import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createHandler, normalizeSubmission, SITE_ID } from '../supabase/functions/hq-webflow-intake/handler.mjs';

const payload = () => ({ triggerType: 'form_submission', payload: {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa', siteId: SITE_ID, formId: '6aa768c8b75121eb407fc9b7', name: 'Email Form', submittedAt: '2026-09-14T06:00:00Z',
  data: { 'Full Name': 'Test Contact', Company: 'Test Company', Email: 'test@example.invalid', Phone: '+1 303 555 0100', 'Workflow Notes': 'Track jobs', 'Lead Source': 'Website inquiry', 'UTM Source': 'google', 'UTM Medium': 'cpc', 'UTM Campaign': 'test-campaign', 'Landing Page': '/custom-crm', 'Business Type': 'Construction' },
} });
test('Webflow maps actual form IDs, phone, requirements and attribution', () => {
  const result = normalizeSubmission(payload());
  assert.equal(result.source, 'Google Ads'); assert.equal(result.phone, '+1 303 555 0100');
  assert.equal(result.scope, 'Track jobs'); assert.equal(result.attribution.form, 'Custom CRM');
  assert.match(result.notes, /UTM Campaign: test-campaign/); assert.match(result.notes, /Business Type: Construction/);
});
test('Cookie forms are ignored; foreign sites and malformed or oversized leads are rejected', () => {
  const cookie = payload(); cookie.payload.formId = 'other'; assert.equal(normalizeSubmission(cookie).status, 'ignored');
  const wrong = payload(); wrong.payload.siteId = 'other'; assert.throws(() => normalizeSubmission(wrong));
  const invalid = payload(); invalid.payload.data.Email = 'bad'; assert.throws(() => normalizeSubmission(invalid));
  const long = payload(); long.payload.data.Phone = '1'.repeat(41); assert.throws(() => normalizeSubmission(long));
});
test('Webhook authenticates with a hash and propagates only successful persistence', async () => {
  const key = 'a'.repeat(64); let calls = 0; let rpc;
  const handler = createHandler({ supabaseUrl: 'https://example.invalid', serviceKey: 'server-only-fixture', fetcher: async (url, options) => {
    calls++; rpc = JSON.parse(options.body); return Response.json({ status: 'created' });
  } });
  const request = (query = '', body = payload()) => new Request(`https://example.invalid/intake${query}`, { method: 'POST', body: JSON.stringify(body) });
  assert.equal((await handler(request())).status, 401); assert.equal(calls, 0);
  assert.equal((await handler(request(`?key=${key}`))).status, 200);
  assert.equal(rpc.p_key_hash, createHash('sha256').update(key).digest('hex'));
  assert.ok(!JSON.stringify(rpc).includes(key));
  const denied = createHandler({ supabaseUrl: 'https://example.invalid', serviceKey: 'fixture', fetcher: async () => Response.json({ status: 'unauthorized' }) });
  assert.equal((await denied(request(`?key=${key}`))).status, 401);
  const failed = createHandler({ supabaseUrl: 'https://example.invalid', serviceKey: 'fixture', fetcher: async () => new Response('database unavailable', { status: 500 }) });
  assert.equal((await failed(request(`?key=${key}`))).status, 503);
  const tooLarge = new Request(`https://example.invalid/intake?key=${key}`, { method: 'POST', body: 'a'.repeat(65537) });
  assert.equal((await handler(tooLarge)).status, 413);
});
