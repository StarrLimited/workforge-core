-- Gmail credentials are encrypted in Vault. Only the Edge Function's service role
-- can access them. No token or secret is returned through the user-facing API.
create table private.hq_gmail_secret (id boolean primary key default true check(id),secret_id uuid not null);
create table private.hq_gmail_oauth (state_hash text primary key,user_id uuid not null references auth.users(id),verifier text not null,client_id text not null,expires_at timestamptz not null);
alter table private.hq_gmail_secret enable row level security;
alter table private.hq_gmail_oauth enable row level security;
revoke all on private.hq_gmail_secret,private.hq_gmail_oauth from public,anon,authenticated;
create function private.hq_gmail_backend(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid;value jsonb;state private.hq_gmail_oauth;d public.hq_mail_deliveries;r public.hq_signing_requests;begin
 if p_action='get' then
  select s.decrypted_secret::jsonb into value from private.hq_gmail_secret c join vault.decrypted_secrets s on s.id=c.secret_id where c.id;
  return coalesce(value,'{}');
 elsif p_action='put' then
  select secret_id into sid from private.hq_gmail_secret where id for update;
  if sid is null then
   select vault.create_secret(p_data::text,'workforge_hq_gmail','WorkForge estimating OAuth configuration and refresh token') into sid;
   insert into private.hq_gmail_secret(secret_id) values(sid);
  else perform vault.update_secret(sid,p_data::text);end if;
  return '{"ok":true}';
 elsif p_action='state' then
  delete from private.hq_gmail_oauth where expires_at<clock_timestamp();
  insert into private.hq_gmail_oauth(state_hash,user_id,verifier,client_id,expires_at) values(p_data->>'state_hash',(p_data->>'user_id')::uuid,p_data->>'verifier',p_data->>'client_id',clock_timestamp()+interval '10 minutes');return '{"ok":true}';
 elsif p_action='consume' then
  delete from private.hq_gmail_oauth where state_hash=p_data->>'state_hash' and expires_at>clock_timestamp() returning * into state;
  return case when state.state_hash is null then null else to_jsonb(state) end;
 elsif p_action='begin_send' then
  -- An abandoned request is uncertain; it is never silently retried.
  update public.hq_mail_deliveries set status='unknown',error='Delivery was interrupted. Check Gmail Sent before sending again.' where proposal_id=(p_data->>'proposal_id')::uuid and status='sending' and created_at<clock_timestamp()-interval '2 minutes';
  if exists(select 1 from public.hq_mail_deliveries where proposal_id=(p_data->>'proposal_id')::uuid and created_at>clock_timestamp()-interval '30 seconds') then raise exception 'An email was just requested. Check delivery status before sending again.';end if;
  select * into r from public.hq_signing_requests where id=(p_data->>'request_id')::uuid and proposal_id=(p_data->>'proposal_id')::uuid and revoked_at is null and expires_at>clock_timestamp();
  if r.id is null then raise exception 'Create a current signing request before sending.';end if;
  insert into public.hq_mail_deliveries(workspace_id,proposal_id,request_id,recipient_email) values(r.workspace_id,r.proposal_id,r.id,r.recipient_email) returning * into d;
  return to_jsonb(d);
 elsif p_action='finish_send' then
  update public.hq_mail_deliveries set status=p_data->>'status',gmail_id=p_data->>'gmail_id',error=left(coalesce(p_data->>'error',''),500),sent_at=case when p_data->>'status'='sent' then clock_timestamp() else null end where id=(p_data->>'id')::uuid and status='sending' returning * into d;
  if d.id is null then raise exception 'Delivery state changed. Check Gmail Sent before retrying.';end if;
  return to_jsonb(d);
 else raise exception 'Invalid Gmail backend action.';end if;
end $$;
create function public.hq_gmail_backend(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.hq_gmail_backend(p_action,p_data)$$;
revoke all on function private.hq_gmail_backend(text,jsonb),public.hq_gmail_backend(text,jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.hq_gmail_backend(text,jsonb),public.hq_gmail_backend(text,jsonb) to service_role;
