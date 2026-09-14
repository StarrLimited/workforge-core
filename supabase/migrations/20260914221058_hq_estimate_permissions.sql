-- Supabase project default privileges may grant table operations automatically.
-- Explicit privileges keep signature/link/delivery writes in validated functions.
revoke all on public.hq_signatures,public.hq_signing_requests,public.hq_mail_deliveries from public,anon,authenticated;
grant select on public.hq_signatures,public.hq_signing_requests,public.hq_mail_deliveries to authenticated;
revoke all on public.hq_pricebook from public,anon,authenticated;
grant select,insert,update on public.hq_pricebook to authenticated;
