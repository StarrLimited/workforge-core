import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler,hash,normalizeRelay,normalizeMeta } from '../supabase/functions/hq-ad-intake/handler.mjs';
const lead={contact_id:'contact-123',form_id:'456',page_id:'123',full_name:'Fixture',email:'fixture@example.invalid',phone:'+13035550100',workforge_key:'secret',answers:{interest:'CRM'}};
test('relay maps GHL contacts and uses stable contact/form deduplication without storing credentials',()=>{const a=normalizeRelay(lead,'meta');const b=normalizeRelay({...lead,customData:{form_id:'789'}},'meta');assert.equal(a.external_id,'ghl:contact-123:456');assert.notEqual(a.external_id,b.external_id);assert.equal(a.attribution.answers.interest,'CRM');assert.ok(!JSON.stringify(a).includes('secret'));assert.equal(normalizeRelay({...lead,lead_id:'provider-1'},'meta').external_id,'provider-1');});
test('provider and relay tests do not create sales contacts',()=>{assert.equal(normalizeRelay({...lead,is_test:'true'},'meta').status,'test');assert.equal(normalizeMeta({id:'1',field_data:[{name:'full_name',values:['<test lead: dummy data for full_name>']}]},{external_id:'1',form_id:'456',page_id:'123'}).status,'test');assert.throws(()=>normalizeRelay({...lead,is_test:'yes'},'meta'));});
test('relay rejects wrong key, wrong page and invalid JSON; save failures remain retryable',async()=>{
 let saved=0;let failSave=false;
 const handler=createHandler({supabaseUrl:'https://db.invalid',serviceKey:'fixture',fetcher:async(url)=>{if(String(url).endsWith('hq_relay_config'))return Response.json({key_hash:await hash('secret'),form_ids:['456'],page_id:'123'});saved++;return failSave?new Response('',{status:500}):Response.json({status:'received'});}});
 const post=body=>handler(new Request('https://fn.invalid?provider=meta&transport=relay',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}));
 assert.equal((await post({...lead,workforge_key:'wrong'})).status,401);assert.equal(saved,0);
 assert.equal((await post({...lead,page_id:'other'})).status,403);assert.equal(saved,0);
 assert.equal((await post('{')).status,400);assert.equal((await post(lead)).status,200);assert.equal(saved,1);
 failSave=true;assert.equal((await post(lead)).status,503);
});
