-- Approved Field Solo and optional Solo Care. Preserve existing rates and saved agreement snapshots.
insert into public.hq_pricebook(workspace_id,sku,name,description,service,cadence,unit_label,unit_cents)
select '8ac08858-038c-41df-90a8-4a84f25cb400',sku,name,description,service,cadence,unit_label,unit_cents from (values
 ('WF-FIELD-SOLO','Field Solo','A proven Field OS setup for a solo owner-operator who sells, schedules and does the work.
Company coverage: One business, one owner-operator.
Discovery: One 45-minute setup session.
Operating workflow: Configure one standard Field OS workflow, including branding, lead intake and follow-up tasks.
Estimate / approval layouts: One branded template and a basic customer-approved pricebook.
Field forms / checklists: One intake form and one completion checklist.
Production: Calendar, accepted estimate to job, job notes, photos, invoice preparation and accounting handoff.
Additional supported integrations: None.
Migration: One clean spreadsheet; up to 250 contacts, 50 pricebook items and 10 open jobs.
Onboarding: One owner-operator.
Training: One 60-minute session.
Revisions: One configuration revision.
Guided launch support: 14 days.
Target delivery: 1–2 weeks after receipt of the required information, usable data and access.
Included application capabilities:
Company branding, a dedicated business environment, and role-based access.
Contacts, lead intake, sales stages, appointments, and follow-up tasks.
Service pricebook using customer-approved prices and units.
Estimates, customer-supplied agreement terms, client and team signatures, and accepted-version records.
Approved estimate conversion to a scheduled job; job documents, photos, completion checklists, and customer service requests.
Invoice preparation and accounting handoff. Automatic accounting synchronization requires a selected supported integration.
One authorized business email sender, PDF output, and data export.
Field Solo configures a proven standard Field OS workflow for one owner-operator. Import counts are implementation allowances, not ongoing customer or job limits. Migration includes mapping, a test import, customer review and final import. When the business grows, retain its data and configuration and separately quote the additional implementation work.
Custom integrations, additional or custom workflows, crew or branch management setup, historical attachment migration and custom reports are excluded from Field Solo. Payment processing and automatic accounting synchronization require a separately scoped supported integration. New features and ongoing changes are separately scoped.','implementation','one_time','project',149500),
 ('WF-SOLO-CARE','Solo Care','Optional care for Field Solo: application monitoring, scheduled backups, routine maintenance and up to 15 minutes of user help each month. No additional setup fee with implementation. New features and ongoing changes are separately scoped. Automation, AI and Continuous Improvement add-ons require WorkForge Managed in place of Solo Care. Hosting, messaging and other third-party charges are additional and disclosed before purchase.','support','monthly','month',9900)
) as x(sku,name,description,service,cadence,unit_label,unit_cents)
on conflict(workspace_id,sku) do nothing;

create or replace function private.hq_package_lines_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare rules jsonb:='[{"sku":"WF-FIELD-SOLO","name":"Field Solo","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-FIELD-FOUNDATION","name":"Field Foundation","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-FIELD-OPERATIONS","name":"Field Operations","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-FIELD-SCALE","name":"Field Scale","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-BLUEPRINT","name":"WorkForge Blueprint","service":"blueprint","cadence":"one_time","kind":"blueprint"},{"sku":"WF-SOLO-CARE","name":"Solo Care","service":"support","cadence":"monthly","kind":"monthly"},{"sku":"WF-MANAGED","name":"WorkForge Managed","service":"support","cadence":"monthly","kind":"monthly"},{"sku":"WF-AUTO-ESSENTIALS","name":"Automation Essentials","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AUTO-ESSENTIALS-SETUP"},{"sku":"WF-AUTO-PLUS","name":"Automation Plus","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AUTO-PLUS-SETUP"},{"sku":"WF-AI-ASSISTANT","name":"AI Assistant","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AI-ASSISTANT-SETUP"},{"sku":"WF-AI-OPERATIONS","name":"AI Operations","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AI-OPERATIONS-SETUP"},{"sku":"WF-IMPROVEMENT","name":"Continuous Improvement","service":"support","cadence":"monthly","kind":"monthly"},{"sku":"WF-AUTO-ESSENTIALS-SETUP","name":"Automation Essentials setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AUTO-PLUS-SETUP","name":"Automation Plus setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AI-ASSISTANT-SETUP","name":"AI Assistant setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AI-OPERATIONS-SETUP","name":"AI Operations setup","service":"implementation","cadence":"one_time","kind":"setup"}]'::jsonb;r jsonb;l jsonb;selected text[];
begin
 -- Only draft content is validated here. Existing issued and signed revisions stay frozen under the original guard.
 if tg_op='UPDATE' and old.status<>'draft' then return new;end if;
 select coalesce(array_agg(value->>'catalog_sku') filter(where value ? 'catalog_sku'),'{}') into selected from jsonb_array_elements(new.lines);
 if (select count(*) from jsonb_array_elements(rules) x where x->>'kind'='package' and x->>'sku'=any(selected))>1 then raise exception 'Choose one Field implementation package per estimate.';end if;
 if (select count(*) from unnest(selected) s)<>(select count(distinct s) from unnest(selected) s) then raise exception 'Remove duplicate catalog services.';end if;
 if selected @> array['WF-AUTO-ESSENTIALS','WF-AUTO-PLUS'] or selected @> array['WF-AI-ASSISTANT','WF-AI-OPERATIONS'] then raise exception 'Choose one plan from each automation and AI family; higher plans replace lower plans.';end if;
 if selected @> array['WF-SOLO-CARE','WF-MANAGED'] then raise exception 'WorkForge Managed replaces Solo Care; choose one care plan.';end if;
 if 'WF-SOLO-CARE'=any(selected) and exists(select 1 from jsonb_array_elements(rules) x where x->>'kind'='package' and x->>'sku'<>'WF-FIELD-SOLO' and x->>'sku'=any(selected)) then raise exception 'Solo Care is available for Field Solo; choose WorkForge Managed for other packages.';end if;
 if 'WF-BLUEPRINT'=any(selected) and exists(select 1 from jsonb_array_elements(rules) x where x->>'kind'='package' and x->>'sku'=any(selected)) then raise exception 'Blueprint is included in the implementation package total.';end if;
 for l in select value from jsonb_array_elements(new.lines) loop
  select value into r from jsonb_array_elements(rules) x where x->>'sku'=l->>'catalog_sku';
  if r is null then continue;end if;
  if l->>'cadence'<>r->>'cadence' or l->>'service'<>r->>'service' or (l->>'quantity_units')::numeric<>100 then raise exception 'Keep the catalog service billing basis, category and quantity.';end if;
  if r->>'kind'='monthly' and r->>'sku' not in ('WF-MANAGED','WF-SOLO-CARE') and not 'WF-MANAGED'=any(selected) then raise exception 'Monthly add-ons require WorkForge Managed.';end if;
  if r ? 'setup' and not (r->>'setup'=any(selected)) then raise exception 'Include the selected add-on setup fee.';end if;
  if r->>'kind'='setup' and not exists(select 1 from jsonb_array_elements(rules) x where x->>'setup'=r->>'sku' and x->>'sku'=any(selected)) then raise exception 'Add-on setup requires its monthly service.';end if;
 end loop;
 return new;
end $$;
revoke all on function private.hq_package_lines_guard() from public,anon,authenticated;
