'use client';
import {useState} from 'react';
import {PACKAGES,MONTHLY_OFFERS,FIELD_BASE_SCOPE,FIELD_SCOPE_RULES,SOLO_SCOPE_RULES,SOLO_EXCLUSIONS,THIRD_PARTY_TERMS,offerFor,buildPackageOffer} from '@/lib/hq-catalog';
import {estimateTotals} from '@/lib/hq-sales';
import type {HQPricebookItem} from '@/lib/hq-estimating';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);

export function PackageCatalog({items,canEstimate,onUse}:{items:HQPricebookItem[];canEstimate:boolean;onUse:(sku:string)=>void}){
  const price=(sku:string)=>{const i=items.find(i=>i.sku===sku);return !i?.active?'Unavailable':i.unit_cents===null?'Price needed':money(i.unit_cents);};
  return <><div className="hq-section-heading"><h2>Field OS packages & pricing</h2></div>
    <p className="hq-muted">Blueprint → implementation → managed services. Package prices include the listed discovery, migration, training and launch allowances. Monthly services are optional and quoted separately.</p>
    <div className="package-grid">{PACKAGES.map(pkg=><section className={'hq-panel package-card'+(pkg.sku==='WF-FIELD-OPERATIONS'?' recommended':'')} key={pkg.sku}>
      <div className="package-label">{pkg.sku==='WF-FIELD-OPERATIONS'?'Recommended for established teams':pkg.sku==='WF-FIELD-SOLO'?'For owner-operators':'BUILD & IMPLEMENTATION'}</div><h3>{pkg.name}</h3><strong className="package-price">{price(pkg.sku)}</strong><span>one time</span><p>{pkg.description}</p>
      <dl>{Object.entries(pkg.details??{}).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <details><summary>Current pricebook scope</summary><p className="hq-preserve">{items.find(i=>i.sku===pkg.sku)?.description??'Catalog activation pending.'}</p></details>
      <button type="button" className={pkg.sku==='WF-FIELD-OPERATIONS'?'primary':'secondary'} disabled={!canEstimate||!items.find(i=>i.sku===pkg.sku)?.active} onClick={()=>onUse(pkg.sku)}>Use {pkg.name}</button>
    </section>)}</div>
    {!canEstimate&&<p className="hq-hint">Select a customer and an implementation or change engagement above to prepare a package estimate.</p>}
    <section className="hq-panel package-included"><h3>Included with every package</h3><ul>{FIELD_BASE_SCOPE.map(s=><li key={s}>{s}</li>)}</ul><p>{FIELD_SCOPE_RULES}</p><p><strong>Field Solo:</strong> {SOLO_SCOPE_RULES} {SOLO_EXCLUSIONS}</p></section>
    <div className="hq-section-heading"><h2>Monthly services & add-ons</h2></div><div className="pricebook-grid">{MONTHLY_OFFERS.map(offer=><section className="hq-panel pricebook-card" key={offer.sku}><div><h3>{offer.name}</h3><p>{items.find(i=>i.sku===offer.sku)?.description??offer.description}</p></div><footer><strong>{price(offer.sku)} / month</strong><span>{offer.setup?price(offer.setup)+' setup':'No additional setup fee'}</span></footer></section>)}</div>
    <section className="hq-panel package-included"><h3>Blueprint & commercial terms</h3><p><strong>{price('WF-BLUEPRINT')} Blueprint</strong> — workflow map, migration assessment, integration list and firm scope. Its fee is credited toward a selected package, not added on top.</p><p>50% to begin, 30% at customer testing, 20% at acceptance. Correct deviations from accepted scope for 60 days after launch. New scope requires a written change order.</p><p>{THIRD_PARTY_TERMS}</p><p className="hq-hint">Standard prices can be edited in Pricebook. Existing saved agreements keep their original prices and scope. Selecting services prepares a quote; it does not activate services or charge a customer.</p></section>
  </>;
}

export function PackageBuilder({items,initialSku='',onApply}:{items:HQPricebookItem[];initialSku?:string;onApply:(offer:ReturnType<typeof buildPackageOffer>)=>void}){
  const [sku,setSku]=useState(initialSku),[care,setCare]=useState('default'),[automation,setAutomation]=useState(''),[ai,setAI]=useState(''),[improvement,setImprovement]=useState(false);
  const requiresManaged=!!automation||!!ai||improvement;
  const solo=sku==='WF-FIELD-SOLO';
  const selectedCare=requiresManaged?'WF-MANAGED':care==='default'?(solo?'WF-SOLO-CARE':'WF-MANAGED'):care==='WF-SOLO-CARE'&&!solo?'WF-MANAGED':care;
  const monthly=[...(selectedCare?[selectedCare]:[]),...(automation?[automation]:[]),...(ai?[ai]:[]),...(improvement?['WF-IMPROVEMENT']:[])];
  let offer:ReturnType<typeof buildPackageOffer>|undefined;let error='';
  if(sku){try{offer=buildPackageOffer(sku,monthly,items);}catch(e){error=e instanceof Error?e.message:'Check package pricing.';}}
  const totals=offer?estimateTotals(offer.lines):null;
  const label=(s:string)=>{const item=items.find(i=>i.sku===s);return (offerFor(s)?.name??s)+' · '+(item?.unit_cents?money(item.unit_cents):'price needed')+(item?.cadence==='monthly'?' / month':'');};
  return <section className="package-builder"><h3>Build from a Field OS package</h3><p>Choose an implementation and optional services. Applying fills the scope, fees and payment schedule; review the customer-specific terms below.</p>
    <label>Implementation package<select value={sku} onChange={e=>setSku(e.target.value)}><option value="">Choose a package</option>{PACKAGES.map(p=><option key={p.sku} value={p.sku}>{label(p.sku)}</option>)}</select></label>
    <div className="hq-form-grid"><label>Automation plan<select value={automation} onChange={e=>setAutomation(e.target.value)}><option value="">None</option>{['WF-AUTO-ESSENTIALS','WF-AUTO-PLUS'].map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label><label>AI plan<select value={ai} onChange={e=>setAI(e.target.value)}><option value="">None</option>{['WF-AI-ASSISTANT','WF-AI-OPERATIONS'].map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label></div>
    <label>Care plan<select value={selectedCare} disabled={requiresManaged} onChange={e=>setCare(e.target.value)}><option value="">None — no ongoing WorkForge care</option>{solo&&<option value="WF-SOLO-CARE">{label('WF-SOLO-CARE')}</option>}<option value="WF-MANAGED">{label('WF-MANAGED')}</option></select></label>
    {requiresManaged&&<p className="hq-hint">Selected add-ons require WorkForge Managed. It replaces Solo Care; only one care plan is charged.</p>}
    <label className="sales-checkbox"><input type="checkbox" checked={improvement} onChange={e=>setImprovement(e.target.checked)}/>{label('WF-IMPROVEMENT')}</label>
    {offer&&totals&&<div className="package-quote"><ul>{offer.lines.map(l=><li key={l.catalog_sku}><span>{offerFor(l.catalog_sku)?.name}</span><strong>{money(l.unit_cents)}{l.cadence==='monthly'?' / month':' one time'}</strong></li>)}</ul><div className="estimate-live-totals"><strong>{money(totals.one_time)} one time</strong><strong>{money(totals.monthly)} / month</strong><span>{money(offer.deposit_cents)} initial payment before tax</span></div></div>}
    <p className="hq-hint">Setup fees are included above. Third-party costs and usage are additional. Applying replaces the current fee lines and standard scope sections; customer identity and legal terms are retained.</p>
    {error&&<p className="error" role="alert">{error}</p>}<button type="button" className="secondary" disabled={!offer} onClick={()=>offer&&onApply(offer)}>Apply package to estimate</button>
  </section>;
}
