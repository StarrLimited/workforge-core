-- Webflow authenticates with a dedicated random 256-bit webhook URL key.
-- Only its SHA-256 hash is stored here. Configure the key separately from source.
create table private.hq_webhook_keys (
 name text primary key check(name='webflow'),
 token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'),
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
revoke all on private.hq_webhook_keys from public,anon,authenticated;
grant select on private.hq_webhook_keys to service_role;
grant usage on schema private to service_role;

create table public.hq_intake_receipts (
 site_id text not null check(site_id='6aa5acbf7ae3bb9c0c7b7ec5'),
 submission_id text not null check(submission_id ~ '^[a-f0-9]{24}$'),
 workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 account_id uuid,
 form_id text not null,
 submitted_at timestamptz not null,
 received_at timestamptz not null default now(),
 attribution jsonb not null check(jsonb_typeof(attribution)='object' and octet_length(attribution::text)<=16000),
 primary key(site_id,submission_id),
 foreign key(workspace_id,account_id) references public.hq_accounts(workspace_id,id)
);
alter table public.hq_intake_receipts enable row level security;
revoke all on public.hq_intake_receipts from public,anon,authenticated;
grant select on public.hq_intake_receipts to authenticated;
grant select,insert,update on public.hq_intake_receipts to service_role;
grant select,insert on public.hq_accounts to service_role;
create policy hq_receipt_read on public.hq_intake_receipts for select to authenticated using(private.can_read(workspace_id));
create index hq_intake_receipts_account on public.hq_intake_receipts(workspace_id,account_id);

-- Only the Edge Function's server credential can call this RPC. The integration
-- key is checked even for ignored forms. Receipt and account commit atomically.
create function public.hq_receive_webflow(p_key_hash text,p_lead jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare receipt_id text; account uuid;
begin
 if not exists(select 1 from private.hq_webhook_keys where name='webflow' and enabled and token_hash=p_key_hash) then
  return jsonb_build_object('status','unauthorized');
 end if;
 if p_lead->>'status'='ignored' then return jsonb_build_object('status','ignored'); end if;
 if p_lead->>'site_id' is distinct from '6aa5acbf7ae3bb9c0c7b7ec5'
    or not coalesce(p_lead->>'submission_id' ~ '^[a-f0-9]{24}$',false)
    or not coalesce(p_lead->>'form_id'=any(array[
      '6aa768c8b75121eb407fc955','6aa768c8b75121eb407fc997','6aa614429ef85f8b1b2aace2',
      '6aa768c8b75121eb407fc983','6aa768c8b75121eb407fc9c5','6aa73dd631b0951ebcde0301',
      '6aa768c8b75121eb407fc975','6aa768c8b75121eb407fc9b7','6aa73dd631b0951ebcde02f3',
      '6aa768c8b75121eb407fc967','6aa768c8b75121eb407fc9a9','6aa73dd631b0951ebcde02e5']),false) then
  raise exception 'Unsupported Webflow submission.';
 end if;
 insert into public.hq_intake_receipts(site_id,submission_id,workspace_id,form_id,submitted_at,attribution)
 values(p_lead->>'site_id',p_lead->>'submission_id','8ac08858-038c-41df-90a8-4a84f25cb400',p_lead->>'form_id',(p_lead->>'submitted_at')::timestamptz,p_lead->'attribution')
 on conflict(site_id,submission_id) do nothing returning submission_id into receipt_id;
 if receipt_id is null then
  return jsonb_build_object('status','duplicate');
 end if;
 insert into public.hq_accounts(workspace_id,company,contact_name,email,phone,source,product,stage,owner,next_action,due_on,scope,notes)
 values('8ac08858-038c-41df-90a8-4a84f25cb400',p_lead->>'company',p_lead->>'contact_name',p_lead->>'email',p_lead->>'phone',p_lead->>'source','undecided','new','Shawn',
 'Review website inquiry and contact the lead',(now() at time zone 'America/Denver')::date,p_lead->>'scope',p_lead->>'notes') returning id into account;
 update public.hq_intake_receipts set account_id=account where site_id=p_lead->>'site_id' and submission_id=receipt_id;
 return jsonb_build_object('status','created');
end; $$;
revoke all on function public.hq_receive_webflow(text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_receive_webflow(text,jsonb) to service_role;
