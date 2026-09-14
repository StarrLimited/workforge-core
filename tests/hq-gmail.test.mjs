import test from 'node:test';import assert from 'node:assert/strict';
import {createHandler,estimateEmail} from '../supabase/functions/hq-gmail/handler.mjs';
const URL='https://fixture.supabase.co',key='service-fixture',pid='00000000-0000-4000-8000-000000000001';
function harness({role='owner',alias=true,sendStatus=200,connected=true}={}){
 const calls=[],finishes=[];const config={client_id:'fixture.apps.googleusercontent.com',client_secret:'private-secret',...(connected?{refresh_token:'private-refresh-token',connected_at:'2026-09-14T00:00:00Z'}:{})};
 const f=async(url,options={})=>{calls.push({url,options});let data={};
 if(url.endsWith('/auth/v1/user'))data={id:'owner-user'};
 else if(url.includes('/workspace_memberships?'))data=[{role}];
 else if(url.endsWith('/rpc/hq_gmail_backend')){const b=JSON.parse(options.body);if(b.p_action==='get')data=config;if(b.p_action==='begin_send')data={id:'delivery'};if(b.p_action==='finish_send'){if(finishes.length)return new Response(JSON.stringify({message:'Delivery state changed'}),{status:400});finishes.push(b.p_data);data=b.p_data;}if(b.p_action==='consume')data=null;}
 else if(url.endsWith('/rpc/hq_create_signing_request'))data={id:'request',token:'b'.repeat(64)};
 else if(url.includes('/hq_proposals?'))data=[{id:pid,number:'WF-QA',revision:2,status:'issued'}];
 else if(url==='https://oauth2.googleapis.com/token')data={access_token:'private-access-token'};
 else if(url.includes('/settings/sendAs'))data={sendAs:alias?[{sendAsEmail:'estimating@workforgeos.com',verificationStatus:'accepted'}]:[]};
 else if(url.endsWith('/messages/send'))return new Response(JSON.stringify(sendStatus===200?{id:'gmail-123'}:{error:{message:'raw provider detail'}}),{status:sendStatus});
 else throw new Error('Unexpected URL '+url);
 return new Response(JSON.stringify(data),{status:200});};
 return {handler:createHandler({supabaseUrl:URL,serviceKey:key,fetchImpl:f}),calls,finishes};
}
const req=body=>new Request(URL+'/functions/v1/hq-gmail',{method:'POST',headers:{Authorization:'Bearer user-fixture','Content-Type':'application/json'},body:JSON.stringify(body)});
const send={action:'send',proposal_id:pid,recipient:'buyer@example.invalid',subject:'WorkForge estimate',message:'Please review.',confirmed:true};
test('Gmail status never exposes OAuth credentials or tokens',async()=>{const h=harness();const r=await h.handler(req({action:'status'}));const text=await r.text();assert.ok(!text.includes('private-'));assert.equal(JSON.parse(text).sender,'estimating@workforgeos.com');});
test('Gmail configuration rejects members and sending rejects read-only users',async()=>{let h=harness({role:'member'});assert.equal((await h.handler(req({action:'configure',client_id:'evil',client_secret:'secret'}))).status,403);h=harness({role:'read_only'});assert.equal((await h.handler(req(send))).status,403);assert.equal(h.calls.filter(c=>c.url.includes('googleapis.com')).length,0);});
test('Gmail requires reviewed recipient/message and verified estimating alias',async()=>{const h=harness({alias:false});const r=await h.handler(req(send));assert.equal(r.status,400);assert.match((await r.json()).error,/verify estimating@workforgeos.com/);assert.ok(!h.calls.some(c=>c.url.endsWith('/messages/send')));const second=harness();assert.equal((await second.handler(req({...send,confirmed:false}))).status,400);});
test('Gmail success records one delivery only after Gmail returns a message id',async()=>{const h=harness();const r=await h.handler(req(send));assert.equal(r.status,200);assert.deepEqual(h.finishes,[{id:'delivery',status:'sent',gmail_id:'gmail-123'}]);assert.equal(h.calls.filter(c=>c.url.endsWith('/messages/send')).length,1);});
test('An uncertain Gmail response is not retried or shown as sent',async()=>{const h=harness({sendStatus:500});const r=await h.handler(req(send));assert.equal(r.status,400);assert.equal(h.finishes[0].status,'unknown');assert.equal(h.calls.filter(c=>c.url.endsWith('/messages/send')).length,1);assert.match((await r.json()).error,/Check Gmail Sent/);});
test('Definitive Gmail rejection remains failed and never reveals provider details',async()=>{const h=harness({sendStatus:400});const r=await h.handler(req(send));assert.equal(h.finishes[0].status,'failed');const text=await r.text();assert.ok(!text.includes('raw provider detail'));assert.ok(!text.includes('private-'));});
test('Expired OAuth state stops before code exchange',async()=>{const h=harness();const r=await h.handler(new Request(URL+'/functions/v1/hq-gmail/callback?state=bad&code=bad'));assert.equal(r.status,303);assert.ok(r.headers.get('Location').endsWith('mail=authorization_failed'));assert.ok(!h.calls.some(c=>c.url==='https://oauth2.googleapis.com/token'));});
test('Email encoding preserves Unicode and rejects injected headers',()=>{const input={recipient:'buyer@example.invalid',subject:'Your estimate — WorkForge',message:'Thanks, José',link:'https://workforge-development.vercel.app/agreements/review#'+'a'.repeat(64),number:'WF-QA',revision:2};const raw=Buffer.from(estimateEmail(input),'base64url').toString('utf8');assert.match(raw,/From: WorkForge Estimating <estimating@workforgeos.com>/);assert.match(Buffer.from(raw.split('\r\n\r\n')[1],'base64').toString('utf8'),/José/);assert.throws(()=>estimateEmail({...input,subject:'Hi\r\nBcc: other@example.invalid'}));});
