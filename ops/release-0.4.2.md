# WorkForge Field 0.4.2 — Luna default

All three assistants (consultation summary, estimate draft and production handoff) use `openai/gpt-5.6-luna`. This is a deliberate model selection, not an automatic upgrade alias. No premium model fallback is configured.

## Usage accounting and deployment

- Verified base pricing on 2026-09-14: $0.20 per million input tokens and $1.20 per million output tokens, including billed reasoning tokens. Source: https://vercel.com/ai-gateway/models/gpt-5.6-luna
- Each reservation records its model and input/output rates. Settlement uses those saved rates, with six decimal places of precision in estimated cents. Cached-input discounts are conservatively ignored; this remains an estimate rather than a provider invoice.
- The API explicitly passes its model to the reservation and checks the returned model before generation. New models require an intentional code/rate update and validation.
- Migration `20260914033708_field_ai_luna.sql` was applied to WorkForge Supabase before the application rollout. The legacy three-argument reservation keeps Astra and its $10/$50 rates for existing deployments and rollback. Existing failed requests keep their original history and conservative quota holds.
- The existing limits remain 20 starts/day, $10/month estimated workspace budget and a temporary $1 reservation/request; completed requests settle at a minimum of one cent of quota. These are internal controls, not customer charges. Prompt size, output limit, timeout and review/apply protections remain in place.

## Verification

- 28 JavaScript tests passed, including real Gateway SDK request serialization with mocked responses for all three Luna assistants, structured output, reasoning-token usage and no premium fallback.
- TypeScript and production build passed; diff whitespace check passed.
- Nine database integration checks passed using synthetic identities and responses in a rolled-back transaction. Includes Luna fractional-cent accounting, old-deployment Astra accounting, unknown-model rejection, workspace isolation, budget/concurrency limits, approved-estimate locks and review/apply behavior.
- Existing production history was checked after the migration: four failed Astra drafts retain the original $10/$50 rate snapshot. No synthetic test data persisted.

## Live verification still required

The server credential is only available in Vercel Production, and the current browser has no authenticated WorkForge session. No live provider success is claimed by these tests. After deployment, request a fresh draft from a signed-in account and inspect its saved status/model/token usage. Historical failed drafts remain visible and are not retried automatically. Model/credit eligibility is still enforced by AI Gateway.
