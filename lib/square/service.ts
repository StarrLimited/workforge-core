import { randomUUID } from 'node:crypto';
import { BillingError, SquareClient, idempotency, paymentRequests, today, type BillingCustomer, type BillingRecord, type BillingRequest, type BillingSource, type SquareCard, type SquareConfig, type SquareInvoice, type SquareSubscription } from './core';
import { billingDb, getRecord, recordQuery, saveInvoice, saveRecord, saveSubscription } from './store';
import { BILLING_SCOPE } from './context';

export async function squareCustomer(customer: BillingCustomer, client: SquareClient) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new BillingError('Add a valid billing email to the customer record first.');
  const mappingKey = idempotency(BILLING_SCOPE, client.config.environment, client.config.locationId, customer.id);
  const db = billingDb();
  const {data: existing, error} = await db.from('square_billing_customers').select('square_customer_id').eq('id', mappingKey).maybeSingle();
  if (error) throw new BillingError('Unable to look up the Square customer.', 503);
  if (existing) {
    await client.request('/customers/'+encodeURIComponent(existing.square_customer_id),{email_address:customer.email,company_name:customer.name},'PUT');
    return existing.square_customer_id as string;
  }
  // Reference IDs avoid linking an unrelated customer just because they share an email address.
  const reference = BILLING_SCOPE + ':' + customer.id;
  const found = await client.request<{customers?: Array<{id: string}>}>('/customers/search', {query:{filter:{reference_id:{exact:reference}}}});
  if ((found.customers?.length ?? 0) > 1) throw new BillingError('Multiple Square customers match this account. Ask an administrator to resolve the duplicate.');
  const id = found.customers?.[0]?.id ?? (await client.request<{customer:{id:string}}>('/customers', {
    idempotency_key: mappingKey, reference_id: reference, company_name: customer.name, given_name: customer.name.slice(0, 100), email_address: customer.email,
  })).customer.id;
  const inserted = await db.from('square_billing_customers').upsert({id:mappingKey, scope:BILLING_SCOPE, environment:client.config.environment, location_id:client.config.locationId, customer_id:customer.id, square_customer_id:id}, {onConflict:'id', ignoreDuplicates:true});
  if (inserted.error) throw new BillingError('Unable to save the Square customer. Retry safely.', 503);
  const saved = await db.from('square_billing_customers').select('square_customer_id').eq('id',mappingKey).single();
  if (saved.error) throw new BillingError('Unable to read the saved Square customer.',503);
  return saved.data.square_customer_id as string;
}
export async function customerCards(customer: BillingCustomer, client: SquareClient) {
  const mappingKey=idempotency(BILLING_SCOPE,client.config.environment,client.config.locationId,customer.id);
  const {data,error}=await billingDb().from('square_billing_customers').select('square_customer_id').eq('id',mappingKey).maybeSingle();
  if(error)throw new BillingError('Unable to look up saved cards.',503);
  if(!data)return [];
  const result=await client.request<{cards?:SquareCard[]}>('/cards?customer_id='+encodeURIComponent(data.square_customer_id));
  return (result.cards??[]).filter(c=>c.enabled&&c.customer_id===data.square_customer_id).map(c=>({id:c.id,label:(c.card_brand??'Card')+' ending '+c.last_4}));
}
export async function prepareRecord(input: BillingRequest, source: BillingSource, customer: BillingCustomer, actor: string, config: SquareConfig) {
  if (input.mode === 'invoice') {
    if (source.cadence !== 'one_time') throw new BillingError('Select a one-time fee for an invoice.');
    paymentRequests(source.amountCents, input.schedule);
  } else {
    if (source.cadence !== 'monthly') throw new BillingError('Select a monthly service.');
    if (input.startDate < today()) throw new BillingError('Choose today or a future subscription start date.');
    if (input.cardId && input.consent.trim().length < 10) throw new BillingError('Record the customer authorization for recurring card charges.');
  }
  if (!Number.isSafeInteger(source.amountCents) || source.amountCents <= 0) throw new BillingError('The amount must be greater than zero.');
  const {data: existing, error: readError} = await recordQuery(config).eq('source_id',source.id).eq('mode',input.mode).maybeSingle();
  if(readError)throw new BillingError('Unable to check for an existing payment request.',503);
  if(existing) return existing as BillingRecord;
  const request = {...input, source, customer};
  const {data,error}=await billingDb().from('square_billing_records').insert({id:randomUUID(),scope:BILLING_SCOPE,environment:config.environment,location_id:config.locationId,
    source_id:source.id,mode:input.mode,request,created_by:actor}).select('*').single();
  if(error?.code==='23505') {
    const winner=await recordQuery(config).eq('source_id',source.id).eq('mode',input.mode).single();
    if(!winner.error)return winner.data as BillingRecord;
  }
  if(error)throw new BillingError('Unable to save the billing request.',503);
  return data as BillingRecord;
}
export async function executeRecord(record: BillingRecord, client: SquareClient) {
  const request=record.request; const key=(stage:string)=>idempotency(record.id,stage);
  try {
    if(record.square_invoice_id||record.square_subscription_id)return await refreshRecord(record,client);
    const customerId=record.square_customer_id??await squareCustomer(request.customer,client);
    await saveRecord(record,{square_customer_id:customerId,last_error:null});
    record={...record,square_customer_id:customerId};
    if(record.mode==='invoice') {
      const {order}=await client.request<{order:{id:string}}>('/orders',{idempotency_key:key('order'),order:{
        location_id:record.location_id,customer_id:customerId,reference_id:record.id,
        line_items:[{name:request.source.title.slice(0,500),quantity:'1',base_price_money:{amount:request.source.amountCents,currency:'USD'}}],
      }});
      const {invoice}=await client.request<{invoice:SquareInvoice}>('/invoices',{idempotency_key:key('invoice'),invoice:{
        order_id:order.id,primary_recipient:{customer_id:customerId},title:request.source.title.slice(0,255),
        description:'Payment for '+request.source.title+'. Reference '+record.id,
        payment_requests:paymentRequests(request.source.amountCents,request.schedule,false),
        delivery_method:'EMAIL',accepted_payment_methods:{card:true},store_payment_method_enabled:true,
      }});
      await saveRecord(record,{square_invoice_id:invoice.id});
      record={...record,square_invoice_id:invoice.id};
      await saveInvoice(record,invoice);
    } else {
      if(request.cardId) {
        const {card}=await client.request<{card:SquareCard}>('/cards/'+encodeURIComponent(request.cardId));
        if(!card.enabled||card.customer_id!==customerId)throw new BillingError('The selected card does not belong to this customer.');
      }
      const {catalog_object:plan}=await client.request<{catalog_object:{id:string}}>('/catalog/object',{idempotency_key:key('plan'),object:{
        id:'#plan',type:'SUBSCRIPTION_PLAN',subscription_plan_data:{name:request.source.title.slice(0,255)},
      }});
      const {catalog_object:variation}=await client.request<{catalog_object:{id:string}}>('/catalog/object',{idempotency_key:key('variation'),object:{
        id:'#monthly',type:'SUBSCRIPTION_PLAN_VARIATION',subscription_plan_variation_data:{name:'Monthly',subscription_plan_id:plan.id,phases:[{cadence:'MONTHLY',ordinal:0,pricing:{type:'STATIC',price_money:{amount:request.source.amountCents,currency:'USD'}}}]},
      }});
      await saveRecord(record,{square_plan_variation_id:variation.id});
      const {subscription}=await client.request<{subscription:SquareSubscription}>('/subscriptions',{idempotency_key:key('subscription'),location_id:record.location_id,
        plan_variation_id:variation.id,customer_id:customerId,start_date:request.startDate,timezone:'America/Denver',...(request.cardId?{card_id:request.cardId}:{}),
      });
      await saveSubscription(record,subscription);
      record={...record,square_subscription_id:subscription.id};
      await refreshRecord(record,client);
    }
    return await getRecord(record.id,client.config);
  } catch(error) {
    const message=error instanceof BillingError?error.message:'Square billing could not finish. Retry this record.';
    await saveRecord(record,{last_error:message});
    throw error;
  }
}
export async function refreshRecord(record: BillingRecord, client: SquareClient) {
  if(record.square_invoice_id) {
    const {invoice}=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(record.square_invoice_id));
    await saveInvoice(record,invoice);
  }
  if(record.square_subscription_id) {
    const {subscription}=await client.request<{subscription:SquareSubscription}>('/subscriptions/'+encodeURIComponent(record.square_subscription_id));
    await saveSubscription(record,subscription);
    // Square includes the invoice IDs for the subscription, including unpaid and refunded cycles.
    for(const id of subscription.invoice_ids??[]) {
      const {invoice}=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(id));
      if(invoice.subscription_id!==subscription.id)throw new BillingError('Subscription invoice mismatch.',409);
      await saveInvoice(record,invoice);
    }
  }
  await saveRecord(record,{last_error:null});
  return await getRecord(record.id,client.config);
}
export async function publishInvoice(record:BillingRecord,client:SquareClient) {
  if(!record.square_invoice_id)throw new BillingError('Create the draft invoice first.');
  const {invoice}=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(record.square_invoice_id));
  if(invoice.status!=='DRAFT') {await saveInvoice(record,invoice);return;}
  const {invoice:published}=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(invoice.id)+'/publish',{version:invoice.version,idempotency_key:idempotency(record.id,'publish')});
  await saveInvoice(record,published);
}
export async function cancelRecord(record:BillingRecord,client:SquareClient) {
  if(record.square_subscription_id) {
    const {subscription}=await client.request<{subscription:SquareSubscription}>('/subscriptions/'+encodeURIComponent(record.square_subscription_id));
    if(subscription.status!=='CANCELED'&&!subscription.canceled_date) {
      const res=await client.request<{subscription:SquareSubscription}>('/subscriptions/'+encodeURIComponent(subscription.id)+'/cancel',{});
      await saveSubscription(record,res.subscription);
    }
  } else if(record.square_invoice_id) {
    const {invoice}=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(record.square_invoice_id));
    if(invoice.status==='DRAFT')throw new BillingError('Unsent drafts stay saved. Do not publish an unwanted draft.');
    if(!['CANCELED','PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(invoice.status)) {
      const res=await client.request<{invoice:SquareInvoice}>('/invoices/'+encodeURIComponent(invoice.id)+'/cancel',{version:invoice.version});
      await saveInvoice(record,res.invoice);
    }
  }
  return refreshRecord(record,client);
}
