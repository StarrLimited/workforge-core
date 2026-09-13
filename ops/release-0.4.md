# WorkForge Field 0.4 — reviewed AI drafts

The consultation, estimate and production tabs now have job-specific AI assistants. Generation saves a draft first; a reviewer must explicitly apply it. Existing manual workflows continue to work if AI is unavailable.

- Consultation summaries save separately from original goals, measurements, access and site notes. AI does not mark consultations complete.
- Estimate drafts select active workspace pricebook IDs. Missing measurements produce blank quantities that block applying the draft until reviewed. Database code rebuilds costs and selling prices from the current pricebook and job margin, preserving the job's tax, discount, deposit and terms. Applying replaces editable draft items; approved estimates stay locked.
- Production handoffs use the approved scope, append reviewed notes and add selected tasks. Repeated application is idempotent and matching task titles are skipped. AI does not issue orders, assign crews, advance stages, send messages or approve customer work.
- Saved drafts have authenticated URLs at `/ai/drafts/[id]`. The result, reviewed result, source snapshot, requester, model, prompt version, token counts, estimated cost and timestamps are persisted. Failures are visible and isolated from the job editor.

## Connection and cost controls

The server uses AI SDK 7.0.99 through Vercel AI Gateway with `openai/gpt-6-astra`, low reasoning effort, a 4,000-token output ceiling, a 65-second timeout and no SDK retries. On Vercel the gateway uses the deployment's OIDC identity. Elsewhere configure `AI_GATEWAY_API_KEY` on the server. Never expose it as a `NEXT_PUBLIC_` variable. Gateway access and credits must be available to the deployment team.

The current model catalog was checked at `https://ai-gateway.vercel.sh/v1/models` on 2026-09-13. Estimated usage uses $10/million input tokens and $50/million output tokens, conservatively ignoring cached-input discounts. System and reference text is limited to 48,000 UTF-8 bytes; output and schema overhead fit within the $1 per-request budget reservation at these rates. This is an application estimate, not a provider billing guarantee; review rates if changing models.

Each workspace permits one pending generation at a time, 20 starts/day and $10/month in estimated/reserved usage (UTC periods). Finished usage settles the reservation, rounded up to cents. Failures without measured usage retain their reservation conservatively. Pending requests older than three minutes can be replaced and are marked failed on the next successful reservation. Completion requires a secret execution capability returned only to the server; it is not sent to the UI. Database limits serialize reservation checks with a workspace advisory lock.

## Verification

- Production build and TypeScript check passed.
- 25 unit/SDK tests passed. SDK provider mocks exercise structured responses, malformed output, preserved usage on validation failure, pricing, unknown/duplicate/cross-workspace products, unresolved quantities, prompt minimization and safe errors. They are not live provider tests.
- `tests/ai-assistance-integration.sql` passed against Supabase in a rolled-back transaction with fictional users and records. Checks cover authorization/RLS, execution capability, concurrent-run limits, cost accounting, stale snapshots, deterministic database pricing, approved-estimate locks, atomic handoff apply, duplicate prevention and monthly/daily caps.
- The live portal renders the sign-in page in the controlled browser. No authenticated live AI request has been completed. Vercel connector access to the project is unavailable, so deployment runtime credits/auth could not be inspected through that connector.
- A local component layout fixture was attempted, but the controlled browser blocked localhost with `ERR_BLOCKED_BY_CLIENT`; the temporary fixture was removed. No visual verification of the new panels is claimed.
- The private execution-capability table intentionally has RLS with no client policy and no client grants; only explicitly authorized private functions can access it. This produces an informational [RLS/no-policy advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). The existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains unchanged.

## First live check

In the development portal, save a fictional job's consultation notes, open **Summarize consultation**, and select **Generate new draft**. Review the result and save it. If the panel reports that AI connection setup is needed, check the team's Vercel AI Gateway access and credits; alternatively configure a scoped gateway key on the server and redeploy. No API secret needs to be pasted into chat. Then draft and review an estimate, approve through the existing demo workflow, and prepare the production handoff.

The database migration is additive. Rolling back the frontend leaves existing job data and saved AI drafts intact. Disable generation by removing the assistant UI/route or revoking the reserve RPC; do not remove job records to roll back this feature.
