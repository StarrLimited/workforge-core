import test from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { buildPrompt,generateFieldDraft,aiErrorMessage } from '../lib/ai/generate.ts';
import { estimatePreview,validateDraft,reviewSchema } from '../lib/ai/contracts.ts';
const workspace='5c409bda-c01d-4691-aa3e-9b96e1467981';
const product='7e281ed4-fb6e-4c83-b49d-c0f3905a5f9e';
const snapshot={order:{workspace_id:workspace,title:'Test garden',description:'Refresh garden',target_margin:40,discount_percent:5,tax_rate:8,deposit_percent:25},profile:{goals:'Refresh mulch',measurements:'3 cubic yards',access_notes:'Side gate',site_conditions:'Uneven soil',job_address:'PRIVATE ADDRESS',sales_owner:'PRIVATE OWNER'},pricebook:[{id:product,workspace_id:workspace,name:'Mulch',description:'Supply and install mulch',unit:'cubic yard',category:'Landscape',material_cents:4000,labor_cents:2000,active:true,taxable:true}],approved_estimate:null,tasks:[]};
const draft={summary:'The customer wants fresh mulch; access is through the side gate.',scope:'Install fresh mulch.',notes:'',items:[{product_id:product,quantity:3,quantity_evidence:'3 cubic yards',description:'Supply and install mulch.'}],tasks:[],questions:[]};
const mock=(text)=>new MockLanguageModelV4({doGenerate:async()=>({content:[{type:'text',text}],finishReason:{unified:'stop',raw:undefined},usage:{inputTokens:{total:100,noCache:100,cacheRead:undefined,cacheWrite:undefined},outputTokens:{total:50,text:50,reasoning:undefined}},warnings:[]})});
test('AI structured generation returns validated output and measured usage',async()=>{
 const result=await generateFieldDraft('estimate',snapshot,mock(JSON.stringify(draft)));
 assert.deepEqual(result.result,draft);assert.equal(result.usage.inputTokens,100);assert.equal(result.usage.outputTokens,50);
});
test('Invalid model output never becomes a usable draft; usage remains available',async()=>{
 await assert.rejects(generateFieldDraft('estimate',snapshot,mock('not valid json')));
 const bad={...draft,items:[{...draft.items[0],product_id:'242d7732-fd30-4fd7-b301-f0f60d48b4af'}]};
 await assert.rejects(generateFieldDraft('estimate',snapshot,mock(JSON.stringify(bad))),e=>e.usage.inputTokens===100&&/incomplete/.test(e.message));
});
test('Prompts minimize records and do not expose customer addresses or pricebook costs',()=>{
 const prompt=buildPrompt('estimate',snapshot);assert.match(prompt.system,/untrusted reference data/);assert.match(prompt.prompt,/quantity to null/);
 for(const secret of ['PRIVATE ADDRESS','PRIVATE OWNER','material_cents','labor_cents'])assert.ok(!prompt.prompt.includes(secret));
 assert.throws(()=>buildPrompt('estimate',{...snapshot,profile:{...snapshot.profile,goals:'a'.repeat(49000)}}),/too large/);
});
test('Pricebook costs and job margin determine cents, tax, discount and deposit',()=>{
 const preview=estimatePreview(snapshot,draft.items);
 assert.equal(preview.lines[0].unit_price_cents,10000);assert.equal(preview.totals.price_cents,30780);assert.equal(preview.totals.deposit_cents,7695);
 assert.equal(preview.totals.material_cost_cents,12000);assert.equal(preview.totals.labor_cost_cents,6000);
});
test('Missing measurements stay unresolved until a reviewer supplies quantities',()=>{
 const unknown={...draft,items:[{...draft.items[0],quantity:null}]};assert.equal(validateDraft('estimate',unknown,snapshot).items[0].quantity,null);
 assert.throws(()=>estimatePreview(snapshot,unknown.items),/Confirm/);
 assert.equal(reviewSchema.safeParse({scope:draft.scope,items:unknown.items}).success,false);
 assert.throws(()=>estimatePreview(snapshot,[{...draft.items[0],quantity:1.2345}]),/Quantity/);
});
test('Unknown, duplicate and cross-workspace pricebook IDs cannot price a draft',()=>{
 assert.throws(()=>estimatePreview(snapshot,[...draft.items,...draft.items]),/unique/);
 assert.throws(()=>estimatePreview({...snapshot,pricebook:[{...snapshot.pricebook[0],workspace_id:'other'}]},draft.items),/workspace/);
 assert.throws(()=>validateDraft('estimate',{...draft,items:[...draft.items,...draft.items]},snapshot),/unavailable/);
});
test('Provider failures give useful instructions without leaking provider messages or secrets',()=>{
 assert.match(aiErrorMessage({statusCode:402,message:'secret'}),/billing or credit restriction/);
 assert.match(aiErrorMessage({name:'AbortError',message:'secret'}),/timed out/);
 assert.ok(!aiErrorMessage(new Error('sk-private-secret')).includes('sk-private'));
});
