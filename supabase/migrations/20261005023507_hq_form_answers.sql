-- Preserve submission answers when an authenticated delivery is replayed.
create or replace function private.hq_store_ad(p_provider text,p_lead jsonb,p_owner text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.hq_ad_receipts; account uuid; s text:=p_lead->>'status';
begin
 -- Serialize a provider/form to deduplicate backfills and concurrent deliveries.
 perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||(p_lead->>'form_id'),0));
 insert into public.hq_ad_receipts(provider,external_id,form_id,page_id,status,submitted_at)
 values(p_provider,p_lead->>'external_id',p_lead->>'form_id',coalesce(p_lead->>'page_id',''),'pending',coalesce((p_lead->>'submitted_at')::timestamptz,now()))
 on conflict(provider,external_id) do nothing;
 select * into r from public.hq_ad_receipts where provider=p_provider and external_id=p_lead->>'external_id' for update;
 if r.form_id is distinct from p_lead->>'form_id' or r.page_id is distinct from coalesce(p_lead->>'page_id','') then raise exception 'Lead identity mismatch.'; end if;
 if r.status in ('received','test') then
  -- A replay can fill missing answers without creating another inquiry or
  -- changing the salesperson's notes, ownership, stage or follow-up date.
  if r.status='received' and s='received' then
   if jsonb_typeof(coalesce(p_lead->'attribution','{}')) <> 'object'
    or jsonb_typeof(coalesce(p_lead#>'{attribution,answers}','{}')) <> 'object' then raise exception 'Invalid answers.'; end if;
   update public.hq_ad_receipts set attribution=
    (coalesce(p_lead->'attribution','{}') || r.attribution) || jsonb_build_object('answers',
     coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(p_lead#>'{attribution,answers}','{}')) where value not in ('null'::jsonb,'""'::jsonb)), '{}') ||
     coalesce((select jsonb_object_agg(key,value) from jsonb_each(coalesce(r.attribution->'answers','{}')) where value not in ('null'::jsonb,'""'::jsonb)), '{}')),
    updated_at=now()
   where provider=p_provider and external_id=r.external_id;
  end if;
  return jsonb_build_object('status','duplicate');
 end if;
 if s='pending' then return jsonb_build_object('status','pending'); end if;
 if s='received' then
  -- A connector backfill may lack the provider ID. Match only the same
  -- form, exact submission timestamp and contact, never email alone.
  select a.id into account from public.hq_ad_receipts prior join public.hq_accounts a on a.id=prior.account_id
  where prior.provider=p_provider and prior.form_id=p_lead->>'form_id' and prior.status='received'
   and prior.submitted_at=(p_lead->>'submitted_at')::timestamptz
   and ((nullif(p_lead->>'email','') is not null and lower(a.email)=lower(p_lead->>'email'))
    or (nullif(p_lead->>'phone','') is not null and a.phone=p_lead->>'phone')) limit 1;
  if account is null then
  insert into public.hq_accounts(workspace_id,company,contact_name,email,phone,source,owner,next_action,due_on,scope,notes)
  values('8ac08858-038c-41df-90a8-4a84f25cb400',p_lead->>'company',p_lead->>'contact_name',p_lead->>'email',p_lead->>'phone',case when p_provider='meta' then 'Meta' else 'Google Ads' end,p_owner,
  'Review ad inquiry and contact the lead',(now() at time zone 'America/Denver')::date,coalesce(p_lead->>'scope',''),coalesce(p_lead->>'notes','')) returning id into account;
  end if;
 end if;
 update public.hq_ad_receipts set status=s,account_id=account,attribution=coalesce(p_lead->'attribution','{}'),error_code=left(coalesce(p_lead->>'error_code',''),200),submitted_at=coalesce((p_lead->>'submitted_at')::timestamptz,submitted_at),updated_at=now()
 where provider=p_provider and external_id=r.external_id;
 return jsonb_build_object('status',s);
end $$;

-- Website forms already accept 20,000-character workflow notes. Preserve those
-- in the submission snapshot without shrinking the accepted form payload.
alter table public.hq_intake_receipts drop constraint hq_intake_receipts_attribution_check;
alter table public.hq_intake_receipts add constraint hq_intake_receipts_attribution_check
 check(jsonb_typeof(attribution)='object' and octet_length(attribution::text)<=131072);
