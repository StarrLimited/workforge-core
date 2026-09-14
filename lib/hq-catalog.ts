import type { EstimateLine } from './hq-sales';
import type { HQPricebookItem } from './hq-estimating';

export type CatalogOffer = {
  sku:string; name:string; price:number; service:EstimateLine['service'];
  cadence:EstimateLine['cadence']; kind:'package'|'monthly'|'setup'|'blueprint';
  description:string; details?:Record<string,string>; setup?:string;
};
export const FIELD_BASE_SCOPE = [
  'Company branding, a dedicated business environment, and role-based access.',
  'Contacts, lead intake, sales stages, appointments, and follow-up tasks.',
  'Service pricebook using customer-approved prices and units.',
  'Estimates, customer-supplied agreement terms, client and team signatures, and accepted-version records.',
  'Approved estimate conversion to a scheduled job; crew assignments, documents, photos, completion checklists, and customer service requests.',
  'Invoice preparation and accounting handoff. Automatic accounting synchronization requires a selected supported integration.',
  'One authorized business email sender, PDF output, and data export.',
];
export const FIELD_SCOPE_RULES = 'A tailored process adapts stages, required information, responsibilities and approvals within existing modules. A supported connection covers one external account using an already tested connector; data direction and functions must be agreed. Onboarding counts are training allowances, not WorkForge seat charges. Migration includes mapping, a test import, customer review and final import.';
export const THIRD_PARTY_TERMS = 'Third-party hosting, database/storage, email accounts, SMS, AI usage, automation platforms and payment processing are additional and preferably billed directly to the customer. Agree the estimated total monthly bill and usage caps before activation. No unlimited usage is included.';
export const AUTOMATION_TERMS = 'A standard automation has one trigger and up to five actions across no more than two systems. One run is one execution; retries caused by WorkForge do not count. Basic application actions included in the build do not require this add-on. Automation Plus replaces Essentials.';
export const AI_TERMS = 'AI produces drafts and recommendations for human review. Pricing uses approved pricebooks and rules. Sending messages, changing prices or making financial commitments requires an explicitly configured approval process. AI Operations replaces AI Assistant.';
export const CATALOG:CatalogOffer[] = [
  {sku:'WF-FIELD-FOUNDATION',name:'Field Foundation',price:295000,service:'implementation',cadence:'one_time',kind:'package',description:'A complete Field OS for an owner-led service business with straightforward jobs.',details:{
    'Company coverage':'One company, one location',Discovery:'One 90-minute workshop','Tailored operating processes':'One',
    'Estimate / contract layouts':'One', 'Field forms / checklists':'Two',Production:'Scheduling, assignments, job notes, photos and completion',
    Reporting:'Standard owner dashboard','Additional supported integrations':'None',
    Migration:'One source; up to 1,000 contacts, 100 pricebook items and 20 open jobs',Onboarding:'Up to five users',Training:'One 90-minute session',
    'Guided launch support':'14 days','Target delivery':'2–3 weeks after scope approval and receipt of usable data and access',
  }},
  {sku:'WF-FIELD-OPERATIONS',name:'Field Operations',price:595000,service:'implementation',cadence:'one_time',kind:'package',description:'Our main Field OS offer for established businesses managing multiple crews, vendors and subcontractors.',details:{
    'Company coverage':'One company, one location',Discovery:'Two 90-minute workshops','Tailored operating processes':'Up to three',
    'Estimate / contract layouts':'Three','Field forms / checklists':'Five',Production:'Foundation production tools plus purchasing, work orders, subcontractor commitments and change orders',
    Reporting:'Owner dashboard, committed versus actual job costs, margins, and crew/subcontractor reporting','Additional supported integrations':'Two',
    Migration:'One source; up to 5,000 contacts, 500 pricebook items and 100 open jobs',Onboarding:'Up to 15 users',Training:'Three 60-minute sessions',
    'Guided launch support':'30 days','Target delivery':'3–5 weeks after scope approval and receipt of usable data and access',
  }},
  {sku:'WF-FIELD-SCALE',name:'Field Scale',price:995000,service:'implementation',cadence:'one_time',kind:'package',description:'Field OS for one business with several departments or branches and more approval requirements.',details:{
    'Company coverage':'One company, up to three branches',Discovery:'Three 90-minute workshops','Tailored operating processes':'Up to five',
    'Estimate / contract layouts':'Five','Field forms / checklists':'Ten',Production:'Operations production tools plus branch workflows, approval thresholds and department handoffs',
    Reporting:'Operations reporting plus branch comparisons and up to three custom management reports','Additional supported integrations':'Four',
    Migration:'Two sources; up to 10,000 contacts, 1,000 pricebook items and 250 open jobs',Onboarding:'Up to 30 users',Training:'Five 60-minute sessions',
    'Guided launch support':'45 days','Target delivery':'5–8 weeks after scope approval and receipt of usable data and access',
  }},
  {sku:'WF-BLUEPRINT',name:'WorkForge Blueprint',price:50000,service:'blueprint',cadence:'one_time',kind:'blueprint',description:'Paid discovery delivering a workflow map, migration assessment, integration list and firm build scope. Credited toward a selected implementation package; not an additional charge on top of that package.'},
  {sku:'WF-MANAGED',name:'WorkForge Managed',price:14900,service:'support',cadence:'monthly',kind:'monthly',description:'Application monitoring, scheduled backups, routine maintenance, supported-connector monitoring, defect troubleshooting and 30 minutes of user assistance monthly. Setup included with implementation. Business-hours support; response targets of one business day for critical failures and two business days for routine requests. Response and resolution times are separate.'},
  {sku:'WF-AUTO-ESSENTIALS',name:'Automation Essentials',price:9900,service:'software',cadence:'monthly',kind:'monthly',setup:'WF-AUTO-ESSENTIALS-SETUP',description:'Configure and maintain up to five active automations and 1,000 workflow runs monthly. Requires WorkForge Managed. '+AUTOMATION_TERMS},
  {sku:'WF-AUTO-PLUS',name:'Automation Plus',price:19900,service:'software',cadence:'monthly',kind:'monthly',setup:'WF-AUTO-PLUS-SETUP',description:'Up to 12 active automations and 5,000 workflow runs monthly, including more complex routing and approval sequences. Requires WorkForge Managed. '+AUTOMATION_TERMS},
  {sku:'WF-AI-ASSISTANT',name:'AI Assistant',price:9900,service:'software',cadence:'monthly',kind:'monthly',setup:'WF-AI-ASSISTANT-SETUP',description:'Three functions: summarize leads and job history, draft estimate scope from supplied information, and draft customer follow-ups. Requires WorkForge Managed. '+AI_TERMS},
  {sku:'WF-AI-OPERATIONS',name:'AI Operations',price:24900,service:'software',cadence:'monthly',kind:'monthly',setup:'WF-AI-OPERATIONS-SETUP',description:'AI Assistant functions plus two selected functions: vendor-invoice extraction, field notes into draft updates, or an owner briefing. Agree the two functions during discovery. Requires WorkForge Managed. '+AI_TERMS},
  {sku:'WF-IMPROVEMENT',name:'Continuous Improvement',price:24900,service:'support',cadence:'monthly',kind:'monthly',description:'Two hours monthly for small workflow, form, report or pricebook changes. Unused hours expire monthly. Requires WorkForge Managed. No setup fee.'},
  {sku:'WF-AUTO-ESSENTIALS-SETUP',name:'Automation Essentials setup',price:49500,service:'implementation',cadence:'one_time',kind:'setup',description:'Initial configuration, approval rules, failure handling and testing of the selected Automation Essentials workflows.'},
  {sku:'WF-AUTO-PLUS-SETUP',name:'Automation Plus setup',price:99500,service:'implementation',cadence:'one_time',kind:'setup',description:'Initial configuration, routing, approval rules, failure handling and testing of the selected Automation Plus workflows.'},
  {sku:'WF-AI-ASSISTANT-SETUP',name:'AI Assistant setup',price:49500,service:'implementation',cadence:'one_time',kind:'setup',description:'Connect and configure the three AI Assistant functions, approved information sources, human review and spending limits; test representative outputs.'},
  {sku:'WF-AI-OPERATIONS-SETUP',name:'AI Operations setup',price:149500,service:'implementation',cadence:'one_time',kind:'setup',description:'Configure AI Assistant plus two agreed operations functions, approved data sources, human review, spending limits and acceptance tests.'},
];
export const PACKAGES=CATALOG.filter(o=>o.kind==='package');
export const MONTHLY_OFFERS=CATALOG.filter(o=>o.kind==='monthly');
export function catalogDescription(offer:CatalogOffer){
  return [offer.description,...Object.entries(offer.details??{}).map(([k,v])=>`${k}: ${v}.`),...(offer.kind==='package'?['All packages include:',...FIELD_BASE_SCOPE,FIELD_SCOPE_RULES]:[])].join('\n');
}
export function offerFor(sku?:string){return CATALOG.find(o=>o.sku===sku);}
export function lineFromPricebook(item:HQPricebookItem):EstimateLine {
  return {catalog_sku:item.sku,description:(item.name+' — '+item.description).slice(0,500),service:item.service,cadence:item.cadence,quantity_units:100,unit_cents:item.unit_cents??0,discount_cents:0};
}
export function packageLineErrors(lines:EstimateLine[]):string[]{
  const selected=lines.map(l=>l.catalog_sku).filter((s):s is string=>!!s), errors:string[]=[];
  if(PACKAGES.filter(p=>selected.includes(p.sku)).length>1)errors.push('Choose one Field implementation package per estimate.');
  for(const sku of new Set(selected))if(selected.filter(s=>s===sku).length>1)errors.push('Remove the duplicate '+(offerFor(sku)?.name??sku)+' line.');
  for(const pair of [['WF-AUTO-ESSENTIALS','WF-AUTO-PLUS'],['WF-AI-ASSISTANT','WF-AI-OPERATIONS']])if(pair.every(s=>selected.includes(s)))errors.push('Choose '+offerFor(pair[0])!.name+' or '+offerFor(pair[1])!.name+'; the higher plan replaces the lower plan.');
  if(selected.includes('WF-BLUEPRINT')&&PACKAGES.some(p=>selected.includes(p.sku)))errors.push('Blueprint is included in the package total. Quote it separately only for a standalone Blueprint engagement.');
  for(const line of lines){const offer=offerFor(line.catalog_sku);if(!offer)continue;
    if(line.cadence!==offer.cadence||line.quantity_units!==100||line.service!==offer.service)errors.push(offer.name+' is one '+(offer.cadence==='monthly'?'monthly service':'fixed-fee service')+'. Keep its billing basis, category and quantity.');
    if(offer.kind==='monthly'&&offer.sku!=='WF-MANAGED'&&!selected.includes('WF-MANAGED'))errors.push(offer.name+' requires WorkForge Managed.');
    if(offer.setup&&!selected.includes(offer.setup))errors.push('Include '+offerFor(offer.setup)!.name+' with '+offer.name+'.');
    if(offer.kind==='setup'&&!CATALOG.some(o=>o.setup===offer.sku&&selected.includes(o.sku)))errors.push(offer.name+' requires its monthly service.');
  }
  return errors;
}
export function buildPackageOffer(packageSku:string,monthlySkus:string[],items:HQPricebookItem[]){
  const pkg=PACKAGES.find(p=>p.sku===packageSku);if(!pkg)throw new Error('Choose a Field implementation package.');
  if(monthlySkus.some(s=>!MONTHLY_OFFERS.some(o=>o.sku===s)))throw new Error('Choose a supported monthly service.');
  const monthly=[...new Set(monthlySkus)];if(monthly.some(s=>s!=='WF-MANAGED')&&!monthly.includes('WF-MANAGED'))monthly.unshift('WF-MANAGED');
  const skus=[packageSku,...monthly.flatMap(s=>offerFor(s)?.setup?[offerFor(s)!.setup!,s]:[s])];
  const selected=skus.map(s=>{const item=items.find(i=>i.sku===s);if(!item?.active||!item.unit_cents)throw new Error((offerFor(s)?.name??s)+' needs an active standard price in the pricebook.');return item;});
  const lines=selected.map(lineFromPricebook),errors=packageLineErrors(lines);if(errors.length)throw new Error(errors[0]);
  const oneTime=lines.filter(l=>l.cadence==='one_time').reduce((n,l)=>n+l.unit_cents,0),deposit=Math.round(oneTime*.5);
  const dollars=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
  const document:Record<string,string>={
    scope:selected.map(i=>i.name+'\n'+i.description).join('\n\n')+'\n\n'+FIELD_SCOPE_RULES,
    exclusions:'New modules and new API development, historical invoices, attachments and extensive data cleanup are separately scoped. Work outside the listed allowances requires a written change order. '+THIRD_PARTY_TERMS,
    assumptions:'Customer supplies approved prices, agreement terms, usable exports and authorized account access; names a decision-maker, testing lead and launch approver; reviews migration samples and participates in acceptance testing. Confirm selected processes, integrations and monthly usage limits during discovery.',
    timeline:pkg.details!['Target delivery']+'. Milestones: scope approval → working system and customer testing → acceptance and launch. '+pkg.details!['Guided launch support']+' of guided launch support. [Complete customer dates, dependencies and named owners.]',
    payment:'Implementation and add-on setup total before tax: '+dollars(oneTime)+'. 50% to begin ('+dollars(deposit)+'), 30% when the working system is ready for customer testing ('+dollars(Math.round(oneTime*.3))+'), and the balance at acceptance ('+dollars(oneTime-deposit-Math.round(oneTime*.3))+'). The $500 Blueprint is included in the package price. If already separately purchased, apply its credit to the implementation line, reference the earlier agreement, and deduct verified payment from the first milestone. Do not charge twice or mark a payment received without evidence. [Complete prior Blueprint credit/payment reference, if applicable, and tax treatment.]',
    subscription:monthly.length?'Selected monthly services: '+monthly.map(s=>offerFor(s)!.name).join(', ')+'. '+THIRD_PARTY_TERMS+' [Complete start date, renewal/cancellation terms, provider cost estimate, usage allowances and caps.]':'No WorkForge monthly services selected. '+THIRD_PARTY_TERMS+' [Complete customer responsibility for ongoing operation and maintenance.]',
    support:'Correct deviations from the accepted implementation scope for 60 days after launch. New requests are enhancements. Guided launch support: '+pkg.details!['Guided launch support']+'. '+(monthly.includes('WF-MANAGED')?'WorkForge Managed provides business-hours service, with one-business-day response targets for critical failures and two business days for routine requests. Response time is separate from resolution time. Includes monitoring, scheduled backups, routine maintenance, supported-connector monitoring, defect troubleshooting and 30 minutes of user assistance monthly. [Complete service hours, timezone, contact and backup/recovery terms.]':'Ongoing managed support is not selected. [Complete support contact and post-warranty arrangements.]'),
  };
  return {title:pkg.name+' — implementation & services',lines,document,deposit_cents:deposit};
}
