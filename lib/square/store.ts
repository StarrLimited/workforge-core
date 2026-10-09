import { createClient } from '@supabase/supabase-js';
import { BillingError, invoiceSnapshot, type BillingRecord, type InvoiceRecord, type SquareConfig, type SquareInvoice, type SquareSubscription } from './core';
import { BILLING_SCOPE } from './context';

export function billingDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new BillingError('Secure billing storage needs administrator setup.', 503);
  return createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
}
export function recordQuery(config: SquareConfig) {
  return billingDb().from('square_billing_records').select('*').eq('scope', BILLING_SCOPE).eq('environment', config.environment).eq('location_id', config.locationId);
}
export async function getRecord(id: string, config: SquareConfig) {
  const {data, error} = await recordQuery(config).eq('id', id).maybeSingle();
  if (error) throw new BillingError('Unable to read billing history.', 503);
  if (!data) throw new BillingError('Billing record not found.', 404);
  return data as BillingRecord;
}
export async function saveRecord(record: BillingRecord, changes: Record<string, unknown>) {
  const {error} = await billingDb().from('square_billing_records').update({...changes, updated_at: new Date().toISOString()}).eq('id', record.id).eq('scope', BILLING_SCOPE);
  if (error) throw new BillingError('Unable to save Square progress. Retry this record to recover the existing Square request.', 503);
}
export async function saveInvoice(record: BillingRecord, invoice: SquareInvoice) {
  if (invoice.location_id !== record.location_id || invoice.primary_recipient?.customer_id !== record.square_customer_id) throw new BillingError('Square invoice does not match this billing account.', 409);
  const {error} = await billingDb().rpc('square_store_invoice', {p_record_id: record.id, p_snapshot: invoiceSnapshot(invoice)});
  if (error) throw new BillingError('Unable to update invoice payment history. Retry synchronization.', 503);
}
export async function saveSubscription(record: BillingRecord, subscription: SquareSubscription) {
  if (subscription.location_id !== record.location_id || subscription.customer_id !== record.square_customer_id) throw new BillingError('Square subscription does not match this billing account.', 409);
  const {error} = await billingDb().from('square_billing_records').update({square_subscription_id: subscription.id, subscription_version: subscription.version, status: subscription.status,
    canceled_date: subscription.canceled_date ?? null, charged_through_date: subscription.charged_through_date ?? null, last_error: null, updated_at: new Date().toISOString()})
    .eq('id', record.id).eq('scope', BILLING_SCOPE).lt('subscription_version', subscription.version);
  if (error) throw new BillingError('Unable to update subscription history. Retry synchronization.', 503);
}
export async function listRecords(config: SquareConfig) {
  const {data, error} = await recordQuery(config).order('created_at', {ascending: false}).limit(200);
  if (error) throw new BillingError('Billing storage is not ready. Apply the Square billing migration.', 503);
  const records = (data ?? []) as BillingRecord[];
  if (!records.length) return {records, invoices: [] as InvoiceRecord[]};
  const {data: invoices, error: invoiceError} = await billingDb().from('square_billing_invoices').select('*').in('record_id', records.map(r => r.id)).order('updated_at', {ascending:false}).limit(1000);
  if (invoiceError) throw new BillingError('Unable to load invoice history.', 503);
  return {records, invoices: (invoices ?? []) as InvoiceRecord[]};
}
