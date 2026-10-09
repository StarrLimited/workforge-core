import { createClient } from '../supabase/server';
import { HQ_WORKSPACE_ID } from '../hq';
import { BillingError, type BillingCustomer, type BillingSource } from './core';
export const BILLING_SCOPE='workforge-hq';
export async function billingContext(write:boolean) {
 const db=await createClient();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new BillingError('Sign in to WorkForge HQ to view billing.',401);
 const {data:member,error:membershipError}=await db.from('workspace_memberships').select('role').eq('workspace_id',HQ_WORKSPACE_ID).eq('user_id',user.id).eq('is_active',true).maybeSingle();
 if(membershipError)throw new BillingError('Unable to verify HQ access.',503);
 if(!member)throw new BillingError('WorkForge HQ membership is required.',403);
 const writable=['owner','administrator','member'].includes(member.role);
 if(write&&!writable)throw new BillingError('HQ write access is required for billing.',403);
 return {actor:user.id,writable,db};
}
export async function billingSources(context:Awaited<ReturnType<typeof billingContext>>) {
 const results=await Promise.all([
  context.db.from('hq_accounts').select('id,company,email').eq('workspace_id',HQ_WORKSPACE_ID).limit(1000),
  context.db.from('hq_engagements').select('id,account_id,description,amount_cents,paid_cents,cadence').eq('workspace_id',HQ_WORKSPACE_ID).eq('status','agreed').limit(1000),
  context.db.from('hq_subscriptions').select('id,account_id,plan,amount_cents,cadence').eq('workspace_id',HQ_WORKSPACE_ID).in('status',['pending','trial','active']).limit(1000),
 ]);
 if(results.some(r=>r.error))throw new BillingError('Unable to load customer billing records.',503);
 if(results.some(r=>r.data?.length===1000))throw new BillingError('Billing requires pagination before additional records can be loaded.',503);
 const customers:BillingCustomer[]=(results[0].data??[]).map(c=>({id:c.id,name:c.company,email:c.email}));
 const sources:BillingSource[]=[];
 for(const e of results[1].data??[]) {
  if(e.cadence!=='one_time')continue;
  const amount=Number(e.amount_cents)-Number(e.paid_cents);
  if(amount>0)sources.push({id:'engagement:'+e.id,customerId:e.account_id,title:e.description,amountCents:amount,cadence:'one_time'});
 }
 for(const s of results[2].data??[])if(s.cadence==='monthly')sources.push({id:'subscription:'+s.id,customerId:s.account_id,title:s.plan,amountCents:Number(s.amount_cents),cadence:'monthly'});
 return {customers,sources};
}
