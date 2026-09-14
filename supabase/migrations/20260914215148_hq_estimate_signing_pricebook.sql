-- Drafts may retain unpriced services; issued offers still require positive prices.
create or replace function private.hq_sales_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.hq_implementations;o public.hq_opportunities;v jsonb;k text;qty numeric;price numeric;discount numeric;amount numeric;total numeric:=0;
begin
 if tg_op='UPDATE' then
  if old.workspace_id is distinct from new.workspace_id then raise exception 'Workspace cannot be changed.'; end if;
  new.updated_at:=clock_timestamp();
 end if;
 if tg_table_name='hq_opportunities' then
  if tg_op='UPDATE' and (old.account_id,old.kind) is distinct from (new.account_id,new.kind) then raise exception 'The customer and engagement type are preserved.'; end if;
  if tg_op='UPDATE' and new.stage='won' and old.stage<>'won' and not exists(select 1 from public.hq_proposals where opportunity_id=new.id and status='accepted') then raise exception 'Record acceptance of an issued agreement first.'; end if;
  if tg_op='INSERT' and new.stage='won' then raise exception 'Create a discovery opportunity first.'; end if;
 elsif tg_table_name='hq_requirements' then
  perform 1 from public.hq_opportunities where id=new.opportunity_id for update;
  if tg_op='UPDATE' and old.opportunity_id<>new.opportunity_id then raise exception 'Requirement links cannot be changed.'; end if;
 elsif tg_table_name='hq_proposals' then
  select * into o from public.hq_opportunities where id=new.opportunity_id for update;
  if not found then raise exception 'Opportunity not found.'; end if;
  if tg_op='INSERT' then
   if new.status<>'draft' then raise exception 'Create a draft estimate first.'; end if;
   if new.revision>1 and not exists(select 1 from public.hq_proposals where family_id=new.family_id and opportunity_id=new.opportunity_id and revision=new.revision-1 and status in ('superseded','declined')) then raise exception 'Revise the preceding issued offer first.';end if;
   new.requirements_snapshot:='[]';new.discovery_snapshot:='{}';new.issued_at:=null;new.accepted_by:=null;new.accepted_name:='';new.accepted_on:=null;new.evidence:='';
  else
   if (old.opportunity_id,old.account_id,old.family_id,old.revision,old.number) is distinct from (new.opportunity_id,new.account_id,new.family_id,new.revision,new.number) then raise exception 'Estimate identity is preserved.'; end if;
   if old.status<>'draft' and (old.document,old.lines,old.title,old.valid_until,old.deposit_cents,old.tax_cents,old.terms_reviewed,old.requirements_snapshot,old.discovery_snapshot,old.issued_at) is distinct from (new.document,new.lines,new.title,new.valid_until,new.deposit_cents,new.tax_cents,new.terms_reviewed,new.requirements_snapshot,new.discovery_snapshot,new.issued_at) then raise exception 'Issued agreements are frozen. Create a revision.'; end if;
   if old.status in ('accepted','declined','superseded') and to_jsonb(old)-'updated_at' is distinct from to_jsonb(new)-'updated_at' then raise exception 'This agreement is closed. Create a new opportunity for additional work.'; end if;
   if old.status='draft' and new.status not in ('draft','issued') then raise exception 'Issue the completed estimate before recording acceptance.'; end if;
   if old.status='issued' and new.status not in ('issued','accepted','declined','superseded') then raise exception 'Create a revision to change this offer.'; end if;
   if old.status=new.status and (old.accepted_name,old.accepted_on,old.evidence,old.accepted_by) is distinct from (new.accepted_name,new.accepted_on,new.evidence,new.accepted_by) then raise exception 'Use Record acceptance to retain customer approval.'; end if;
  end if;
  for v in select value from jsonb_array_elements(new.lines) loop
   if coalesce(v->>'cadence','') not in ('one_time','monthly','annual','usage') or coalesce(v->>'service','') not in ('blueprint','implementation','migration','software','support') or length(trim(coalesce(v->>'description','')))=0 then raise exception 'Complete every estimate line.'; end if;
   qty:=(v->>'quantity_units')::numeric;price:=(v->>'unit_cents')::numeric;discount:=(v->>'discount_cents')::numeric;
   if qty is null or price is null or discount is null or qty<>trunc(qty) or price<>trunc(price) or discount<>trunc(discount) or qty not between 1 and 1000000 or price not between 0 and 100000000 or discount<0 then raise exception 'Invalid estimate quantity or price.'; end if;
   amount:=round(qty*price/100)-discount;
   if amount<0 or (new.status<>'draft' and amount=0) or amount>100000000000 then raise exception 'Invalid estimate line total.'; end if;
   if v->>'cadence'='one_time' then total:=total+amount; end if;
  end loop;
  if new.deposit_cents>total+new.tax_cents then raise exception 'The deposit cannot exceed the one-time total.'; end if;
  if new.status='issued' and (tg_op='INSERT' or old.status='draft') then
   if not new.terms_reviewed or new.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'Review the agreement terms and expiry before issuing.'; end if;
   foreach k in array array['seller','customer','objective','scope','exclusions','assumptions','timeline','payment','tax','subscription','support','rights','termination','legal'] loop
    if length(trim(coalesce(new.document->>k,'')))=0 or new.document->>k like '%[Complete%' then raise exception 'Complete the agreement section: %.',k; end if;
   end loop;
   if o.kind<>'blueprint' then
    foreach k in array array['outcomes','people','workflow','roles','systems','migration','rules','automation','security','commercial'] loop
     if coalesce(o.discovery#>>array['answers',k,'status'],'unknown') not in ('confirmed','not_applicable') or length(trim(coalesce(o.discovery#>>array['answers',k,'notes'],'')))=0 then raise exception 'Resolve the discovery section: %.',k; end if;
    end loop;
    if exists(select 1 from jsonb_each(o.discovery->'answers') a where a.value->>'notes' like '%[Add answer]%') then raise exception 'Replace the discovery prompts with the customer answers before issuing.';end if;
    if length(trim(coalesce(o.discovery->>'open_questions','')))>0 then raise exception 'Resolve the open discovery questions, or scope a Blueprint first.'; end if;
   end if;
   select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]') into new.requirements_snapshot from public.hq_requirements r where opportunity_id=o.id and priority<>'later';
   if not exists(select 1 from public.hq_requirements where opportunity_id=o.id and priority='must') then raise exception 'Add at least one must-have deliverable and acceptance test.'; end if;
   if not exists(select 1 from jsonb_array_elements(new.lines) l where l->>'cadence'<>'usage') then raise exception 'Include at least one fixed fee; describe usage charges separately.'; end if;
   new.discovery_snapshot:=o.discovery;new.issued_at:=clock_timestamp();
  end if;
  if new.status='accepted' and old.status='issued' then
   if new.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'This offer has expired. Create and issue a revision.'; end if;
   if length(trim(new.accepted_name))=0 or length(trim(new.evidence))=0 or new.accepted_on is null or new.accepted_on<(new.issued_at at time zone 'America/Denver')::date or new.accepted_on>(now() at time zone 'America/Denver')::date then raise exception 'Record the authorized signer, valid acceptance date and signed-document reference.'; end if;
   new.accepted_by:=auth.uid();
  end if;
 elsif tg_table_name in ('hq_beta_cases','hq_beta_runs','hq_defects') then
  select * into p from public.hq_implementations where id=new.implementation_id for update;
  if p.status='live' then raise exception 'Move this project out of Live before changing beta records; use support for new production issues.'; end if;
  if tg_op='UPDATE' and old.implementation_id<>new.implementation_id then raise exception 'Project links cannot be changed.'; end if;
  if tg_table_name='hq_beta_cases' then
   if tg_op='UPDATE' then
    if old.requirement_id is not null then raise exception 'Contracted tests are preserved. Add a supplementary test for additional checks.'; end if;
   end if;
  end if;
  if tg_table_name='hq_beta_runs' then
   if tg_op='UPDATE' then raise exception 'Test evidence is append-only. Record a new test run.'; end if;
   if p.status not in ('testing','ready') then raise exception 'Move the project into Testing after internal checks before recording beta results.';end if;
   if new.release<>p.release or length(trim(p.release))=0 then raise exception 'Record this project release before running tests.'; end if;
   new.recorded_by:=auth.uid();new.created_at:=clock_timestamp();
  end if;
 end if;
 return new;
