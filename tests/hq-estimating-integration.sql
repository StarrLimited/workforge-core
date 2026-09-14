begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-4000-8000-000000000001','estimate-owner@example.invalid',now()),
 ('30000000-0000-4000-8000-000000000002','estimate-reader@example.invalid',now()),
 ('30000000-0000-4000-8000-000000000003','estimate-outsider@example.invalid',now());
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('8ac08858-038c-41df-90a8-4a84f25cb400','30000000-0000-4000-8000-000000000001','owner'),
 ('8ac08858-038c-41df-90a8-4a84f25cb400','30000000-0000-4000-8000-000000000002','read_only');
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
do $$declare a uuid;o uuid;p uuid;q uuid;s uuid;again uuid;link jsonb;doc jsonb:='{}';k text;begin
 insert into public.hq_accounts(workspace_id,company,contact_name,email,owner,next_action,due_on) values('8ac08858-038c-41df-90a8-4a84f25cb400','Signing fixture','QA','buyer@example.invalid','Shawn','Discovery',current_date) returning id into a;
 insert into public.hq_opportunities(workspace_id,account_id,title,kind,owner,next_action,due_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Signing Blueprint','blueprint','Shawn','Confirm scope',current_date) returning id into o;
 insert into public.hq_requirements(workspace_id,opportunity_id,title,priority,actor,steps,expected) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,'Workflow map','must','Owner','Review current work','Written workflow map approved');
 foreach k in array array['seller','customer','objective','scope','exclusions','assumptions','timeline','payment','tax','subscription','support','rights','termination','legal'] loop doc:=doc||jsonb_build_object(k,'Reviewed fixture '||k);end loop;
 insert into public.hq_proposals(workspace_id,opportunity_id,account_id,title,valid_until,document,lines,terms_reviewed) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,a,'Signature test',current_date+30,doc,'[{"description":"Blueprint","service":"blueprint","cadence":"one_time","quantity_units":100,"unit_cents":0,"discount_cents":0}]',true) returning id into p;
 begin update public.hq_proposals set status='issued' where id=p;raise exception 'TEST FAILED: unpriced estimate issued';exception when raise_exception then if sqlerrm not like 'Invalid estimate line total%' then raise;end if;end;
 update public.hq_proposals set lines=jsonb_set(lines,'{0,unit_cents}','12345') where id=p;
 update public.hq_proposals set status='issued' where id=p;
 begin perform public.hq_create_signing_request(p,'buyer@example.invalid');raise exception 'TEST FAILED: unsigned provider link';exception when raise_exception then if sqlerrm not like 'Sign for WorkForge%' then raise;end if;end;
 begin perform public.hq_sign_provider(p,'QA Seller','Owner','seller@example.invalid','',false);raise exception 'TEST FAILED: no consent';exception when raise_exception then if sqlerrm not like 'Complete your name%' then raise;end if;end;
 s:=public.hq_sign_provider(p,'QA Seller','Owner','seller@example.invalid','',true);
 again:=public.hq_sign_provider(p,'QA Seller','Owner','seller@example.invalid','',true);
 if s<>again or (select count(*) from public.hq_signatures where proposal_id=p)<>1 then raise exception 'TEST FAILED: signature retry duplicated';end if;
 begin update public.hq_proposals set status='accepted',accepted_name='Fake customer',accepted_on=(now() at time zone 'America/Denver')::date,evidence='No signature' where id=p;raise exception 'TEST FAILED: bypass dual signatures';exception when raise_exception then if sqlerrm not like 'Both parties must sign%' then raise;end if;end;
 link:=public.hq_create_signing_request(p,'buyer@example.invalid');
 q:=public.hq_revise_proposal(p);
 if public.hq_review_agreement(link->>'token') is not null then raise exception 'TEST FAILED: superseded signing link readable';end if;
 if (select count(*) from public.hq_signatures where proposal_id=q)<>0 then raise exception 'TEST FAILED: revision copied signatures';end if;
 update public.hq_proposals set terms_reviewed=true where id=q;update public.hq_proposals set status='issued' where id=q;
 perform public.hq_sign_provider(q,'QA Seller','Owner','seller@example.invalid','',true);
 link:=public.hq_create_signing_request(q,'buyer@example.invalid');p:=q;
 perform set_config('qa.sign_token',link->>'token',true);perform set_config('qa.proposal',p::text,true);
 if length(link->>'token')<>64 then raise exception 'TEST FAILED: token entropy';end if;
 begin update public.hq_signatures set name='Forged' where id=s;raise exception 'TEST FAILED: signature mutable';exception when insufficient_privilege then null;end;
 if (select count(*) from public.hq_pricebook where unit_cents is null)<12 then raise exception 'TEST FAILED: starter pricing invented or missing';end if;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.hq_sign_provider(current_setting('qa.proposal')::uuid,'Reader','Owner','reader@example.invalid','',true);raise exception 'TEST FAILED: reader signed';exception when raise_exception then if sqlerrm not like 'HQ write access%' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
