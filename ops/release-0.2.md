# Field 0.2 release handoff

Prepared September 11, 2026. The release is now deployed through Vercel Git integration. The user saved the public Supabase and app URL environment settings; the rebuilt application passed the canonical version and browser sign-in redirect checks. Juniper is activated on workflow version 2. Full signed-in workflow browser testing remains pending. The sections below retain the initial handoff history.

## Current state

| Component | State |
| --- | --- |
| GitHub | `StarrLimited/workforge-core` is the confirmed public repository. Personal-account installation fixed the initial HTTP 403. Source upload is now enabled. |
| Application | The current `workforge-development` deployment is still 0.1. Production and preview deployment requests for 0.2 both returned HTTP 403 permission errors. |
| Database | All five checked-in migrations are applied to the dedicated WorkForge project, `vtjwkyukmddvlsdejeyd`. Do not reapply them there. |
| Workflow gate | Existing Juniper workspace remains on version 1 so the live 0.1 interface can still complete jobs. New workspaces default to version 2. |
| Demo catalog | Six illustrative catalog entries are seeded in Juniper only. |
| Verification | Eleven automated tests, the production build and both database integration suites passed. Signed-in browser verification is pending. |

## Access needed

GitHub access is resolved: the app is now installed on the personal `StarrLimited` account as well as the existing organization, and the first source commit succeeded.

The Vercel connection needs deployment access to `workforge-development` in team `shawn-7058` (`team_gI5N0zdgKtgqHhSoX8vwRlnq`). Confirm the connected identity, team and project access; see [Vercel roles and permissions](https://vercel.com/docs/rbac). Do not create another project or use another account to work around the denial.

## Publication sequence

1. Restore Vercel project access. GitHub source publication is complete; use the release source from the confirmed repository.
2. Deploy this source to the existing Vercel project using Node 22.13 or newer, the Next.js framework preset, `npm ci` and `npm run build`.
3. Retain the project's dedicated public Supabase URL and publishable key. Set `NEXT_PUBLIC_APP_URL=https://workforge-development.vercel.app` and keep `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` until Google authentication is configured. Do not place environment files in GitHub.
4. Confirm the canonical application's `/api/version` returns `{"product":"WorkForge Field","version":"0.2.0"}`. A Ready build alone is insufficient to establish which version the canonical address serves.
5. Run `ops/activate-field-v2.sql` against the dedicated WorkForge database to enable the required walkthrough for existing Field workspaces. Do this only after step 4.
6. Complete signed-in browser verification in the fictional workspace: existing-customer job creation, consultation, fractional itemized estimate, saved proposal print preview, simulated customer approval, purchasing, crew scheduling, production tasks/walkthrough, manual expense/receipt, cost review and private photo upload/download. Verify mobile layout and console errors.
7. Record the deployed commit, deployment ID, canonical version result and browser findings in the resource register and verification notes.

If reverting the application to 0.1 after activation, first set the affected Field workspaces' `field_workflow_version` back to 1. Retain the additive schema and records. The 0.1 interface cannot edit itemized quotes created in 0.2; keep those jobs on hold until 0.2 is restored. Do not remove schema or downgrade quote records to force compatibility.

This remains a development release. Customer delivery/e-signature, accounting connections and launch hardening are tracked in `field-expansion.md` and the README.
