import test from 'node:test';
import assert from 'node:assert/strict';
import { authRedirectUrl, signInCallbackUrl } from '../lib/auth-redirect.ts';

const portal = 'https://workforge-development.vercel.app';

test('email requests return to the current portal callback', () => {
  assert.equal(signInCallbackUrl(`${portal}/login?error=callback`), `${portal}/auth/callback`);
});

test('successful and failed callbacks ignore the mistyped configured app URL', () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://workforge-development.vercel.ap';
  try {
    assert.equal(authRedirectUrl(`${portal}/auth/callback?code=test-only`, true).href, `${portal}/`);
    assert.equal(authRedirectUrl(`${portal}/auth/callback`, false).href, `${portal}/login?error=callback`);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test('callback destinations strip auth values and ignore external redirect parameters', () => {
  const request = `${portal}/auth/callback?token_hash=test-only&next=https://example.org&redirect_to=https://example.org#test-only`;
  assert.equal(authRedirectUrl(request, true).href, `${portal}/`);
  assert.equal(authRedirectUrl(request, false).href, `${portal}/login?error=callback`);
});

test('preview and local sign-ins remain on their own origin', () => {
  for (const origin of ['https://workforge-preview.example.com', 'http://localhost:3000']) {
    assert.equal(signInCallbackUrl(`${origin}/login`), `${origin}/auth/callback`);
    assert.equal(authRedirectUrl(`${origin}/auth/callback`, true).href, `${origin}/`);
  }
});
