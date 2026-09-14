import test from 'node:test';
import assert from 'node:assert/strict';
import { googleSignInEnabled } from '../lib/auth-providers.ts';

test('Google sign-in follows the project provider setting without a deployment flag', async () => {
  let request;
  const check = settings => googleSignInEnabled({ supabaseUrl: 'https://example.invalid', publishableKey: 'public-fixture', fetcher: async (url, options) => {
    request = { url: url.href, options }; return Response.json(settings);
  } });
  assert.equal(await check({ external: { google: false } }), false);
  assert.equal(await check({ external: { google: true } }), true);
  assert.equal(request.url, 'https://example.invalid/auth/v1/settings');
  assert.equal(request.options.headers.apikey, 'public-fixture');
  assert.equal(request.options.cache, 'no-store');
  assert.equal(await check({ external: { google: 'true' } }), false);
});

test('Unknown or unavailable provider configuration does not advertise a broken Google option', async () => {
  assert.equal(await googleSignInEnabled({}), false);
  for (const fetcher of [async () => new Response('unavailable', { status: 503 }), async () => Response.json({}), async () => { throw new Error('timeout'); }]) {
    assert.equal(await googleSignInEnabled({ supabaseUrl: 'https://example.invalid', publishableKey: 'public-fixture', fetcher }), false);
  }
});
