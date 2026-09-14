import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from 'ai';
import { AI_MODEL,generateFieldDraft } from '../lib/ai/generate.ts';
import { aiFailure } from '../lib/ai/errors.ts';

const snapshot = {order:{title:'Fictional consultation',description:'Mulch refresh'},profile:{goals:'Refresh mulch'},pricebook:[],approved_estimate:null,tasks:[]};

test('Real Gateway SDK errors retain distinct auth, credit, plan and access diagnoses', async () => {
 const cases = [
  {status:401,type:'authentication_error',message:'Invalid API key',code:'AUTH'},
  {status:402,type:'authentication_error',message:'Insufficient credits',code:'CREDITS'},
  {status:403,type:'authentication_error',message:'This model is not available on the free tier',code:'MODEL-PLAN'},
  {status:403,type:'forbidden',message:'Routing rule denied this request',code:'ACCESS'},
  {status:402,type:'invalid_request_error',message:'Your project budget has been exceeded',code:'BUDGET'},
  {status:429,type:'rate_limit_exceeded',message:'Too many requests',code:'RATE'},
  {status:404,type:'model_not_found',message:'Model not found',code:'MODEL'},
 ];
 for (const item of cases) {
  let calls = 0;
  const provider = createGateway({apiKey:'fictional-secret-key',fetch:async () => {
   calls++;
   return new Response(JSON.stringify({error:{type:item.type,message:`${item.message}. PRIVATE CUSTOMER DETAILS fictional-secret-key`}}),{status:item.status,headers:{'content-type':'application/json'}});
  }});
  await assert.rejects(generateFieldDraft('consultation',snapshot,provider(AI_MODEL)),error => {
   const failure = aiFailure(error,'api-key');
   assert.equal(failure.code,item.code);
   assert.equal(failure.status,item.status);
   assert.equal(failure.credential,'api-key');
   assert.match(failure.message,/No job changes were made/);
   assert.doesNotMatch(JSON.stringify(failure),/PRIVATE CUSTOMER|fictional-secret/);
   return true;
  });
  assert.equal(calls,1,'The diagnostic change must not retry rejected requests');
 }
});

test('Nested, malformed and cyclic errors remain bounded and do not expose raw data', () => {
 const original = {statusCode:402,responseBody:JSON.stringify({error:{message:'Insufficient credits PRIVATE CUSTOMER'}})};
 const nested = new Error('PRIVATE CUSTOMER',{cause:new Error('wrapper',{cause:original})});
 assert.equal(aiFailure(nested,'api-key').code,'CREDITS');
 const cycle = {message:'PRIVATE CUSTOMER',responseBody:'not json'};
 cycle.cause = cycle;
 assert.equal(aiFailure(cycle).code,'PROVIDER');
 for (const error of [cycle,null,'secret',new Error('sk-secret')]) assert.doesNotMatch(JSON.stringify(aiFailure(error)),/PRIVATE CUSTOMER|sk-secret/);
 assert.match(aiFailure({statusCode:401},'api-key').message,/API key is configured/);
 assert.match(aiFailure({statusCode:401},'vercel-identity').message,/API key is not available/);
});
