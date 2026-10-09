import { BillingError, SquareClient, cents, day, readConfig, type BillingRequest } from '@/lib/square/core';
import { billingContext, billingSources } from '@/lib/square/context';
import { getRecord, listRecords } from '@/lib/square/store';
import { cancelRecord, customerCards, executeRecord, prepareRecord, publishInvoice, refreshRecord } from '@/lib/square/service';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=120;
function fail(error:unknown) {
  if(error instanceof BillingError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  console.error('Square billing request failed.');
  return Response.json({error:'Unable to complete billing. Please retry.'},{status:500});
}
export async function GET(request:Request) {
  try {
    const context=await billingContext(false); const sources=await billingSources(context);
    let config;
    try { config=readConfig(); } catch(error) {
      if(error instanceof BillingError)return Response.json({...sources,records:[],invoices:[],writable:context.writable,ready:false,setupMessage:error.message});
      throw error;
    }
    const client=new SquareClient(config);
    const url=new URL(request.url);
    if(url.searchParams.has('cards')) {
      if(!context.writable)throw new BillingError('Billing write access required.',403);
      const customer=sources.customers.find(c=>c.id===url.searchParams.get('cards'));
      if(!customer)throw new BillingError('Customer not found.',404);
      return Response.json({cards:await customerCards(customer,client)});
    }
    const history=await listRecords(config);
    return Response.json({...sources,...history,writable:context.writable,ready:true,environment:config.environment},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return fail(error);}
}
export async function POST(request:Request) {
  try {
    const origin=request.headers.get('origin');
    if(!origin||origin!==new URL(request.url).origin)throw new BillingError('This billing request must come from the app.',403);
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw new BillingError('Expected a JSON request.',415);
    const context=await billingContext(true);
    const raw=await request.text(); if(raw.length>16000)throw new BillingError('Billing request is too large.',413);
    const body=JSON.parse(raw) as Record<string,unknown>;
    const config=readConfig();const client=new SquareClient(config);
    if(body.action==='check') {const location=await client.location();return Response.json({message:'Connected to '+location.name+' ('+config.environment+').'});}
    if(body.action==='create') {
      const data=await billingSources(context);
      const mode=body.mode;
      if(mode!=='invoice'&&mode!=='monthly')throw new BillingError('Choose an invoice or monthly service.');
      let source=data.sources.find(s=>s.id===body.sourceId);
      if(mode==='monthly'&&body.sourceId==='new-monthly') {
        const customer=data.customers.find(c=>c.id===body.customerId);const title=String(body.title??'').trim();
        if(!customer||title.length<3||title.length>200)throw new BillingError('Choose a customer and name the monthly service.');
        source={id:'monthly:'+customer.id+':'+title.toLowerCase(),customerId:customer.id,title,amountCents:cents(body.amount),cadence:'monthly'};
      }
      if(!source)throw new BillingError('The invoice or service is no longer available. Refresh the list.',409);
      const customer=data.customers.find(c=>c.id===source.customerId);
      if(!customer)throw new BillingError('Link the source invoice to a customer with a billing email first.');
      if(mode==='monthly'&&body.confirmMonthly!==true)throw new BillingError('Confirm the monthly billing amount and start date.');
      const input:BillingRequest={mode,sourceId:source.id,schedule:{depositCents:mode==='invoice'?(body.depositKind==='percent'?Math.round(source.amountCents*cents(body.deposit??'0')/10000):cents(body.deposit??'0')):0,
        depositDate:mode==='invoice'?day(body.depositDate):'',balanceDate:mode==='invoice'?day(body.balanceDate):''},
        startDate:mode==='monthly'?day(body.startDate):'',cardId:mode==='monthly'?String(body.cardId??'').slice(0,255):'',consent:mode==='monthly'?String(body.consent??'').slice(0,2000):''};
      await client.location();
      const record=await prepareRecord(input,source,customer,context.actor,config);
      const result=await executeRecord(record,client);
      return Response.json({record:result,message:mode==='invoice'?'Draft saved. Review the schedule, then send the invoice.':'Monthly billing saved. Square will bill from the selected start date.'});
    }
    const record=await getRecord(String(body.id??''),config);
    if(body.action==='retry')await executeRecord(record,client);
    else if(body.action==='refresh')await refreshRecord(record,client);
    else if(body.action==='publish') {
      const currentData=await billingSources(context);
      const current=currentData.sources.find(s=>s.id===record.source_id);
      const currentCustomer=currentData.customers.find(c=>c.id===record.request.customer.id);
      if(record.status==='DRAFT'&&(!current||current.amountCents!==record.request.source.amountCents||current.customerId!==record.request.source.customerId||currentCustomer?.email!==record.request.customer.email))throw new BillingError('The source invoice changed. Review it before sending a payment request.',409);
      await publishInvoice(record,client);
    }
    else if(body.action==='cancel')await cancelRecord(record,client);
    else throw new BillingError('Unknown billing action.');
    return Response.json({message:body.action==='publish'?'Invoice sent through Square.':body.action==='cancel'?'Cancellation updated. Review the effective date below.':'Square payment status updated.'});
  }catch(error){return fail(error);}
}
