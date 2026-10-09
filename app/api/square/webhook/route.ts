import { BillingError, SquareClient, readConfig, verifyWebhook, type BillingRecord, type SquareInvoice, type SquareSubscription } from '@/lib/square/core';
import { BILLING_SCOPE } from '@/lib/square/context';
import { billingDb, recordQuery, saveInvoice, saveRecord, saveSubscription } from '@/lib/square/store';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request) {
  try {
    const config=readConfig();
    const raw=await request.text();
    if(raw.length>1000000)return new Response('Payload too large',{status:413});
    if(!verifyWebhook(raw,request.headers.get('x-square-hmacsha256-signature'),config.webhookUrl,config.webhookKey))return new Response('Invalid signature',{status:403});
    const event=JSON.parse(raw) as {event_id:string;type:string;merchant_id:string;data?:{id?:string;object?:{invoice?:SquareInvoice;subscription?:SquareSubscription&{plan_variation_id?:string}}}};
    if(!event.event_id||!event.type)return new Response('Invalid event',{status:400});
    if(!event.type.startsWith('invoice.')&&!event.type.startsWith('subscription.'))return new Response('Ignored');
    const db=billingDb();
    const seen=await db.from('square_billing_events').select('event_id').eq('event_id',event.event_id).maybeSingle();
    if(seen.error)throw new BillingError('Storage unavailable',503);
    if(seen.data)return new Response('Already processed');
    const client=new SquareClient(config); const location=await client.location();
    if(event.merchant_id!==location.merchant_id)return new Response('Wrong merchant',{status:403});
    const object=event.data?.object;
    let record:BillingRecord|null=null;
    if(event.type.startsWith('subscription.')) {
      const id=object?.subscription?.id??event.data?.id;
      if(!id)return new Response('Missing subscription',{status:400});
      const {subscription}=await client.request<{subscription:SquareSubscription&{plan_variation_id?:string}}>('/subscriptions/'+encodeURIComponent(id));
      if(subscription.location_id!==config.locationId)return new Response('Ignored location');
      const lookup=await recordQuery(config).eq('square_subscription_id',subscription.id).maybeSingle();
      if(lookup.error)throw new BillingError('Lookup failed',503);
      record=lookup.data as BillingRecord|null;
      if(!record&&subscription.plan_variation_id) {
        const pending=await recordQuery(config).eq('square_plan_variation_id',subscription.plan_variation_id).maybeSingle();
        if(pending.error)throw new BillingError('Lookup failed',503);
        record=pending.data as BillingRecord|null;
      }
      if(record)await saveSubscription(record,subscription);
    } else {
      const id=object?.invoice?.id??event.data?.id;
      if(!id)return new Response('Missing invoice',{status:400});
      const {invoice}=await client.request<{invoice:SquareInvoice&{order_id?:string}}>('/invoices/'+encodeURIComponent(id));
      if(invoice.location_id!==config.locationId)return new Response('Ignored location');
      const lookup=await recordQuery(config).eq('square_invoice_id',invoice.id).maybeSingle();
      if(lookup.error)throw new BillingError('Lookup failed',503);
      record=lookup.data as BillingRecord|null;
      if(!record&&invoice.subscription_id) {
        const {subscription}=await client.request<{subscription:SquareSubscription&{plan_variation_id?:string}}>('/subscriptions/'+encodeURIComponent(invoice.subscription_id));
        const pending=subscription.plan_variation_id?await recordQuery(config).eq('square_plan_variation_id',subscription.plan_variation_id).maybeSingle():null;
        if(pending?.error)throw new BillingError('Lookup failed',503);
        record=pending?.data as BillingRecord|null;
        if(record)await saveSubscription(record,subscription);
      }
      // Recover a callback arriving after Square creates the invoice but before our checkpoint is saved.
      if(!record&&invoice.order_id) {
        const {order}=await client.request<{order:{reference_id?:string}}>('/orders/'+encodeURIComponent(invoice.order_id));
        if(order.reference_id&&/^[0-9a-f-]{36}$/i.test(order.reference_id)) {
          const pending=await recordQuery(config).eq('id',order.reference_id).eq('mode','invoice').maybeSingle();
          if(pending.error)throw new BillingError('Lookup failed',503);
          record=pending.data as BillingRecord|null;
          if(record) { await saveRecord(record,{square_invoice_id:invoice.id});record={...record,square_invoice_id:invoice.id}; }
        }
      }
      if(record)await saveInvoice(record,invoice);
    }
    if(record) {
      const saved=await db.from('square_billing_events').upsert({event_id:event.event_id,scope:BILLING_SCOPE,event_type:event.type},{onConflict:'event_id',ignoreDuplicates:true});
      if(saved.error)throw new BillingError('Event receipt could not be saved',503);
    }
    return new Response('OK');
  }catch(error){
    console.error('Square webhook could not be processed; delivery should be retried.');
    return new Response(error instanceof BillingError?'Payment synchronization temporarily unavailable':'Unable to process event',{status:503});
  }
}