end $$;

create table public.hq_pricebook (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),
 sku text not null default ('WF-'||upper(substr(gen_random_uuid()::text,1,8))),name text not null check(length(trim(name)) between 1 and 200),description text not null check(length(trim(description)) between 1 and 4000),
 service text not null check(service in ('blueprint','implementation','migration','software','support')),cadence text not null check(cadence in ('one_time','monthly','annual','usage')),
 unit_cents bigint check(unit_cents between 1 and 100000000),unit_label text not null default 'project' check(length(unit_label) between 1 and 80),active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,sku)
);
alter table public.hq_pricebook enable row level security;
grant select,insert,update on public.hq_pricebook to authenticated;
create policy read_hq_pricebook on public.hq_pricebook for select to authenticated using(private.can_read(workspace_id));
create policy insert_hq_pricebook on public.hq_pricebook for insert to authenticated with check(private.can_write(workspace_id));
create policy update_hq_pricebook on public.hq_pricebook for update to authenticated using(private.can_write(workspace_id)) with check(private.can_write(workspace_id));
create function private.hq_pricebook_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if tg_op='UPDATE' and (old.workspace_id,old.sku) is distinct from (new.workspace_id,new.sku) then raise exception 'Pricebook identity cannot change.';end if;
 new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function private.hq_pricebook_guard() from public,anon,authenticated;
