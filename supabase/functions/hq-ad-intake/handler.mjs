const MAX_BYTES = 131072;
const HQ = '8ac08858-038c-41df-90a8-4a84f25cb400';
export class IntakeError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}
const fail = (code = 'invalid_lead') => { throw new IntakeError(400, code); };
function value(v, max = 500) {
  if (v == null) return '';
  if (typeof v !== 'string' || v.length > max || v.includes('\0')) fail();
  return v.trim();
}
function id(v) {
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) fail('unsafe_identifier'); return String(v); }
  const s = value(v, 200); if (!s) fail('missing_identifier'); return s;
}
export async function hash(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function validSignature(raw, signature, secret) {
  if (!/^sha256=[a-f0-9]{64}$/.test(signature ?? '') || !secret) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g).map(x => parseInt(x, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, raw);
}
function contact(fields) {
  const email = value(fields.email, 254); const phone = value(fields.phone, 40);
  const name = value(fields.name, 200) || value(email || phone, 200);
  if (!name || (!email && !phone) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('missing_or_invalid_contact');
  return { email, phone, contact_name: name, company: value(fields.company, 200) || name };
}
function submitted(v) { if (!v) return new Date().toISOString(); if (!Number.isFinite(Date.parse(v))) fail('invalid_date'); return new Date(v).toISOString(); }
export function normalizeGoogle(body) {
  const base = { external_id: id(body.lead_id), form_id: id(body.form_id), submitted_at: submitted(body.lead_submit_time) };
  if (body.is_test != null && typeof body.is_test !== 'boolean') fail('invalid_test_flag');
  if (body.is_test === true) return { ...base, status: 'test' }; // Provider tests never create customers.
  if (!Array.isArray(body.user_column_data) || body.user_column_data.length > 100) fail();
  const fields = Object.fromEntries(body.user_column_data.map(f => [value(f.column_id, 100), value(f.string_value, 2000)]));
  const attribution = Object.fromEntries(['campaign_id','adgroup_id','creative_id','asset_group_id'].filter(k => body[k] != null).map(k => [k, id(body[k])]));
  if (body.gcl_id) attribution.gcl_id = value(body.gcl_id, 1000);
  attribution.answers = fields;
  if (JSON.stringify(attribution).length > 14000) fail('answers_too_large');
  return { ...base, status: 'received', ...contact({ name: fields.FULL_NAME || [fields.FIRST_NAME,fields.LAST_NAME].filter(Boolean).join(' '), email: fields.EMAIL || fields.WORK_EMAIL, phone: fields.PHONE_NUMBER || fields.WORK_PHONE, company: fields.COMPANY_NAME }),
    attribution, notes: 'Google Ads lead form\n' + Object.entries(fields).map(([k,v]) => `${k}: ${v}`).join('\n'), scope: '' };
}
export function metaEvents(body, config) {
  if (body?.object !== 'page') return [];
  if (!Array.isArray(body.entry) || body.entry.length > 100) fail();
  const events = [];
  for (const entry of body.entry) {
    if (String(entry.id) !== config.page_id) continue;
    if (!Array.isArray(entry.changes)) fail();
    for (const change of entry.changes) {
      if (change.field !== 'leadgen') continue;
      const v = change.value;
      if (!v || String(v.page_id) !== config.page_id || !config.form_ids.includes(String(v.form_id))) continue;
      events.push({ external_id: id(v.leadgen_id), form_id: id(v.form_id), page_id: id(v.page_id), status: 'pending' });
    }
  }
  if (events.length > 100) fail();
  return events;
}
export function normalizeMeta(body, event) {
  if (String(body.id) !== event.external_id || (body.form_id && String(body.form_id) !== event.form_id)) fail('lead_identity_mismatch');
  if (!Array.isArray(body.field_data) || body.field_data.length > 100) fail();
  const fields = Object.fromEntries(body.field_data.map(f => [value(f.name,100), Array.isArray(f.values) ? f.values.map(v => value(v,2000)).join(', ') : '']));
  const attribution = { page_id: event.page_id, ...Object.fromEntries(['ad_id','adset_id','campaign_id','ad_name','adset_name','campaign_name'].filter(k=>body[k]).map(k=>[k,value(body[k],500)])), answers: fields };
  if (JSON.stringify(attribution).length > 14000) fail('answers_too_large');
  return { ...event, status: 'received', submitted_at: submitted(body.created_time), ...contact({ name: fields.full_name || [fields.first_name,fields.last_name].filter(Boolean).join(' '), email: fields.email || fields.work_email, phone: fields.phone_number || fields.work_phone_number, company: fields.company_name }),
    attribution, notes: 'Meta lead form\n' + Object.entries(fields).map(([k,v])=>`${k}: ${v}`).join('\n'), scope: '' };
}
async function readBody(req) {
  if (Number(req.headers.get('content-length')) > MAX_BYTES) throw new IntakeError(413,'request_too_large');
  const reader = req.body?.getReader(); if (!reader) fail();
  const chunks = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new IntakeError(413,'request_too_large'); } chunks.push(value); }
  const raw = new Uint8Array(size); let offset = 0; for (const c of chunks) { raw.set(c,offset); offset += c.byteLength; }
  return raw;
}
// Google identifiers are int64 values. Preserve numeric ID literals before JSON.parse.
export function parseBody(raw) {
  try {
    const text = new TextDecoder('utf-8',{fatal:true}).decode(raw);
    const body = JSON.parse(text.replace(/("(?:form_id|campaign_id|adgroup_id|creative_id|asset_group_id)"\s*:\s*)(\d{16,})(?=\s*[,}])/g, '$1"$2"'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail();
    return body;
  } catch { fail('invalid_json'); }
}
const reply = (status, code) => new Response(JSON.stringify(status===200?{}:{message:code}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createHandler({ supabaseUrl, serviceKey, fetcher = fetch }) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type':'application/json' };
  async function rpc(name, args) {
    const res = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`,{ method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(15000) });
    if (!res.ok) throw new IntakeError(503,'intake_save_failed');
    return res.json();
  }
  async function processMeta(event, config) {
    const receipt = await rpc('hq_receive_ad',{p_provider:'meta',p_lead:event});
    if (receipt.status==='duplicate' || receipt.status==='ignored') return;
    try {
      if (!/^v\d+\.\d+$/.test(config.graph_version) || !/^\d+$/.test(event.external_id)) fail('invalid_meta_configuration');
      const url = new URL(`https://graph.facebook.com/${config.graph_version}/${event.external_id}`);
      url.searchParams.set('fields','id,created_time,form_id,field_data,ad_id,adset_id,campaign_id');
      const res = await fetcher(url,{headers:{Authorization:`Bearer ${config.page_token}`},signal:AbortSignal.timeout(12000)});
      if (!res.ok) throw new IntakeError(503,`meta_fetch_${res.status}`);
      await rpc('hq_receive_ad',{p_provider:'meta',p_lead:normalizeMeta(await res.json(),event)});
    } catch(e) {
      await rpc('hq_receive_ad',{p_provider:'meta',p_lead:{...event,status:'failed',error_code:e instanceof IntakeError?e.message:'meta_fetch_unavailable'}});
      throw new IntakeError(503,'meta_lead_pending_retry');
    }
  }
  return async req => {
    try {
      if (!supabaseUrl || !serviceKey) throw new IntakeError(503,'not_configured');
      const url = new URL(req.url); const provider = url.searchParams.get('provider');
      if (!['google_ads','meta'].includes(provider)) throw new IntakeError(404,'unknown_connection');
      if (!['POST','GET'].includes(req.method)) throw new IntakeError(405,'method_not_allowed');
      const config = await rpc('hq_ad_config',{p_provider:provider});
      if (!config) throw new IntakeError(503,'connection_not_enabled');
      if (req.method==='GET') {
        if (provider!=='meta' || url.searchParams.get('hub.mode')!=='subscribe' || await hash(url.searchParams.get('hub.verify_token')||'')!==config.key_hash) throw new IntakeError(403,'verification_failed');
        const challenge=value(url.searchParams.get('hub.challenge'),500);
        return new Response(challenge,{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
      }
      const raw = await readBody(req);
      // A retry is staff-authenticated; it can only replay IDs already in HQ.
      if (url.searchParams.get('retry')==='1') {
        if (provider!=='meta') fail();
        const auth=req.headers.get('authorization')||'';
        const u=await fetcher(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:serviceKey,Authorization:auth},signal:AbortSignal.timeout(10000)});
        if (!u.ok) throw new IntakeError(401,'sign_in_required');
        const user=await u.json();
        const membership=await fetcher(`${supabaseUrl}/rest/v1/workspace_memberships?workspace_id=eq.${HQ}&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&select=role`,{headers,signal:AbortSignal.timeout(10000)});
        if (!membership.ok || !(await membership.json()).some(m=>['owner','administrator','member'].includes(m.role))) throw new IntakeError(403,'hq_access_required');
        const body=parseBody(raw);
        const rows=await fetcher(`${supabaseUrl}/rest/v1/hq_ad_receipts?provider=eq.meta&external_id=eq.${encodeURIComponent(id(body.external_id))}&status=in.(pending,failed)&select=external_id,form_id,page_id`,{headers,signal:AbortSignal.timeout(10000)});
        if (!rows.ok) throw new IntakeError(503,'retry_unavailable');
        for (const event of await rows.json()) await processMeta({...event,status:'pending'},config);
        return reply(200);
      }
      if (provider==='meta') {
        if (!await validSignature(raw,req.headers.get('x-hub-signature-256'),config.app_secret)) throw new IntakeError(401,'invalid_signature');
        for (const event of metaEvents(parseBody(raw),config)) await processMeta(event,config);
      } else {
        const body=parseBody(raw);
        if (await hash(value(body.google_key,1000))!==config.key_hash) throw new IntakeError(401,'invalid_key');
        await rpc('hq_receive_ad',{p_provider:provider,p_lead:normalizeGoogle(body)});
      }
      return reply(200);
    } catch(e) { return reply(e instanceof IntakeError?e.status:503,e instanceof IntakeError?e.message:'intake_unavailable'); }
  };
}
