begin;
update public.hq_lead_relays set enabled=true,page_id='123',form_ids=array['456'] where provider='meta';
set local role service_role;
select public.hq_receive_relay('meta','{"external_id":"answers-fixture","form_id":"456","page_id":"123","status":"received","submitted_at":"2026-10-01T12:00:00Z","company":"Answer fixture","contact_name":"Fixture","email":"answers@example.invalid","phone":"","attribution":{"answers":{}}}');
reset role;
update public.hq_accounts set notes='Salesperson notes must survive',next_action='Call on Tuesday',owner='Neil' where email='answers@example.invalid';
set local role service_role;
select public.hq_receive_relay('meta','{"external_id":"answers-fixture","form_id":"456","page_id":"123","status":"received","notes":"Replace?","attribution":{"campaign_name":"Original campaign","answers":{"interest":"CRM","role":"Owner"}}}');
select public.hq_receive_relay('meta','{"external_id":"answers-fixture","form_id":"456","page_id":"123","status":"received","attribution":{"answers":{"interest":"","role":"Changed","team_size":"2-5"}}}');
select public.hq_receive_relay('meta','{"external_id":"answers-fixture","form_id":"456","page_id":"123","status":"test"}');
do $$ declare a public.hq_accounts;r public.hq_ad_receipts;begin
 if (select count(*) from public.hq_accounts where email='answers@example.invalid')<>1 then raise exception 'Duplicate account';end if;
 select * into a from public.hq_accounts where email='answers@example.invalid';
 if a.notes<>'Salesperson notes must survive' or a.next_action<>'Call on Tuesday' or a.owner<>'Neil' then raise exception 'Sales record overwritten';end if;
 select * into r from public.hq_ad_receipts where external_id='answers-fixture';
 if r.attribution->'answers'<>'{"interest":"CRM","role":"Owner","team_size":"2-5"}'::jsonb then raise exception 'Answers missing or replaced: %',r.attribution;end if;
 if r.account_id<>a.id or r.status<>'received' then raise exception 'Receipt unlinked';end if;
 if r.submitted_at<>'2026-10-01T12:00:00Z'::timestamptz then raise exception 'Submission time overwritten';end if;
 begin
  perform private.hq_store_ad('meta','{"external_id":"answers-fixture","form_id":"wrong","page_id":"123","status":"received","attribution":{"answers":{"evil":"payload"}}}','Shawn');
  raise exception 'TEST: wrong form accepted';
 exception when raise_exception then if sqlerrm<>'Lead identity mismatch.' then raise;end if;end;
end $$;
reset role;
-- The UI reads existing receipt RLS policies; no new grants or bypass added.
do $$ begin
 if has_function_privilege('authenticated','private.hq_store_ad(text,jsonb,text)','execute') then raise exception 'Storage RPC exposed';end if;
 if has_table_privilege('anon','public.hq_ad_receipts','select') then raise exception 'Lead answers public';end if;
end $$;
rollback;
