import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type BillingCustomer = { id: string; name: string; email: string };
export type BillingSource = { id: string; customerId: string; title: string; amountCents: number; cadence: 'one_time' | 'monthly'; dueDate?: string };
export type Schedule = { depositCents: number; depositDate: string; balanceDate: string };
export type BillingRequest = { sourceId: string; mode: 'invoice' | 'monthly'; schedule: Schedule; startDate: string; cardId: string; consent: string };
export type SquareMoney = { amount: number; currency: string };
export type SquareInvoice = { id: string; version: number; location_id: string; subscription_id?: string; status: string; public_url?: string; invoice_number?: string; primary_recipient?: {customer_id?: string}; payment_requests?: Array<{request_type: string; due_date: string; computed_amount_money?: SquareMoney; total_completed_amount_money?: SquareMoney}> };
export type SquareSubscription = { id: string; version: number; location_id: string; customer_id: string; status: string; canceled_date?: string; charged_through_date?: string; invoice_ids?: string[] };
export type SquareCard = { id: string; customer_id: string; enabled: boolean; card_brand?: string; last_4?: string };
export type FrozenRequest = BillingRequest & { customer: BillingCustomer; source: BillingSource };
export type BillingRecord = { id: string; scope: string; environment: string; location_id: string; source_id: string; mode: 'invoice' | 'monthly'; request: FrozenRequest; square_customer_id: string | null; square_invoice_id: string | null; square_subscription_id: string | null; status: string; last_error: string | null; created_at: string; updated_at: string; subscription_version: number; canceled_date?: string | null; charged_through_date?: string | null };
export type InvoiceRecord = { invoice_id: string; record_id: string; version: number; status: string; public_url: string | null; amount_cents: number; paid_cents: number; due_cents: number; due_date: string | null; requests: SquareInvoice['payment_requests']; updated_at: string };

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function cents(value: unknown): number {
  const s = String(value ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new BillingError('Enter a dollar amount with at most two decimal places.');
  const [whole, part = ''] = s.split('.');
  const amount = Number(whole) * 100 + Number(part.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 10000000000) throw new BillingError('Amount is outside the supported range.');
  return amount;
}
export function day(value: unknown): string {
  const s = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + 'T12:00:00Z')) || new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) !== s) throw new BillingError('Enter a valid date.');
  return s;
}
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function paymentRequests(total: number, schedule: Schedule, validateDates = true) {
  if (!Number.isSafeInteger(total) || total <= 0) throw new BillingError('This invoice has no payable balance.');
  const deposit = schedule.depositCents;
  if (!Number.isSafeInteger(deposit) || deposit < 0 || deposit >= total) throw new BillingError('The deposit must be less than the outstanding invoice total. Use full payment for the entire balance.');
  const balanceDate = day(schedule.balanceDate);
  if (validateDates && balanceDate < today()) throw new BillingError('Choose today or a future final-payment date.');
  const balance = { request_type: 'BALANCE', due_date: balanceDate, automatic_payment_source: 'NONE', tipping_enabled: false };
  if (!deposit) return [balance];
  const depositDate = day(schedule.depositDate);
  if ((validateDates && depositDate < today()) || depositDate > balanceDate) throw new BillingError('The deposit date must be today or later and no later than the final payment.');
  return [{ request_type: 'DEPOSIT', due_date: depositDate, fixed_amount_requested_money: { amount: deposit, currency: 'USD' }, automatic_payment_source: 'NONE' }, balance];
}
export function idempotency(...parts: string[]) { return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 40); }
export function verifyWebhook(raw: string, signature: string | null, url: string, key: string) {
  if (!signature || !url || !key) return false;
  const expected = createHmac('sha256', key).update(url + raw).digest('base64');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function safePaymentUrl(value?: string | null) {
  if (!value) return null;
  try { const u = new URL(value); return u.protocol === 'https:' && ['squareup.com', 'squareupsandbox.com'].some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? u.href : null; } catch { return null; }
}
export function invoiceSnapshot(invoice: SquareInvoice) {
  const requests = invoice.payment_requests ?? [];
  if (!Number.isSafeInteger(invoice.version) || !invoice.id) throw new BillingError('Square returned an invalid invoice.', 502);
  for (const r of requests) for (const m of [r.computed_amount_money, r.total_completed_amount_money]) {
    if (m && (m.currency !== 'USD' || !Number.isSafeInteger(m.amount) || m.amount < 0)) throw new BillingError('Square returned unsupported invoice amounts.', 502);
  }
  const amount = requests.reduce((n, r) => n + (r.computed_amount_money?.amount ?? 0), 0);
  const paid = requests.reduce((n, r) => n + (r.total_completed_amount_money?.amount ?? 0), 0);
  return { invoice_id: invoice.id, version: invoice.version, status: invoice.status, public_url: safePaymentUrl(invoice.public_url),
    amount_cents: amount, paid_cents: paid, due_cents: ['CANCELED', 'REFUNDED'].includes(invoice.status) ? 0 : Math.max(0, amount - paid),
    due_date: requests.filter(r => (r.computed_amount_money?.amount ?? 0) > (r.total_completed_amount_money?.amount ?? 0)).map(r => r.due_date).sort()[0] ?? null, requests };
}
export type SquareConfig = { environment: 'sandbox' | 'production'; token: string; locationId: string; webhookKey: string; webhookUrl: string; };
export function readConfig(): SquareConfig {
  const environment = process.env.SQUARE_ENVIRONMENT;
  if (environment !== 'sandbox' && environment !== 'production') throw new BillingError('Square setup is incomplete. Choose sandbox or production in the server settings.', 503);
  if (!process.env.SUPABASE_SECRET_KEY) throw new BillingError('Secure billing storage needs administrator setup.', 503);
  const token = process.env.SQUARE_ACCESS_TOKEN ?? ''; const locationId = process.env.SQUARE_LOCATION_ID ?? '';
  const webhookKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? ''; const webhookUrl = process.env.SQUARE_WEBHOOK_URL ?? '';
  if (!token || !locationId || !webhookKey || !webhookUrl) throw new BillingError('Square setup is incomplete. An administrator must configure the Square account and payment notifications.', 503);
  try { if (new URL(webhookUrl).protocol !== 'https:') throw new Error(); } catch { throw new BillingError('Square requires a valid HTTPS notification address.', 503); }
  if (process.env.VERCEL_ENV === 'preview' && environment === 'production') throw new BillingError('Preview deployments must use the Square sandbox.', 503);
  return { environment, token, locationId, webhookKey, webhookUrl };
}
export class SquareClient {
  readonly config: SquareConfig;
  private fetcher: typeof fetch;
  constructor(config: SquareConfig, fetcher: typeof fetch = fetch) { this.config=config; this.fetcher=fetcher; }
  async request<T>(path: string, body?: unknown, method?: string): Promise<T> {
    const base = this.config.environment === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
    let response: Response;
    try { response = await this.fetcher(base + '/v2' + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { Authorization: 'Bearer ' + this.config.token, 'Content-Type': 'application/json', 'Square-Version': '2026-09-16' },
      body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000),
    }); } catch { throw new BillingError('Square did not respond. Retry this record; the same request will be reused.', 502); }
    const data = await response.json().catch(() => ({})) as T & { errors?: Array<{code?: string}> };
    if (!response.ok || data.errors?.length) {
      const code = data.errors?.[0]?.code ?? String(response.status);
      throw new BillingError('Square could not complete the request (' + code.replace(/[^A-Z0-9_]/g, '') + '). Check the connection or retry this record.', 502);
    }
    return data;
  }
  async location() {
    const { location } = await this.request<{ location: {id: string; merchant_id: string; status: string; currency: string; name: string; capabilities?: string[]} }>('/locations/' + encodeURIComponent(this.config.locationId));
    if (!location || location.status !== 'ACTIVE' || location.currency !== 'USD' || !location.capabilities?.includes('CREDIT_CARD_PROCESSING')) throw new BillingError('Choose an active USD Square location enabled for card payments.', 503);
    return location;
  }
}
