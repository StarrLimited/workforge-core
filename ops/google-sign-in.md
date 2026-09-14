# WorkForge Google sign-in

Requested September 14, 2026. Google is the preferred portal sign-in method.

## Application behavior

The login page checks the existing Supabase project's public provider settings.
When Google is enabled, the official Google button is the first sign-in option;
email links are tucked under a secondary option. When Google is disabled or its
status cannot be established, the portal keeps the existing email flow available.
No build-time environment flag or additional Vercel deployment is needed after
the provider is configured. The provider lookup is uncached and has a five-second
timeout. This public settings endpoint provides no account or secret data.

Google uses the existing PKCE callback and server session cookies. The account
chooser is shown, and only the provider's standard identity scopes are requested.
Workspace membership continues to control all data access; a Google account or
matching email domain alone does not grant workspace access. Existing confirmed
email identities can be linked by Supabase's identity handling; the application
does not manually link accounts or assign roles from Google profile claims.

## Provider connection

Use a Web application OAuth client in the company-controlled Google Cloud project.

| Setting | Value |
| --- | --- |
| Application name | WorkForge |
| Authorized JavaScript origin | `https://workforge-development.vercel.app` |
| Authorized redirect URI in Google | `https://vtjwkyukmddvlsdejeyd.supabase.co/auth/v1/callback` |
| Supabase Site URL | `https://workforge-development.vercel.app` |
| Supabase allowed application callback | `https://workforge-development.vercel.app/auth/callback` |
| Identity scopes | `openid`, `userinfo.email`, `userinfo.profile` |

The Google client ID and client secret belong in the Google provider settings
for project `vtjwkyukmddvlsdejeyd`. Never place the client secret in Git, browser
application code, chat messages, or `NEXT_PUBLIC_*` environment variables.
Keep nonce verification enabled. Configure the OAuth audience to permit the
intended staff Google accounts; if the Google app is in Testing, add those staff
accounts as test users.

After saving and enabling the provider, reload the portal and verify Google
sign-in, the callback, and the owner's existing HQ membership. Confirm a
non-member still has no access to business records. A successful deployment or
provider flag alone is not a completed sign-in test.

## Current verification

- Google was enabled in the existing Supabase project on September 14, 2026,
  after the owner supplied the Google client configuration directly.
- The production login page displayed the Google button as its primary option.
- A complete Google sign-in with the owner's account succeeded: account chooser,
  consent for name/profile picture/email, callback, and authenticated portal.
- Selecting WorkForge HQ opened `/hq` and its overview, pipeline, customer
  accounts, implementations, tasks, calendar, and commercial navigation.
- The callback returns to `/`, which defaults to HQ for existing HQ members.
  Explicit product-workspace selections remain available through membership-
  scoped links. Customer-only users still enter their own product workspace.
- The configured Site URL and allowed application callback match the table above.
  Nonce checks remain enabled, and accounts without email are not allowed.
- No authorization logic changed during provider activation. The existing HQ
  membership and RLS tests remain the access-control verification; a separate
  non-member Google login was not exercised during this browser test.

## References

- [Supabase Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Google button assets and branding](https://developers.google.com/identity/branding-guidelines)

`public/brand/google-sign-in.svg` is Google's pre-approved light rectangular
button from its official sign-in asset bundle. Its geometry and colors are preserved.
