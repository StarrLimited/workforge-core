begin;
insert into private.hq_webhook_keys(name,token_hash) values('webflow',repeat('a',64))
on conflict(name) do update set token_hash=excluded.token_hash,enabled=true;
set local role service_role;
do $$ declare lead jsonb; result jsonb; begin
 lead:=jsonb_build_object('site_id','6aa5acbf7ae3bb9c0c7b7ec5','submission_id','aaaaaaaaaaaaaaaaaaaaaaaa','form_id','6aa768c8b75121eb407fc997',
 'submitted_at','2026-09-14T06:00:00Z','company','HQ intake test fixture','contact_name','Test Contact','email','test@example.invalid','phone','+1 303 555 0100',
 'source','Google Ads','scope','Test requirements','notes','UTM Campaign: test','attribution',jsonb_build_object('UTM Campaign','test'));
 result:=public.hq_receive_webflow(repeat('b',64),lead);
 if result->>'status'<>'unauthorized' then raise exception 'TEST FAILED: incorrect key accepted'; end if;
 if exists(select 1 from public.hq_intake_receipts where submission_id='aaaaaaaaaaaaaaaaaaaaaaaa') then raise exception 'TEST FAILED: unauthorized receipt persisted'; end if;
 result:=public.hq_receive_webflow(repeat('a',64),lead);
 if result->>'status'<>'created' then raise exception 'TEST FAILED: submission not created'; end if;
 result:=public.hq_receive_webflow(repeat('a',64),lead);
 if result->>'status'<>'duplicate' then raise exception 'TEST FAILED: duplicate not recognized'; end if;
 if (select count(*) from public.hq_accounts where company='HQ intake test fixture')<>1 then raise exception 'TEST FAILED: duplicate account'; end if;
 if not exists(select 1 from public.hq_accounts a join public.hq_intake_receipts r on a.id=r.account_id where r.submission_id='aaaaaaaaaaaaaaaaaaaaaaaa' and a.phone='+1 303 555 0100' and a.owner='Shawn' and a.stage='new' and a.due_on=(now() at time zone 'America/Denver')::date and r.attribution->>'UTM Campaign'='test') then raise exception 'TEST FAILED: field mapping'; end if;
 begin
  perform public.hq_receive_webflow(repeat('a',64),lead||jsonb_build_object('submission_id','bbbbbbbbbbbbbbbbbbbbbbbb','company',''));
  raise exception 'TEST FAILED: invalid account accepted';
 exception when check_violation then null;
 end;
 if exists(select 1 from public.hq_intake_receipts where submission_id='bbbbbbbbbbbbbbbbbbbbbbbb') then raise exception 'TEST FAILED: receipt survived failed account'; end if;
end; $$;
reset role;
do $$ begin
 if has_function_privilege('anon','public.hq_receive_webflow(text,jsonb)','execute') or has_function_privilege('authenticated','public.hq_receive_webflow(text,jsonb)','execute') then raise exception 'TEST FAILED: client can invoke intake'; end if;
 if has_table_privilege('authenticated','private.hq_webhook_keys','select') or has_table_privilege('anon','private.hq_webhook_keys','select') then raise exception 'TEST FAILED: client can read key hashes'; end if;
end; $$;
rollback;