create trigger hq_pricebook_guard before update on public.hq_pricebook for each row execute function private.hq_pricebook_guard();
create trigger hq_pricebook_audit before insert or update on public.hq_pricebook for each row execute function private.audit_change();
insert into public.hq_pricebook(workspace_id,sku,name,description,service,cadence,unit_label)
select '8ac08858-038c-41df-90a8-4a84f25cb400',sku,name,description,service,cadence,unit_label from (values
 ('WF-BLUEPRINT','WorkForge Blueprint','Map the current workflow, identify priorities, review existing tools and data, and deliver a written build scope with acceptance criteria.','blueprint','one_time','engagement'),
 ('WF-CUSTOM-OS','WorkForge Custom OS','Configure and build the agreed business operating system, including the workflows, roles, screens and reports listed in the project scope.','implementation','one_time','project'),
 ('WF-FIELD','Field service workflow','Connect customer intake, consultations, estimates, approvals, scheduling, crews, purchasing and job completion for the agreed field service workflow.','implementation','one_time','workflow'),
 ('WF-CRM','Custom CRM','Configure customer records, sales stages, follow-up tasks, permissions and reporting around the agreed sales process.','implementation','one_time','module'),
 ('WF-AUTOMATION','Workflow automation','Automate an agreed repetitive process with defined triggers, approval rules, failure handling and acceptance tests.','implementation','one_time','workflow'),
 ('WF-INTEGRATION','App integration','Connect the agreed systems after confirming access, supported interfaces, data mapping, direction of updates and failure handling. Third-party fees are scoped separately.','implementation','one_time','connection'),
 ('WF-MIGRATION','Data migration','Map, clean and import the agreed records and history, then reconcile a sample and final totals with the customer.','migration','one_time','migration'),
 ('WF-TRAINING','Team training & rollout','Prepare role-specific guidance, train the agreed users, and support the planned transition to the new workflow.','implementation','one_time','session'),
 ('WF-BETA','Beta testing & launch','Run the agreed user acceptance tests, track issues, confirm release approval and complete the launch checklist.','implementation','one_time','release'),
 ('WF-MANAGED','WorkForge Managed','Provide the agreed ongoing system care, monitoring, maintenance and support. Included hours, response targets and exclusions are defined in the agreement.','support','monthly','month'),
 ('WF-SOFTWARE','WorkForge software service','Provide access to the agreed hosted WorkForge environment. Hosting, user limits, renewal and any usage allowances are defined in the agreement.','software','monthly','month'),
 ('WF-CHANGE','Additional improvements','Deliver a separately approved change to the existing system, with written scope, price, schedule impact and acceptance criteria.','implementation','one_time','change')
) as x(sku,name,description,service,cadence,unit_label);

