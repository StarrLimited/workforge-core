# WorkForge Field 0.4.1 — actionable AI connection errors

Three live consultation requests failed before any token usage was recorded. The 0.4.0 handler collapsed HTTP 401, 402 and 403 into the same setup message and discarded the original cause. Adding a Gateway key and redeploying did not resolve the third request. Its exact provider rejection cannot be reconstructed from the saved data.

The real SDK tests also exposed a second loss of detail: AI SDK 7's `wrapGatewayError` replaces GatewayAuthenticationError without retaining its HTTP status or cause. Model middleware now preserves the original provider rejection in a server-only error cause before that replacement occurs. It does not change the request, credential or provider response.

This patch follows the installed Gateway error shapes, including the original APICallError response body nested beneath contextual authentication errors. It classifies authentication, credits, spending limits, model plan restrictions, access rules, missing models, rate limits, timeouts, invalid requests and invalid output separately. Messages are fixed application text; no raw provider text is returned or logged.

Saved error messages include a support reference, HTTP status when supplied, and whether the deployed server had an API key or attempted Vercel identity. Structured runtime logs record the draft ID, model, category, HTTP status, credential mode, timings and token counts. They omit key values, execution tokens, headers, prompts, customer details, raw error objects and stacks.

No model, generation permissions, job data, pricing, quota accounting, automatic retries or database schema changes are included. Old failure records retain their original messages. Failed calls with unknown usage continue to hold the conservative application budget reservation; this is not proof of a provider charge.

## Validation

The new SDK tests use a local mock fetch with the real Gateway provider and simulate 401/402/403/404/429 responses. They verify billing and free-tier errors are recovered from nested contextual authentication errors, each rejection makes only one HTTP attempt, and diagnostics exclude embedded secrets and customer text. Malformed and cyclic cause chains are covered separately.

All 27 unit/SDK tests, the TypeScript check, the production Next.js build and `git diff --check` passed. No live provider success is claimed.

## Remaining live check

After deploying 0.4.1, generate one consultation draft from an authenticated demo job. Inspect the newly saved reference, not an older failed draft. Live AI activation remains unverified until a real request succeeds. Vercel project access remains unavailable through the connected app, so runtime settings and Gateway billing must be checked by the account owner when the new evidence identifies the required action.

Official documentation checked on 2026-09-13:
- https://vercel.com/docs/ai-gateway/authentication-and-byok
- https://vercel.com/docs/ai-gateway/pricing
