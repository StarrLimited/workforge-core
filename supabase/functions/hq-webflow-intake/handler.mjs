export const SITE_ID = '6aa5acbf7ae3bb9c0c7b7ec5';
const FORM_GROUPS = {
  'Workflow consultation': ['6aa768c8b75121eb407fc955', '6aa768c8b75121eb407fc997', '6aa614429ef85f8b1b2aace2'],
  'Jobber alternative': ['6aa768c8b75121eb407fc983', '6aa768c8b75121eb407fc9c5', '6aa73dd631b0951ebcde0301'],
  'Custom CRM': ['6aa768c8b75121eb407fc975', '6aa768c8b75121eb407fc9b7', '6aa73dd631b0951ebcde02f3'],
  'Business automation': ['6aa768c8b75121eb407fc967', '6aa768c8b75121eb407fc9a9', '6aa73dd631b0951ebcde02e5'],
};
const FORMS = new Map(Object.entries(FORM_GROUPS).flatMap(([name, ids]) => ids.map(id => [id, name])));
const MAX_BYTES = 65536;
class IntakeError extends Error {
  constructor(status) { super('Invalid intake request'); this.status = status; }
}
function field(data, name, limit = 500) {
  const value = data[name] ?? '';
  if (typeof value !== 'string' || value.length > limit || value.includes('\0')) throw new IntakeError(400);
  return value.trim();
}
function source(raw, utmSource, medium) {
  const value = raw.toLowerCase().replace(/[ _-]+/g, ' ').trim();
  const sources = { 'google ads': 'Google Ads', 'google lsa': 'Google LSA', 'local services ads': 'Google LSA', meta: 'Meta', facebook: 'Meta', instagram: 'Meta', print: 'Print', referral: 'Referral', outbound: 'Outbound', other: 'Other' };
  if (sources[value]) return sources[value];
  if (/google/i.test(utmSource) && /^(cpc|ppc|paid|paidsearch)$/i.test(medium)) return 'Google Ads';
  if (/^(facebook|fb|instagram|ig|meta)$/i.test(utmSource)) return 'Meta';
  return 'Website';
}
export function normalizeSubmission(body) {
  if (body?.triggerType !== 'form_submission') return { status: 'ignored' };
  const p = body.payload;
  if (!p || p.siteId !== SITE_ID) throw new IntakeError(400);
  const form = FORMS.get(p.formId);
  if (!form) return { status: 'ignored' }; // Cookie consent and other forms never become leads.
  if (!/^[a-f0-9]{24}$/.test(p.id ?? '') || !p.submittedAt || !Number.isFinite(Date.parse(p.submittedAt))) throw new IntakeError(400);
  if (!p.data || typeof p.data !== 'object' || Array.isArray(p.data)) throw new IntakeError(400);
  const data = p.data;
  const email = field(data, 'Email', 254);
  const phone = field(data, 'Phone', 40);
  const contact = field(data, 'Full Name', 200) || email;
  const company = field(data, 'Company', 200) || contact;
  if (!contact || contact.length > 200 || !company || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new IntakeError(400);
  const attribution = { form };
  for (const key of ['Lead Source', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term', 'Landing Page', 'Landing Variant', 'Business Type', 'Main Challenge', 'Team Size']) {
    attribution[key] = field(data, key, key === 'Landing Page' ? 2000 : 500);
  }
  return {
    site_id: SITE_ID, submission_id: p.id, form_id: p.formId, submitted_at: new Date(p.submittedAt).toISOString(),
    company, contact_name: contact, email, phone, source: source(attribution['Lead Source'], attribution['UTM Source'], attribution['UTM Medium']),
    scope: field(data, 'Workflow Notes', 20000), attribution,
    notes: [`Website inquiry: ${form}`, `Submitted: ${new Date(p.submittedAt).toISOString()}`, ...Object.entries(attribution).filter(([key, value]) => key !== 'form' && value).map(([key, value]) => `${key}: ${value}`)].join('\n'),
  };
}
async function readBody(req) {
  if (Number(req.headers.get('content-length')) > MAX_BYTES) throw new IntakeError(413);
  const reader = req.body?.getReader();
  if (!reader) throw new IntakeError(400);
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new IntakeError(413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new IntakeError(400); }
}
const reply = (status, state) => new Response(JSON.stringify({ status: state }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export function createHandler({ supabaseUrl, serviceKey, fetcher = fetch }) {
  return async req => {
    if (req.method !== 'POST') return reply(405, 'method_not_allowed');
    const key = new URL(req.url).searchParams.get('key');
    if (!key || !/^[a-f0-9]{64}$/.test(key)) return reply(401, 'unauthorized');
    if (!supabaseUrl || !serviceKey) return reply(503, 'unavailable');
    try {
      const lead = normalizeSubmission(await readBody(req));
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(b => b.toString(16).padStart(2, '0')).join('');
      const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/hq_receive_webflow`, {
        method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_key_hash: hash, p_lead: lead }), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return reply(503, 'retry');
      const result = await response.json();
      if (result.status === 'unauthorized') return reply(401, 'unauthorized');
      if (!['created', 'duplicate', 'ignored'].includes(result.status)) return reply(503, 'retry');
      return reply(200, result.status);
    } catch (error) {
      // Never log the webhook URL, service key, payload, or database error details.
      return reply(error instanceof IntakeError ? error.status : 503, error instanceof IntakeError ? 'invalid_request' : 'retry');
    }
  };
}
