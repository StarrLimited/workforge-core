import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {cents,day,idempotency,paymentRequests,verifyWebhook,invoiceSnapshot,safePaymentUrl,SquareClient,readConfig} from '../lib/square/core.ts';

test('currency parsing preserves cents and rejects invalid, negative, and oversized amounts',()=>{
 assert.equal(cents('19.99'),1999);assert.equal(cents('0.01'),1);assert.equal(cents('50'),5000);
 for(const value of ['-1','1.001','NaN','1e3','','$1.00','100000000000'])assert.throws(()=>cents(value));
});
test('dates reject rollover and invalid calendar dates',()=>{
 assert.equal(day('2028-02-29'),'2028-02-29');
 for(const value of ['2027-02-29','2026-04-31','2026-13-01','abc'])assert.throws(()=>day(value));
});
test('deposit and balance schedule exactly allocates a non-round invoice',()=>{
 const result=paymentRequests(19999,{depositCents:6666,depositDate:'2090-01-01',balanceDate:'2090-02-01'});
 assert.equal(result.length,2);assert.equal(result[0].request_type,'DEPOSIT');
 assert.equal(result[0].fixed_amount_requested_money.amount,6666);
 assert.equal(result[1].request_type,'BALANCE');assert.equal(result[1].fixed_amount_requested_money,undefined);
 assert.equal(result[0].tipping_enabled,undefined);
});
test('full balance and schedule boundary validation',()=>{
 assert.equal(paymentRequests(100,{depositCents:0,depositDate:'',balanceDate:'2090-01-01'}).length,1);
 for(const depositCents of [-1,100,101,1.5])assert.throws(()=>paymentRequests(100,{depositCents,depositDate:'2090-01-01',balanceDate:'2090-02-01'}));
 assert.throws(()=>paymentRequests(100,{depositCents:10,depositDate:'2090-03-01',balanceDate:'2090-02-01'}));
 assert.throws(()=>paymentRequests(0,{depositCents:0,depositDate:'',balanceDate:'2090-01-01'}));
});
test('frozen retries preserve original past due dates without allowing new backdated invoices',()=>{
 const schedule={depositCents:10,depositDate:'2020-01-01',balanceDate:'2020-02-01'};
 assert.throws(()=>paymentRequests(100,schedule));
 assert.equal(paymentRequests(100,schedule,false)[0].due_date,'2020-01-01');
});
test('webhook signature validates exact raw body and configured URL',()=>{
 const raw='{"event_id":"test","data":{"amount":100}}',url='https://example.com/api/square/webhook',key='test-only';
 const signature=createHmac('sha256',key).update(url+raw).digest('base64');
 assert.equal(verifyWebhook(raw,signature,url,key),true);
 assert.equal(verifyWebhook(raw+' ',signature,url,key),false);
 assert.equal(verifyWebhook(raw,signature,url+'/',key),false);
 assert.equal(verifyWebhook(raw,signature,url,'wrong'),false);
 assert.equal(verifyWebhook(raw,'invalid',url,key),false);
 assert.equal(verifyWebhook(raw,null,url,key),false);
});
test('idempotency is stable and separated by operation and environment',()=>{
 assert.equal(idempotency('sandbox','r1','invoice'),idempotency('sandbox','r1','invoice'));
 assert.notEqual(idempotency('sandbox','r1','invoice'),idempotency('production','r1','invoice'));
 assert.notEqual(idempotency('r1','order'),idempotency('r1','invoice'));assert.ok(idempotency('r1').length<=45);
});
test('payment snapshots retain partial deposits, final balances, and refund statuses',()=>{
 const invoice={id:'i1',version:4,location_id:'l',status:'PARTIALLY_PAID',payment_requests:[
 {request_type:'DEPOSIT',due_date:'2090-01-01',computed_amount_money:{amount:3000,currency:'USD'},total_completed_amount_money:{amount:3000,currency:'USD'}},
 {request_type:'BALANCE',due_date:'2090-02-01',computed_amount_money:{amount:7000,currency:'USD'},total_completed_amount_money:{amount:500,currency:'USD'}}]};
 const snapshot=invoiceSnapshot(invoice);assert.equal(snapshot.amount_cents,10000);assert.equal(snapshot.paid_cents,3500);assert.equal(snapshot.due_cents,6500);assert.equal(snapshot.due_date,'2090-02-01');
 assert.equal(invoiceSnapshot({...invoice,status:'CANCELED'}).due_cents,0);
 assert.equal(invoiceSnapshot({...invoice,status:'PARTIALLY_REFUNDED'}).status,'PARTIALLY_REFUNDED');
 assert.throws(()=>invoiceSnapshot({...invoice,payment_requests:[{computed_amount_money:{amount:100,currency:'EUR'}}]}));
});
test('only Square HTTPS links are exposed',()=>{
 assert.equal(safePaymentUrl('javascript:alert(1)'),null);
 assert.equal(safePaymentUrl('https://squareup.com.evil.test/pay'),null);
 assert.ok(safePaymentUrl('https://squareupsandbox.com/pay-invoice/test'));
});
test('Square client selects sandbox, pins API version and preserves idempotency',async()=>{
 let seen;
 const client=new SquareClient({environment:'sandbox',token:'test-token',locationId:'l',webhookKey:'w',webhookUrl:'https://x.test'},async(url,init)=>{seen={url,init};return Response.json({order:{id:'o'}});});
 const result=await client.request('/orders',{idempotency_key:'stable',order:{}});
 assert.equal(result.order.id,'o');assert.equal(seen.url,'https://connect.squareupsandbox.com/v2/orders');
 assert.equal(seen.init.headers['Square-Version'],'2026-09-16');assert.equal(JSON.parse(seen.init.body).idempotency_key,'stable');
});
test('Square errors and timeouts never disclose token or response details',async()=>{
 const config={environment:'sandbox',token:'secret-test',locationId:'l',webhookKey:'w',webhookUrl:'https://x.test'};
 await assert.rejects(()=>new SquareClient(config,async()=>Response.json({errors:[{code:'UNAUTHORIZED',detail:'secret-test'}]},{status:401})).request('/locations'),error=>error.message.includes('UNAUTHORIZED')&&!error.message.includes('secret-test'));
 await assert.rejects(()=>new SquareClient(config,async()=>{throw new Error('secret-test');}).request('/locations'),error=>error.status===502&&!error.message.includes('secret-test'));
});
test('preview cannot accidentally use production Square credentials',()=>{
 const keys=['SQUARE_ENVIRONMENT','SQUARE_ACCESS_TOKEN','SQUARE_LOCATION_ID','SQUARE_WEBHOOK_SIGNATURE_KEY','SQUARE_WEBHOOK_URL','VERCEL_ENV','SUPABASE_SECRET_KEY'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{Object.assign(process.env,{SUPABASE_SECRET_KEY:'test-only',SQUARE_ENVIRONMENT:'production',SQUARE_ACCESS_TOKEN:'test',SQUARE_LOCATION_ID:'l',SQUARE_WEBHOOK_SIGNATURE_KEY:'w',SQUARE_WEBHOOK_URL:'https://example.test/api/square/webhook',VERCEL_ENV:'preview'});assert.throws(readConfig,/sandbox/);}
 finally{for(const [k,v]of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
