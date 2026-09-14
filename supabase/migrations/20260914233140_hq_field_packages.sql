-- Approved by Shawn: Field packages and optional managed services.
-- Existing estimates contain snapshots and are not repriced by this migration.
insert into public.hq_pricebook(workspace_id,sku,name,description,service,cadence,unit_label,unit_cents)
select '8ac08858-038c-41df-90a8-4a84f25cb400',sku,name,description,service,cadence,unit_label,unit_cents from (values
 ('WF-FIELD-FOUNDATION','Field Foundation','A complete Field OS for an owner-led service business with straightforward jobs.
Company coverage: One company, one location.
Discovery: One 90-minute workshop.
Tailored operating processes: One.
Estimate / contract layouts: One.
Field forms / checklists: Two.
Production: Scheduling, assignments, job notes, photos and completion.
Reporting: Standard owner dashboard.
Additional supported integrations: None.
Migration: One source; up to 1,000 contacts, 100 pricebook items and 20 open jobs.
Onboarding: Up to five users.
Training: One 90-minute session.
Guided launch support: 14 days.
Target delivery: 2–3 weeks after scope approval and receipt of usable data and access.
All packages include:
Company branding, a dedicated business environment, and role-based access.
Contacts, lead intake, sales stages, appointments, and follow-up tasks.
Service pricebook using customer-approved prices and units.
Estimates, customer-supplied agreement terms, client and team signatures, and accepted-version records.
Approved estimate conversion to a scheduled job; crew assignments, documents, photos, completion checklists, and customer service requests.
Invoice preparation and accounting handoff. Automatic accounting synchronization requires a selected supported integration.
One authorized business email sender, PDF output, and data export.
A tailored process adapts stages, required information, responsibilities and approvals within existing modules. A supported connection covers one external account using an already tested connector; data direction and functions must be agreed. Onboarding counts are training allowances, not WorkForge seat charges. Migration includes mapping, a test import, customer review and final import.','implementation','one_time','project',295000),
 ('WF-FIELD-OPERATIONS','Field Operations','Our main Field OS offer for established businesses managing multiple crews, vendors and subcontractors.
Company coverage: One company, one location.
Discovery: Two 90-minute workshops.
Tailored operating processes: Up to three.
Estimate / contract layouts: Three.
Field forms / checklists: Five.
Production: Foundation production tools plus purchasing, work orders, subcontractor commitments and change orders.
Reporting: Owner dashboard, committed versus actual job costs, margins, and crew/subcontractor reporting.
Additional supported integrations: Two.
Migration: One source; up to 5,000 contacts, 500 pricebook items and 100 open jobs.
Onboarding: Up to 15 users.
Training: Three 60-minute sessions.
Guided launch support: 30 days.
Target delivery: 3–5 weeks after scope approval and receipt of usable data and access.
All packages include:
Company branding, a dedicated business environment, and role-based access.
Contacts, lead intake, sales stages, appointments, and follow-up tasks.
Service pricebook using customer-approved prices and units.
Estimates, customer-supplied agreement terms, client and team signatures, and accepted-version records.
Approved estimate conversion to a scheduled job; crew assignments, documents, photos, completion checklists, and customer service requests.
Invoice preparation and accounting handoff. Automatic accounting synchronization requires a selected supported integration.
One authorized business email sender, PDF output, and data export.
A tailored process adapts stages, required information, responsibilities and approvals within existing modules. A supported connection covers one external account using an already tested connector; data direction and functions must be agreed. Onboarding counts are training allowances, not WorkForge seat charges. Migration includes mapping, a test import, customer review and final import.','implementation','one_time','project',595000),
 ('WF-FIELD-SCALE','Field Scale','Field OS for one business with several departments or branches and more approval requirements.
Company coverage: One company, up to three branches.
Discovery: Three 90-minute workshops.
Tailored operating processes: Up to five.
Estimate / contract layouts: Five.
Field forms / checklists: Ten.
Production: Operations production tools plus branch workflows, approval thresholds and department handoffs.
Reporting: Operations reporting plus branch comparisons and up to three custom management reports.
Additional supported integrations: Four.
Migration: Two sources; up to 10,000 contacts, 1,000 pricebook items and 250 open jobs.
Onboarding: Up to 30 users.
Training: Five 60-minute sessions.
Guided launch support: 45 days.
Target delivery: 5–8 weeks after scope approval and receipt of usable data and access.
All packages include:
Company branding, a dedicated business environment, and role-based access.
Contacts, lead intake, sales stages, appointments, and follow-up tasks.
Service pricebook using customer-approved prices and units.
Estimates, customer-supplied agreement terms, client and team signatures, and accepted-version records.
Approved estimate conversion to a scheduled job; crew assignments, documents, photos, completion checklists, and customer service requests.
Invoice preparation and accounting handoff. Automatic accounting synchronization requires a selected supported integration.
One authorized business email sender, PDF output, and data export.
A tailored process adapts stages, required information, responsibilities and approvals within existing modules. A supported connection covers one external account using an already tested connector; data direction and functions must be agreed. Onboarding counts are training allowances, not WorkForge seat charges. Migration includes mapping, a test import, customer review and final import.','implementation','one_time','project',995000),
 ('WF-BLUEPRINT','WorkForge Blueprint','Paid discovery delivering a workflow map, migration assessment, integration list and firm build scope. Credited toward a selected implementation package; not an additional charge on top of that package.','blueprint','one_time','engagement',50000),
 ('WF-MANAGED','WorkForge Managed','Application monitoring, scheduled backups, routine maintenance, supported-connector monitoring, defect troubleshooting and 30 minutes of user assistance monthly. Setup included with implementation. Business-hours support; response targets of one business day for critical failures and two business days for routine requests. Response and resolution times are separate.','support','monthly','month',14900),
 ('WF-AUTO-ESSENTIALS','Automation Essentials','Configure and maintain up to five active automations and 1,000 workflow runs monthly. Requires WorkForge Managed. A standard automation has one trigger and up to five actions across no more than two systems. One run is one execution; retries caused by WorkForge do not count. Basic application actions included in the build do not require this add-on. Automation Plus replaces Essentials.','software','monthly','month',9900),
 ('WF-AUTO-PLUS','Automation Plus','Up to 12 active automations and 5,000 workflow runs monthly, including more complex routing and approval sequences. Requires WorkForge Managed. A standard automation has one trigger and up to five actions across no more than two systems. One run is one execution; retries caused by WorkForge do not count. Basic application actions included in the build do not require this add-on. Automation Plus replaces Essentials.','software','monthly','month',19900),
 ('WF-AI-ASSISTANT','AI Assistant','Three functions: summarize leads and job history, draft estimate scope from supplied information, and draft customer follow-ups. Requires WorkForge Managed. AI produces drafts and recommendations for human review. Pricing uses approved pricebooks and rules. Sending messages, changing prices or making financial commitments requires an explicitly configured approval process. AI Operations replaces AI Assistant.','software','monthly','month',9900),
 ('WF-AI-OPERATIONS','AI Operations','AI Assistant functions plus two selected functions: vendor-invoice extraction, field notes into draft updates, or an owner briefing. Agree the two functions during discovery. Requires WorkForge Managed. AI produces drafts and recommendations for human review. Pricing uses approved pricebooks and rules. Sending messages, changing prices or making financial commitments requires an explicitly configured approval process. AI Operations replaces AI Assistant.','software','monthly','month',24900),
 ('WF-IMPROVEMENT','Continuous Improvement','Two hours monthly for small workflow, form, report or pricebook changes. Unused hours expire monthly. Requires WorkForge Managed. No setup fee.','support','monthly','month',24900),
 ('WF-AUTO-ESSENTIALS-SETUP','Automation Essentials setup','Initial configuration, approval rules, failure handling and testing of the selected Automation Essentials workflows.','implementation','one_time','project',49500),
 ('WF-AUTO-PLUS-SETUP','Automation Plus setup','Initial configuration, routing, approval rules, failure handling and testing of the selected Automation Plus workflows.','implementation','one_time','project',99500),
 ('WF-AI-ASSISTANT-SETUP','AI Assistant setup','Connect and configure the three AI Assistant functions, approved information sources, human review and spending limits; test representative outputs.','implementation','one_time','project',49500),
 ('WF-AI-OPERATIONS-SETUP','AI Operations setup','Configure AI Assistant plus two agreed operations functions, approved data sources, human review, spending limits and acceptance tests.','implementation','one_time','project',149500)
) as x(sku,name,description,service,cadence,unit_label,unit_cents)
on conflict(workspace_id,sku) do update set name=excluded.name,description=excluded.description,service=excluded.service,cadence=excluded.cadence,unit_label=excluded.unit_label,unit_cents=excluded.unit_cents
where hq_pricebook.unit_cents is null;

create function private.hq_package_lines_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare rules jsonb:='[{"sku":"WF-FIELD-FOUNDATION","name":"Field Foundation","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-FIELD-OPERATIONS","name":"Field Operations","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-FIELD-SCALE","name":"Field Scale","service":"implementation","cadence":"one_time","kind":"package"},{"sku":"WF-BLUEPRINT","name":"WorkForge Blueprint","service":"blueprint","cadence":"one_time","kind":"blueprint"},{"sku":"WF-MANAGED","name":"WorkForge Managed","service":"support","cadence":"monthly","kind":"monthly"},{"sku":"WF-AUTO-ESSENTIALS","name":"Automation Essentials","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AUTO-ESSENTIALS-SETUP"},{"sku":"WF-AUTO-PLUS","name":"Automation Plus","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AUTO-PLUS-SETUP"},{"sku":"WF-AI-ASSISTANT","name":"AI Assistant","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AI-ASSISTANT-SETUP"},{"sku":"WF-AI-OPERATIONS","name":"AI Operations","service":"software","cadence":"monthly","kind":"monthly","setup":"WF-AI-OPERATIONS-SETUP"},{"sku":"WF-IMPROVEMENT","name":"Continuous Improvement","service":"support","cadence":"monthly","kind":"monthly"},{"sku":"WF-AUTO-ESSENTIALS-SETUP","name":"Automation Essentials setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AUTO-PLUS-SETUP","name":"Automation Plus setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AI-ASSISTANT-SETUP","name":"AI Assistant setup","service":"implementation","cadence":"one_time","kind":"setup"},{"sku":"WF-AI-OPERATIONS-SETUP","name":"AI Operations setup","service":"implementation","cadence":"one_time","kind":"setup"}]'::jsonb;r jsonb;l jsonb;selected text[];
begin
 -- Only draft content is validated here. Existing issued and signed revisions stay frozen under the original guard.
 if tg_op='UPDATE' and old.status<>'draft' then return new;end if;
 select coalesce(array_agg(value->>'catalog_sku') filter(where value ? 'catalog_sku'),'{}') into selected from jsonb_array_elements(new.lines);
 if (select count(*) from jsonb_array_elements(rules) x where x->>'kind'='package' and x->>'sku'=any(selected))>1 then raise exception 'Choose one Field implementation package per estimate.';end if;
 if (select count(*) from unnest(selected) s)<>(select count(distinct s) from unnest(selected) s) then raise exception 'Remove duplicate catalog services.';end if;
 if selected @> array['WF-AUTO-ESSENTIALS','WF-AUTO-PLUS'] or selected @> array['WF-AI-ASSISTANT','WF-AI-OPERATIONS'] then raise exception 'Choose one plan from each automation and AI family; higher plans replace lower plans.';end if;
 if 'WF-BLUEPRINT'=any(selected) and exists(select 1 from jsonb_array_elements(rules) x where x->>'kind'='package' and x->>'sku'=any(selected)) then raise exception 'Blueprint is included in the implementation package total.';end if;
 for l in select value from jsonb_array_elements(new.lines) loop
  select value into r from jsonb_array_elements(rules) x where x->>'sku'=l->>'catalog_sku';
  if r is null then continue;end if;
  if l->>'cadence'<>r->>'cadence' or l->>'service'<>r->>'service' or (l->>'quantity_units')::numeric<>100 then raise exception 'Keep the catalog service billing basis, category and quantity.';end if;
  if r->>'kind'='monthly' and r->>'sku'<>'WF-MANAGED' and not 'WF-MANAGED'=any(selected) then raise exception 'Monthly add-ons require WorkForge Managed.';end if;
  if r ? 'setup' and not (r->>'setup'=any(selected)) then raise exception 'Include the selected add-on setup fee.';end if;
  if r->>'kind'='setup' and not exists(select 1 from jsonb_array_elements(rules) x where x->>'setup'=r->>'sku' and x->>'sku'=any(selected)) then raise exception 'Add-on setup requires its monthly service.';end if;
 end loop;
 return new;
end $$;
revoke all on function private.hq_package_lines_guard() from public,anon,authenticated;
create trigger hq_package_lines_guard before insert or update of lines,status on public.hq_proposals for each row execute function private.hq_package_lines_guard();