do $$begin
 if exists(select 1 from public.hq_signatures) then raise exception 'TEST FAILED: outsider signature access';end if;
 begin perform public.hq_create_signing_request(current_setting('qa.proposal')::uuid,'bad@example.invalid');raise exception 'TEST FAILED: outsider link';exception when raise_exception then if sqlerrm not like 'HQ write access%' then raise;end if;end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$declare r jsonb;s uuid;s2 uuid;begin
 r:=public.hq_review_agreement(current_setting('qa.sign_token'));
 if r is null or r->'proposal' ? 'discovery_snapshot' or r->'proposal' ? 'accepted_by' then raise exception 'TEST FAILED: public scope/privacy';end if;
 if public.hq_review_agreement(repeat('0',64)) is not null then raise exception 'TEST FAILED: invalid token read';end if;
 begin perform public.hq_sign_client(current_setting('qa.sign_token'),'QA Buyer','Owner','wrong@example.invalid','',true);raise exception 'TEST FAILED: wrong recipient signed';exception when raise_exception then if sqlerrm not like 'Use the email address%' then raise;end if;end;
 s:=public.hq_sign_client(current_setting('qa.sign_token'),'QA Buyer','Owner','buyer@example.invalid','',true);
 s2:=public.hq_sign_client(current_setting('qa.sign_token'),'QA Buyer','Owner','buyer@example.invalid','',true);
 if s<>s2 then raise exception 'TEST FAILED: client retry duplicated';end if;
 r:=public.hq_review_agreement(current_setting('qa.sign_token'));
 if r#>>'{proposal,status}'<>'accepted' or jsonb_array_length(r->'signatures')<>2 then raise exception 'TEST FAILED: acceptance not completed';end if;
 if r#>>'{signatures,0,document_hash}'<>r#>>'{signatures,1,document_hash}' then raise exception 'TEST FAILED: signature document mismatch';end if;
end $$;
reset role;
do $$declare p uuid:=current_setting('qa.proposal')::uuid;project uuid;begin
 select id into project from public.hq_implementations where proposal_id=p;
 if project is null or (select count(*) from public.hq_implementations where proposal_id=p)<>1 or (select count(*) from public.hq_tasks where implementation_id=project)<>4 then raise exception 'TEST FAILED: automatic kickoff';end if;
 if (select sum(amount_cents) from public.hq_engagements where proposal_id=p)<>12345 then raise exception 'TEST FAILED: agreed price handoff';end if;
 if has_table_privilege('anon','public.hq_signatures','SELECT') or has_function_privilege('anon','public.hq_sign_provider(uuid,text,text,text,text,boolean)','EXECUTE') or has_table_privilege('authenticated','public.hq_signatures','UPDATE') then raise exception 'TEST FAILED: permission boundary';end if;
 -- Revocation denies review; restore only this rolled-back fixture to exercise expiry independently.
 update public.hq_signing_requests set revoked_at=clock_timestamp() where proposal_id=p;
 if public.hq_review_agreement(current_setting('qa.sign_token')) is not null then raise exception 'TEST FAILED: revoked link readable';end if;
 update public.hq_signing_requests set revoked_at=null where proposal_id=p;
 -- Expiry denies review and signing even if the underlying agreement remains accepted.
 update public.hq_signing_requests set expires_at=clock_timestamp()-interval '1 second' where proposal_id=p;
 if public.hq_review_agreement(current_setting('qa.sign_token')) is not null then raise exception 'TEST FAILED: expired token readable';end if;
end $$;
rollback;
