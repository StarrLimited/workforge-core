# WorkForge Field 0.3.1 — Vendor locations and crew coverage

Prepared September 12, 2026 for the existing WorkForge development portal.

- Vendor records support multiple separately saved branches, yards and pickup locations. Each includes a name, street address, city, state/province, postal code, local contact, phone and notes. Locations can be edited or removed individually.
- Internal crews and subcontractors have Primary region of operation and Coverage area fields. These save with the main partner record.
- Cards summarize vendor location counts or crew coverage. Partner categories use readable labels.
- Card grid gaps, expanded-editor separation, form spacing and location cards have been adjusted for desktop and mobile widths.

Open **Crews & vendors**, select a card, and edit its record. For vendors, use **Add location** in the Vendor locations section. For crews and subcontractors, use **Region & coverage** and save the main record.

## Verification

- The production build, TypeScript check and all 18 unit tests pass.
- `tests/partner-locations-integration.sql` passes with fictional data rolled back afterward. It checks multiple locations, complete field persistence, edits, isolated removal, crew/subcontractor coverage, address validation, vendor-only parentage, read-only permissions and workspace isolation.
- Migration `20260912042436_partner_locations_coverage` is applied. It adds coverage columns and a separate location table with a composite workspace/vendor foreign key, row-level policies, scoped column grants and an index for vendor lookups.
- The security advisor reports no database security findings. The existing [Auth password-protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) is unchanged.
- Signed-in browser verification is unavailable in the current session; database checks do not replace visual verification.
