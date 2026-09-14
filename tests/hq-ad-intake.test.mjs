import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createHandler, hash, normalizeGoogle, normalizeMeta, parseBody, validSignature } from '../supabase/functions/hq-ad-intake/handler.mjs';
import { subscriptionMRR, workflowIssues } from '../lib/hq.ts';

const lead={lead_id:'google-lead-1',form_id:123,campaign_id:456,google_key:'fixture-key',user_column_data:[{column_id:'FULL_NAME',string_value:'Test Person'},{column_id:'EMAIL',string_value:'person@example.invalid'},{column_id:'PHONE_NUMBER',string_value:'+13035550100'},{column_id:'COMPANY_NAME',string_value:'Fixture Co'}]};
const make=async(provider='google_ads',fetchGraph)=>{
 const calls=[];
 const config={key_hash:await hash('fixture-key'),page_id:'123',form_ids:['123'],app_secret:'test-secret',page_token:'test-token',graph_version:'v25.0'};
 const handler=createHandler({supabaseUrl:'https://db.invalid',serviceKey:'service-fixture',fetcher:async(url,options)=>{
  if(String(url).startsWith('https://graph.facebook.com')) {calls.push({graph:true});return fetchGraph?fetchGraph():Response.json({id:'789',form_id:'123',field_data:[{name:'full_name',values:['Meta Contact']},{name:'phone_number',values:['+13035550101']}]});}
  const name=String(url).split('/').pop();const body=JSON.parse(options.body);calls.push({name,body});
  if(name==='hq_ad_config')return Response.json(config);
  return Response.json({status:body.p_lead.status});
 }});
 const post=async(body,signature)=>handler(new Request(`https://fn.invalid?provider=${provider}`,{method:'POST',headers:signature?{'x-hub-signature-256':signature}:{},body:typeof body==='string'?body:JSON.stringify(body)}));
 return {handler,calls,post};
};
test('Google maps contact and campaign fields and strips the secret',()=>{
 const n=normalizeGoogle(lead);assert.equal(n.phone,'+13035550100');assert.equal(n.company,'Fixture Co');assert.equal(n.attribution.campaign_id,'456');assert.ok(!JSON.stringify(n).includes('fixture-key'));
});
test('Google parses int64 form IDs without rounding',()=>{
 const body=parseBody(new TextEncoder().encode('{"form_id":9223372036854775807,"campaign_id":123}'));assert.equal(body.form_id,'9223372036854775807');assert.equal(body.campaign_id,123);
});
test('Google tests have no customer data; unknown columns remain available',()=>{
 assert.equal(normalizeGoogle({...lead,is_test:true}).status,'test');assert.equal(normalizeGoogle({...lead,is_test:true}).email,undefined);
 const n=normalizeGoogle({...lead,user_column_data:[...lead.user_column_data,{column_id:'NEW_FIELD',string_value:'answer'}]});assert.equal(n.attribution.answers.NEW_FIELD,'answer');
});
test('Google rejects unauthenticated leads without writes',async()=>{
 const f=await make();assert.equal((await f.post({...lead,google_key:'wrong'})).status,401);assert.equal(f.calls.filter(c=>c.name==='hq_receive_ad').length,0);
});
test('Google saves only after credential verification and reports storage failures as retryable',async()=>{
 const f=await make();assert.equal((await f.post(lead)).status,200);assert.equal(f.calls.at(-1).body.p_lead.status,'received');
 const handler=createHandler({supabaseUrl:'https://db.invalid',serviceKey:'service-fixture',fetcher:async url=>String(url).endsWith('hq_ad_config')?Response.json({key_hash:await hash('fixture-key')}):Response.json({error:'unavailable'},{status:500})});
 assert.equal((await handler(new Request('https://fn.invalid?provider=google_ads',{method:'POST',body:JSON.stringify(lead)}))).status,503);
});
const event={object:'page',entry:[{id:'123',changes:[{field:'leadgen',value:{leadgen_id:'789',page_id:'123',form_id:'123'}}]}]};
test('Meta verifies raw HMAC before graph fetch or receipt writes',async()=>{
 const f=await make('meta');assert.equal((await f.post(event,'sha256='+'0'.repeat(64))).status,401);assert.equal(f.calls.length,1);
 const raw=JSON.stringify(event);const signature='sha256='+createHmac('sha256','test-secret').update(raw).digest('hex');
 assert.equal(await validSignature(new TextEncoder().encode(raw),signature,'test-secret'),true);
 assert.equal((await f.post(raw,signature)).status,200);assert.equal(f.calls.filter(c=>c.name==='hq_receive_ad').length,2);
});
test('Meta retains failed receipt for retry without creating an account',async()=>{
 const f=await make('meta',()=>Response.json({error:'expired token'},{status:401}));const raw=JSON.stringify(event);
 assert.equal((await f.post(raw,'sha256='+createHmac('sha256','test-secret').update(raw).digest('hex'))).status,503);
 assert.equal(f.calls.at(-1).body.p_lead.status,'failed');assert.equal(f.calls.at(-1).body.p_lead.error_code,'meta_fetch_401');
});
test('Meta ignores other pages/forms and rejects identity mismatch',async()=>{
 const f=await make('meta');const raw=JSON.stringify({...event,entry:[{...event.entry[0],id:'999'}]});assert.equal((await f.post(raw,'sha256='+createHmac('sha256','test-secret').update(raw).digest('hex'))).status,200);assert.equal(f.calls.length,1);
 assert.throws(()=>normalizeMeta({id:'wrong',field_data:[]},{external_id:'789',form_id:'123'}));
});
test('Meta verification responds only to the configured token',async()=>{
 const f=await make('meta');const base='https://fn.invalid?provider=meta&hub.mode=subscribe&hub.challenge=12345&hub.verify_token=';
 assert.equal((await f.handler(new Request(base+'wrong'))).status,403);assert.equal(await (await f.handler(new Request(base+'fixture-key'))).text(),'12345');
});
test('Malformed contacts and oversized bodies fail without data loss being reported as success',async()=>{
 assert.throws(()=>normalizeGoogle({...lead,user_column_data:[]}));assert.throws(()=>normalizeGoogle({...lead,is_test:'true'}));
 const f=await make();assert.equal((await f.post('x'.repeat(131073))).status,413);assert.equal((await f.post('not JSON')).status,400);
});
test('MRR excludes proposals, trials, cancellations and future/end dates, normalizing annual fees',()=>{
 const base={status:'active',starts_on:'2026-09-01',ends_on:null,cadence:'monthly',amount_cents:10000};
 assert.equal(subscriptionMRR([base,{...base,cadence:'annual',amount_cents:120000},{...base,status:'trial'},{...base,status:'cancelled'},{...base,starts_on:'2026-10-01'},{...base,ends_on:'2026-09-14'}],'2026-09-14'),20000);
});
test('Workflow audit exposes missing project and support handoff',()=>{
 const d={accounts:[{id:'a',stage:'won'},{id:'b',stage:'won'}],implementations:[{account_id:'b',status:'building',target_on:null}],supportPlans:[]};
 assert.equal(workflowIssues(d,'2026-09-14').length,3);
});
