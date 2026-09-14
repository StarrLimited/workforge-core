begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('20000000-0000-4000-8000-000000000001','hq-sales-owner@example.invalid',now()),
 ('20000000-0000-4000-8000-000000000002','hq-sales-reader@example.invalid',now()),
 ('20000000-0000-4000-8000-000000000003','hq-sales-outsider@example.invalid',now());
insert into public.workspace_memberships(workspace_id,user_id,role) values
 ('8ac08858-038c-41df-90a8-4a84f25cb400','20000000-0000-4000-8000-000000000001','owner'),
 ('8ac08858-038c-41df-90a8-4a84f25cb400','20000000-0000-4000-8000-000000000002','read_only');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare a uuid;o uuid;r uuid;q uuid;q2 uuid;p uuid;c uuid;f uuid;b uuid;k text;doc jsonb:='{}';answers jsonb:='{}';lines jsonb;t date:=(now() at time zone 'America/Denver')::date;
begin
 insert into public.hq_accounts(workspace_id,company,contact_name,email,phone,owner,next_action,due_on) values('8ac08858-038c-41df-90a8-4a84f25cb400','HQ sales integration fixture','QA','qa@example.invalid','','Shawn','Discovery',t) returning id into a;
 select id into o from public.hq_opportunities where account_id=a;
 if o is null or (select count(*) from public.hq_opportunities where account_id=a)<>1 then raise exception 'TEST FAILED: inquiry did not create one discovery engagement';end if;
 insert into public.hq_requirements(workspace_id,opportunity_id,title,priority,actor,steps,expected) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,'Intake deduplication','must','Sales','Submit the same source lead twice.','Exactly one lead and follow-up.') returning id into r;
 foreach k in array array['seller','customer','objective','scope','exclusions','assumptions','timeline','payment','tax','subscription','support','rights','termination','legal'] loop doc:=doc||jsonb_build_object(k,'Reviewed fixture terms for '||k);end loop;
 lines:='[{"description":"Build","service":"implementation","cadence":"one_time","quantity_units":100,"unit_cents":100000,"discount_cents":0},{"description":"Software","service":"software","cadence":"monthly","quantity_units":100,"unit_cents":29900,"discount_cents":0},{"description":"Annual support","service":"support","cadence":"annual","quantity_units":100,"unit_cents":120000,"discount_cents":0},{"description":"Usage rate","service":"software","cadence":"usage","quantity_units":100,"unit_cents":200,"discount_cents":0}]';
 insert into public.hq_proposals(workspace_id,opportunity_id,account_id,title,valid_until,document,lines,tax_cents,deposit_cents,terms_reviewed) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,a,'Fixture estimate',t+30,doc,lines,1000,50000,true) returning id into q;
 begin update public.hq_proposals set status='issued' where id=q;raise exception 'TEST FAILED: incomplete discovery issued';exception when raise_exception then if sqlerrm not like 'Resolve the discovery section:%' then raise;end if;end;
 foreach k in array array['outcomes','people','workflow','roles','systems','migration','rules','automation','security','commercial'] loop answers:=answers||jsonb_build_object(k,jsonb_build_object('status','confirmed','notes','Reviewed evidence'));end loop;
 update public.hq_opportunities set discovery=jsonb_build_object('answers',answers,'open_questions','') where id=o;
 update public.hq_proposals set status='issued' where id=q;
 begin update public.hq_proposals set document='{}' where id=q;raise exception 'TEST FAILED: issued scope mutated';exception when raise_exception then if sqlerrm not like 'Issued agreements are frozen%' then raise;end if;end;
 q2:=public.hq_revise_proposal(q);
 if (select revision from public.hq_proposals where id=q2)<>2 then raise exception 'TEST FAILED: revision not incremented';end if;
 begin update public.hq_proposals set status='accepted',accepted_name='QA Buyer',accepted_on=t,evidence='Signed fixture document' where id=q;raise exception 'TEST FAILED: superseded offer accepted';exception when raise_exception then if sqlerrm not like 'This agreement is closed%' then raise;end if;end;
 update public.hq_proposals set terms_reviewed=true where id=q2;
 update public.hq_proposals set status='issued' where id=q2;
 update public.hq_requirements set expected='New discovery detail for a future offer' where id=r;
 if (select requirements_snapshot->0->>'expected' from public.hq_proposals where id=q2)<>'Exactly one lead and follow-up.' then raise exception 'TEST FAILED: issued requirements changed';end if;
 update public.hq_proposals set status='accepted',accepted_name='QA Buyer',accepted_on=t,evidence='Signed fixture document' where id=q2;
 update public.hq_proposals set status='accepted' where id=q2;
 select id into p from public.hq_implementations where proposal_id=q2;
 if (select count(*) from public.hq_implementations where proposal_id=q2)<>1 or (select count(*) from public.hq_tasks where implementation_id=p)<>12 then raise exception 'TEST FAILED: project or tasks duplicated/missing';end if;
 if (select count(*) from public.hq_engagements where proposal_id=q2)<>4 then raise exception 'TEST FAILED: fixed fees/tax missing or usage charged as fixed';end if;
 if (select stage from public.hq_accounts where id=a)<>'won' then raise exception 'TEST FAILED: sales not won';end if;
 if (select sum(amount_cents) from public.hq_engagements where proposal_id=q2 and cadence='one_time')<>101000 then raise exception 'TEST FAILED: tax/deposit accounting';end if;
 begin update public.hq_engagements set amount_cents=1 where proposal_id=q2 and proposal_line=1;raise exception 'TEST FAILED: accepted fee mutated';exception when raise_exception then if sqlerrm not like 'Accepted agreement fees are preserved%' then raise;end if;end;
 begin update public.hq_tasks set completed=true where implementation_id=p;raise exception 'TEST FAILED: completion without evidence';exception when raise_exception then if sqlerrm not like 'Record checklist evidence%' then raise;end if;end;
 begin update public.hq_implementations set status='building' where id=p;raise exception 'TEST FAILED: unfunded build';exception when raise_exception then if sqlerrm not like 'Record how the agreed funding%' then raise;end if;end;
 update public.hq_implementations set status='building',funding_note='Fixture payment recorded',release='qa-v1' where id=p;
 begin update public.hq_implementations set status='testing' where id=p;raise exception 'TEST FAILED: beta before internal checks';exception when raise_exception then if sqlerrm not like 'Complete the kickoff%' then raise;end if;end;
 update public.hq_tasks set completed=true,evidence='Fixture internal check passed' where implementation_id=p;
 update public.hq_implementations set status='testing' where id=p;
 select id into c from public.hq_beta_cases where implementation_id=p;
 begin update public.hq_beta_cases set mandatory=false where id=c;raise exception 'TEST FAILED: mandatory contracted test disabled';exception when raise_exception then if sqlerrm not like 'Contracted tests are preserved%' then raise;end if;end;
 insert into public.hq_beta_runs(workspace_id,test_id,implementation_id,release,result,actual,evidence,tester) values('8ac08858-038c-41df-90a8-4a84f25cb400',c,p,'qa-v1','failed','Two leads','Fixture run 1','Customer QA');
 begin update public.hq_implementations set status='ready' where id=p;raise exception 'TEST FAILED: failed beta passed launch gate';exception when raise_exception then if sqlerrm not like 'Pass every mandatory%' then raise;end if;end;
 insert into public.hq_beta_runs(workspace_id,test_id,implementation_id,release,result,actual,evidence,tester) values('8ac08858-038c-41df-90a8-4a84f25cb400',c,p,'qa-v1','passed','One lead with correct follow-up','Fixture run 2','Customer QA');
 insert into public.hq_defects(workspace_id,implementation_id,title,detail,severity,owner,due_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',p,'Permission issue','Forbidden action allowed','high','Neil',t) returning id into f;
 begin update public.hq_implementations set status='ready' where id=p;raise exception 'TEST FAILED: high defect ignored';exception when raise_exception then if sqlerrm not like 'Resolve blocking defects%' then raise;end if;end;
 update public.hq_defects set status='resolved',resolution='Corrected policy',retest='Role test denied forbidden action' where id=f;
 update public.hq_implementations set status='ready' where id=p;
 insert into public.hq_support_plans(workspace_id,account_id,owner,terms,next_review_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Neil','Fixture support terms',t+7);
 begin update public.hq_implementations set status='live' where id=p;raise exception 'TEST FAILED: customer acceptance omitted';exception when raise_exception then if sqlerrm not like 'Record customer acceptance%' then raise;end if;end;
 update public.hq_implementations set status='live',approval_name='Customer approver',approval_on=t,approval_evidence='Signed release approval',approval_release='qa-v1' where id=p;
 if (select count(*) from public.hq_tasks where account_id=a and implementation_id is null)<>1 then raise exception 'TEST FAILED: support follow-up missing';end if;
 update public.hq_implementations set status='testing',release='qa-v2' where id=p;
 if (select approval_name from public.hq_implementations where id=p)<>'' then raise exception 'TEST FAILED: changed release retained approval';end if;
 begin update public.hq_implementations set status='ready' where id=p;raise exception 'TEST FAILED: old release tests reused';exception when raise_exception then if sqlerrm not like 'Pass every mandatory%' then raise;end if;end;
 -- A second, bounded Blueprint for the same customer must keep its own history.
 insert into public.hq_opportunities(workspace_id,account_id,title,kind,owner,next_action,due_on) values('8ac08858-038c-41df-90a8-4a84f25cb400',a,'Expansion Blueprint','blueprint','Neil','Resolve migration unknowns',t) returning id into o;
 insert into public.hq_requirements(workspace_id,opportunity_id,title,priority,actor,steps,expected) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,'Migration assessment','must','Buyer','Review sample export','Mapping and implementation estimate accepted');
 insert into public.hq_proposals(workspace_id,opportunity_id,account_id,title,valid_until,document,lines,terms_reviewed) values('8ac08858-038c-41df-90a8-4a84f25cb400',o,a,'Blueprint',t+30,doc,'[{"description":"Blueprint","service":"blueprint","cadence":"one_time","quantity_units":100,"unit_cents":50000,"discount_cents":0}]',true) returning id into b;
 update public.hq_proposals set status='issued' where id=b;
 update public.hq_proposals set status='accepted',accepted_name='QA Buyer',accepted_on=t,evidence='Signed Blueprint fixture' where id=b;
 select id into p from public.hq_implementations where proposal_id=b;
 if (select count(*) from public.hq_tasks where implementation_id=p)<>4 or (select count(*) from public.hq_implementations where account_id=a)<>2 then raise exception 'TEST FAILED: Blueprint overwrote customer history or authorized build tasks';end if;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
do $$ declare n int;begin
 update public.hq_opportunities set title='unauthorized';get diagnostics n=row_count;if n<>0 then raise exception 'TEST FAILED: reader edited sales';end if;
 begin insert into public.hq_opportunities(workspace_id,account_id,title,kind,owner,next_action,due_on) select workspace_id,account_id,'unauthorized','blueprint','Shawn','No',current_date from public.hq_opportunities limit 1;raise exception 'TEST FAILED: reader created sales';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',true);
do $$begin if exists(select 1 from public.hq_proposals) or exists(select 1 from public.hq_beta_runs) or exists(select 1 from public.hq_opportunities) then raise exception 'TEST FAILED: outsider can read sales';end if;end $$;
reset role;
do $$begin
 if has_table_privilege('anon','public.hq_proposals','select') or has_function_privilege('anon','public.hq_revise_proposal(uuid)','execute') or has_table_privilege('authenticated','public.hq_beta_runs','update') then raise exception 'TEST FAILED: record or evidence permissions';end if;
end $$;
rollback;
