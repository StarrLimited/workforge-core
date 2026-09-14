import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOG,catalogDescription,buildPackageOffer,packageLineErrors,lineFromPricebook} from '../lib/hq-catalog.ts';
import {estimateTotals,proposalSchema} from '../lib/hq-sales.ts';
const items=CATALOG.map((o,i)=>({...o,id:String(i),unit_cents:o.price,unit_label:o.cadence==='monthly'?'month':'project',active:true,description:catalogDescription(o),updated_at:'2026-09-14T00:00:00Z'}));

test('Approved packages reproduce the quoted build and managed totals with complete scope',()=>{
  for(const [sku,price] of [['WF-FIELD-FOUNDATION',295000],['WF-FIELD-OPERATIONS',595000],['WF-FIELD-SCALE',995000]]){
    const offer=buildPackageOffer(sku,['WF-MANAGED'],items);
    assert.deepEqual(estimateTotals(offer.lines),{one_time:price,monthly:14900,annual:0});
    assert.equal(offer.deposit_cents,price/2);
    for(const text of ['Migration:','Training:','Company coverage:','pricebook','signatures','accounting handoff'])assert.ok(offer.document.scope.includes(text));
    assert.ok(offer.document.exclusions.includes('Third-party'));
    assert.ok(offer.document.payment.includes('$500 Blueprint is included'));
  }
});
test('Automation and AI add exactly one setup fee each and include required Managed',()=>{
  const auto=buildPackageOffer('WF-FIELD-OPERATIONS',['WF-AUTO-ESSENTIALS'],items);
  assert.deepEqual(estimateTotals(auto.lines),{one_time:644500,monthly:24800,annual:0});
  const both=buildPackageOffer('WF-FIELD-OPERATIONS',['WF-AUTO-ESSENTIALS','WF-AI-ASSISTANT'],items);
  assert.deepEqual(estimateTotals(both.lines),{one_time:694000,monthly:34700,annual:0});
  assert.equal(both.deposit_cents,347000);
  assert.equal(both.lines.filter(l=>l.catalog_sku==='WF-MANAGED').length,1);
  assert.ok(both.document.scope.includes('1,000 workflow runs'));
});
test('Recurring service choice is optional, duplicate selections collapse, higher plans replace lower ones',()=>{
  assert.equal(estimateTotals(buildPackageOffer('WF-FIELD-FOUNDATION',[],items).lines).monthly,0);
  assert.equal(buildPackageOffer('WF-FIELD-FOUNDATION',['WF-MANAGED','WF-MANAGED'],items).lines.length,2);
  assert.throws(()=>buildPackageOffer('WF-FIELD-SCALE',['WF-AUTO-PLUS','WF-AUTO-ESSENTIALS'],items),/replaces/);
  assert.throws(()=>buildPackageOffer('WF-FIELD-SCALE',['WF-AI-ASSISTANT','WF-AI-OPERATIONS'],items),/replaces/);
  const premium=buildPackageOffer('WF-FIELD-SCALE',['WF-AUTO-PLUS','WF-AI-OPERATIONS','WF-IMPROVEMENT'],items);
  assert.deepEqual(estimateTotals(premium.lines),{one_time:1244000,monthly:84600,annual:0});
});
test('Selections use current catalog rates and cannot use archived or unpriced services',()=>{
  const updated=items.map(i=>i.sku==='WF-MANAGED'?{...i,unit_cents:17900}:i);
  assert.equal(estimateTotals(buildPackageOffer('WF-FIELD-FOUNDATION',['WF-MANAGED'],updated).lines).monthly,17900);
  for(const patch of [{active:false},{unit_cents:null}])assert.throws(()=>buildPackageOffer('WF-FIELD-FOUNDATION',['WF-MANAGED'],items.map(i=>i.sku==='WF-MANAGED'?{...i,...patch}:i)),/active standard price/);
});
test('Proposal validation retains catalog identity and rejects double charging and missing dependencies',()=>{
  const offer=buildPackageOffer('WF-FIELD-OPERATIONS',['WF-AUTO-ESSENTIALS'],items);
  const proposal={...offer,opportunity_id:'10000000-0000-4000-8000-000000000001',valid_until:'2026-10-01',tax_cents:0,terms_reviewed:false};
  assert.equal(proposalSchema.parse(proposal).lines[0].catalog_sku,'WF-FIELD-OPERATIONS');
  for(const lines of [
    offer.lines.filter(l=>l.catalog_sku!=='WF-MANAGED'),
    offer.lines.filter(l=>l.catalog_sku!=='WF-AUTO-ESSENTIALS-SETUP'),
    [...offer.lines,lineFromPricebook(items.find(i=>i.sku==='WF-BLUEPRINT'))],
    [...offer.lines,offer.lines[0]],
    offer.lines.map((l,i)=>i===0?{...l,cadence:'monthly'}:l),
  ])assert.equal(proposalSchema.safeParse({...proposal,lines}).success,false);
  assert.deepEqual(packageLineErrors([{description:'Existing custom estimate',service:'implementation',cadence:'one_time',quantity_units:100,unit_cents:10000,discount_cents:0}]),[]);
});