create table public.hq_signatures (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),proposal_id uuid not null references public.hq_proposals(id),
 party text not null check(party in ('provider','client')),name text not null check(length(trim(name)) between 2 and 200),title text not null check(length(trim(title)) between 1 and 200),email text not null check(length(email)<=254),
 signature_image text not null default '' check(length(signature_image)<=200000 and (signature_image='' or signature_image ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$')),
 consent text not null,document_hash text not null,signed_at timestamptz not null default clock_timestamp(),recorded_by uuid references auth.users(id),unique(proposal_id,party)
);
create table public.hq_signing_requests (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),proposal_id uuid not null references public.hq_proposals(id),
 token_hash text not null unique,recipient_email text not null,created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz
);
create table public.hq_mail_deliveries (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) check(workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400'),proposal_id uuid not null references public.hq_proposals(id),request_id uuid not null references public.hq_signing_requests(id),recipient_email text not null,
 status text not null default 'sending' check(status in ('sending','sent','failed','unknown')),gmail_id text,error text not null default '',created_at timestamptz not null default clock_timestamp(),sent_at timestamptz
);
create unique index hq_one_pending_send on public.hq_mail_deliveries(proposal_id) where status='sending';
create index hq_signature_workspace on public.hq_signatures(workspace_id);
create index hq_signature_recorded_by on public.hq_signatures(recorded_by);
create index hq_request_proposal on public.hq_signing_requests(proposal_id);
create index hq_request_creator on public.hq_signing_requests(created_by);
create index hq_mail_request on public.hq_mail_deliveries(request_id);
create index hq_mail_proposal on public.hq_mail_deliveries(proposal_id);
do $$declare t text;begin foreach t in array array['hq_signatures','hq_signing_requests','hq_mail_deliveries'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy hq_read on public.%I for select to authenticated using(private.can_read(workspace_id))',t);
 end loop;end $$;

create function private.hq_document_hash(p public.hq_proposals) returns text language sql immutable set search_path='' as $$
 select encode(sha256(convert_to(jsonb_build_object('number',p.number,'revision',p.revision,'title',p.title,'valid_until',p.valid_until,'document',p.document,'lines',p.lines,'deposit',p.deposit_cents,'tax',p.tax_cents,'requirements',p.requirements_snapshot)::text,'UTF8')),'hex')
$$;
create function private.hq_signature(p_id uuid,p_party text,p_name text,p_title text,p_email text,p_image text,p_consent boolean,p_token text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare p public.hq_proposals;r public.hq_signing_requests;s uuid;sig public.hq_signatures;email text:=lower(trim(p_email));
begin
 if p_party='provider' then
  if auth.uid() is null or not private.can_write('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'HQ write access required.';end if;
 elsif p_party='client' then
  if p_token is null or length(p_token)<>64 then raise exception 'This signing link is unavailable.';end if;
 else raise exception 'Invalid signing party.';end if;
 select * into p from public.hq_proposals where id=p_id and workspace_id='8ac08858-038c-41df-90a8-4a84f25cb400' for update;
 if not found then raise exception 'Agreement not found.';end if;
 if p_party='client' then
  select * into r from public.hq_signing_requests where proposal_id=p.id and token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>clock_timestamp();
  if not found or r.recipient_email<>email then raise exception 'Use the email address this signing link was sent to.';end if;
 end if;
 -- Retries return the existing signature without creating duplicate projects.
 select * into sig from public.hq_signatures where proposal_id=p.id and party=p_party;
 if found then
  if sig.name<>trim(p_name) or sig.title<>trim(p_title) or sig.email<>email or sig.signature_image<>coalesce(p_image,'') or p_consent is distinct from true then raise exception 'This party has already signed. The signature is preserved.';end if;
  return sig.id;
 end if;
 if p.status<>'issued' or p.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'This offer is no longer available for signing.';end if;
 if p_party='client' and not exists(select 1 from public.hq_signatures where proposal_id=p.id and party='provider') then raise exception 'WorkForge must sign this agreement first.';end if;
 if p_consent is distinct from true or length(trim(p_name)) not between 2 and 200 or length(trim(p_title)) not between 1 and 200 or length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Complete your name, title, email and signing consent.';end if;
 insert into public.hq_signatures(workspace_id,proposal_id,party,name,title,email,signature_image,consent,document_hash,recorded_by)
 values(p.workspace_id,p.id,p_party,trim(p_name),trim(p_title),email,coalesce(p_image,''),'I have read this agreement and approve its scope, prices, payment schedule, and terms. I am authorized to sign for the party named above. I agree to use my typed name and, if supplied, drawn signature as my electronic signature for this exact revision.',private.hq_document_hash(p),case when p_party='provider' then auth.uid() else null end) returning id into s;
 if p_party='client' then
  update public.hq_proposals set status='accepted',accepted_name=trim(p_name)||' — '||trim(p_title),accepted_on=(now() at time zone 'America/Denver')::date,evidence='Built-in signatures for both parties; agreement SHA-256 '||private.hq_document_hash(p) where id=p.id;
 end if;
 insert into public.audit_events(workspace_id,actor_id,action) values(p.workspace_id,case when p_party='provider' then auth.uid() else null end,'Agreement '||p.number||' signed by '||p_party);
 return s;
end $$;
create function public.hq_sign_provider(p_id uuid,p_name text,p_title text,p_email text,p_image text,p_consent boolean) returns uuid language sql security invoker set search_path='' as $$select private.hq_signature(p_id,'provider',p_name,p_title,p_email,p_image,p_consent,null)$$;
create function private.hq_client_signature(p_token text,p_name text,p_title text,p_email text,p_image text,p_consent boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare p uuid;begin
 if length(p_token)<>64 then raise exception 'This signing link is unavailable.';end if;
 select proposal_id into p from public.hq_signing_requests where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>clock_timestamp();
 if p is null then raise exception 'This signing link is unavailable or expired.';end if;
 return private.hq_signature(p,'client',p_name,p_title,p_email,p_image,p_consent,p_token);end $$;
create function public.hq_sign_client(p_token text,p_name text,p_title text,p_email text,p_image text,p_consent boolean) returns uuid language sql security invoker set search_path='' as $$select private.hq_client_signature(p_token,p_name,p_title,p_email,p_image,p_consent)$$;
create function private.hq_create_signing_request(p_id uuid,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.hq_proposals;token text:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');r uuid;expiry timestamptz;email text:=lower(trim(p_email));begin
 if auth.uid() is null or not private.can_write('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'HQ write access required.';end if;
 select * into p from public.hq_proposals where id=p_id for update;
 if not found or p.status<>'issued' or p.valid_until<(now() at time zone 'America/Denver')::date then raise exception 'Issue a current estimate before creating a signing link.';end if;
 if not exists(select 1 from public.hq_signatures where proposal_id=p.id and party='provider') then raise exception 'Sign for WorkForge before requesting the client signature.';end if;
 if length(email)>254 or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter the client signer email.';end if;
 if exists(select 1 from public.hq_signing_requests where proposal_id=p.id and created_at>clock_timestamp()-interval '10 seconds') then raise exception 'A link was just created. Wait a few seconds before trying again.';end if;
 expiry:=least(clock_timestamp()+interval '30 days',(p.valid_until+1)::timestamp at time zone 'America/Denver');
 -- Failed email attempts must not invalidate earlier delivered links. Explicit revocation is separate.
 insert into public.hq_signing_requests(workspace_id,proposal_id,token_hash,recipient_email,created_by,expires_at) values(p.workspace_id,p.id,encode(sha256(convert_to(token,'UTF8')),'hex'),email,auth.uid(),expiry) returning id into r;
 return jsonb_build_object('id',r,'token',token,'expires_at',expiry);end $$;
create function public.hq_create_signing_request(p_id uuid,p_email text) returns jsonb language sql security invoker set search_path='' as $$select private.hq_create_signing_request(p_id,p_email)$$;
create function private.hq_review_agreement(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.hq_signing_requests;p public.hq_proposals;signatures jsonb;begin
 if length(p_token)<>64 then return null;end if;
 select * into r from public.hq_signing_requests where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>clock_timestamp();
 if not found then return null;end if;
 select * into p from public.hq_proposals where id=r.proposal_id and status in ('issued','accepted');
 if not found then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(s)-'recorded_by'-'workspace_id'),'[]') into signatures from public.hq_signatures s where proposal_id=p.id;
 return jsonb_build_object('proposal',jsonb_build_object('id',p.id,'title',p.title,'number',p.number,'revision',p.revision,'status',p.status,'valid_until',p.valid_until,'document',p.document,'lines',p.lines,'deposit_cents',p.deposit_cents,'tax_cents',p.tax_cents,'requirements_snapshot',p.requirements_snapshot,'accepted_name',p.accepted_name,'accepted_on',p.accepted_on),'signatures',signatures,'recipient_email',r.recipient_email,'expires_at',r.expires_at);
end $$;
create function public.hq_review_agreement(p_token text) returns jsonb language sql security invoker set search_path='' as $$select private.hq_review_agreement(p_token)$$;
-- Public access is limited to possession of an unguessable, expiring, revocable signing token.
revoke all on function private.hq_document_hash(public.hq_proposals),private.hq_signature(uuid,text,text,text,text,text,boolean,text),private.hq_client_signature(text,text,text,text,text,boolean),private.hq_create_signing_request(uuid,text),private.hq_review_agreement(text) from public,anon,authenticated;
revoke all on function public.hq_sign_provider(uuid,text,text,text,text,boolean),public.hq_sign_client(text,text,text,text,text,boolean),public.hq_create_signing_request(uuid,text),public.hq_review_agreement(text) from public,anon,authenticated;
grant usage on schema private to anon;
grant execute on function private.hq_signature(uuid,text,text,text,text,text,boolean,text),public.hq_sign_provider(uuid,text,text,text,text,boolean),private.hq_create_signing_request(uuid,text),public.hq_create_signing_request(uuid,text) to authenticated;
grant execute on function private.hq_client_signature(text,text,text,text,text,boolean),public.hq_sign_client(text,text,text,text,text,boolean),private.hq_review_agreement(text),public.hq_review_agreement(text) to anon,authenticated;

create function private.hq_revoke_signing_requests(p_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.can_write('8ac08858-038c-41df-90a8-4a84f25cb400') then raise exception 'HQ write access required.';end if;
 update public.hq_signing_requests set revoked_at=clock_timestamp() where proposal_id=p_id and revoked_at is null;
end $$;
create function public.hq_revoke_signing_requests(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.hq_revoke_signing_requests(p_id)$$;
revoke all on function private.hq_revoke_signing_requests(uuid),public.hq_revoke_signing_requests(uuid) from public,anon;
grant execute on function private.hq_revoke_signing_requests(uuid),public.hq_revoke_signing_requests(uuid) to authenticated;
create function private.hq_signed_acceptance_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.status='accepted' and old.status<>'accepted' and exists(select 1 from public.hq_signatures where proposal_id=new.id) and (select count(*) from public.hq_signatures where proposal_id=new.id)<>2 then raise exception 'Both parties must sign this agreement before it can be accepted.';end if;
 return new;end $$;
revoke all on function private.hq_signed_acceptance_guard() from public,anon,authenticated;
create trigger hq_signed_acceptance_guard before update on public.hq_proposals for each row execute function private.hq_signed_acceptance_guard();
