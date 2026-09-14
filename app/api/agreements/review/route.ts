import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {signatureSchema} from '@/lib/hq-estimating';
export const dynamic='force-dynamic';
const response=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>220000)return response({error:'Signature is too large.'},413);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return response({error:'Open the signing page to continue.'},403);
 try{const raw=await request.text();if(raw.length>220000)return response({error:'Signature is too large.'},413);const body=JSON.parse(raw);const token=z.string().regex(/^[a-f0-9]{64}$/).parse(body.token);
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='review'){const r=await db.rpc('hq_review_agreement',{p_token:token});if(r.error)throw new Error('Unable to load the agreement. Please retry.');if(!r.data)return response({error:'This signing link has expired, been revoked, or belongs to a replaced offer. Ask WorkForge for a new link.'},404);return response(r.data);}
  if(body.action==='sign'){const s=signatureSchema.parse(body.signature);const r=await db.rpc('hq_sign_client',{p_token:token,p_name:s.name,p_title:s.title,p_email:s.email,p_image:s.signature_image,p_consent:s.consent});if(r.error)throw new Error(r.error.message);return response({ok:true});}
  return response({error:'Invalid request.'},400);
 }catch(e){return response({error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'Unable to complete the request.'},400);}
}
