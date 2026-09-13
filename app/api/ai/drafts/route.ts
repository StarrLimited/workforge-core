import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { canWrite } from '@/lib/core';
import { AI_KINDS,type AISnapshot } from '@/lib/ai/contracts';
import { aiErrorMessage,buildPrompt,generateFieldDraft } from '@/lib/ai/generate';
export const runtime='nodejs';
export const maxDuration=90;
export const dynamic='force-dynamic';
const requestSchema=z.object({workspace_id:z.uuid(),work_order_id:z.uuid(),kind:z.enum(AI_KINDS)});
const columns='id,workspace_id,work_order_id,kind,status,input_snapshot,result,reviewed_result,error_message,created_at,finished_at,estimated_cost_cents';
async function authorize(workspace:string){
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return {error:NextResponse.json({error:'Sign in again to use the assistant.'},{status:401})};
 const {data:member,error}=await db.from('workspace_memberships').select('role').eq('workspace_id',workspace).eq('user_id',user.id).eq('is_active',true).maybeSingle();
 if(error||!member)return {error:NextResponse.json({error:'Workspace access could not be verified.'},{status:403})};
 return {db,role:member.role};
}
export async function GET(req:NextRequest){
 const parsed=requestSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
 if(!parsed.success)return NextResponse.json({error:'Choose a job and assistant.'},{status:400});
 const auth=await authorize(parsed.data.workspace_id);if(auth.error)return auth.error;
 const {data,error}=await auth.db.from('ai_drafts').select(columns).eq('workspace_id',parsed.data.workspace_id).eq('work_order_id',parsed.data.work_order_id).eq('kind',parsed.data.kind).order('created_at',{ascending:false}).limit(20);
 if(error)return NextResponse.json({error:'Saved AI drafts are unavailable. The job editor is still available.'},{status:503});
 return NextResponse.json({drafts:data},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(req:NextRequest){
 // Cookie-authenticated endpoint: refuse cross-origin paid requests.
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Open the assistant in WorkForge.'},{status:403});
 if(Number(req.headers.get('content-length')??0)>2048)return NextResponse.json({error:'Request too large.'},{status:413});
 const parsed=requestSchema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:'Choose a job and assistant.'},{status:400});
 const input=parsed.data;const auth=await authorize(input.workspace_id);if(auth.error)return auth.error;
 if(!canWrite(auth.role))return NextResponse.json({error:'This workspace is read only for your account.'},{status:403});
 if(!process.env.AI_GATEWAY_API_KEY&&!process.env.VERCEL_OIDC_TOKEN&&process.env.VERCEL!=='1')return NextResponse.json({error:'AI connection needs setup. Add an AI Gateway API key to the server environment, or use the Vercel deployment’s AI Gateway connection.'},{status:503});
 const {data:reservation,error:startError}=await auth.db.rpc('reserve_field_ai',{p_workspace_id:input.workspace_id,p_order_id:input.work_order_id,p_kind:input.kind});
 if(startError)return NextResponse.json({error:startError.message},{status:409});
 const run=reservation as {id:string;execution_token:string;snapshot:AISnapshot};
 let result=null,raw:string|null=null,inputTokens:number|null=null,outputTokens:number|null=null,errorMessage:string|null=null;
 try {
  buildPrompt(input.kind,run.snapshot);
  const generated=await generateFieldDraft(input.kind,run.snapshot);result=generated.result;raw=generated.text;
  inputTokens=generated.usage.inputTokens??null;outputTokens=generated.usage.outputTokens??null;
 }catch(error){
  errorMessage=aiErrorMessage(error);
  const failed=error as {text?:string;usage?:{inputTokens?:number;outputTokens?:number}};
  raw=typeof failed?.text==='string'?failed.text:null;inputTokens=failed?.usage?.inputTokens??null;outputTokens=failed?.usage?.outputTokens??null;
 }
 const {error:saveError}=await auth.db.rpc('finish_field_ai',{p_id:run.id,p_token:run.execution_token,p_result:result,p_raw:raw?.slice(0,24000)??null,p_input:inputTokens,p_output:outputTokens,p_error:errorMessage});
 if(saveError)return NextResponse.json({id:run.id,error:'The AI response could not be saved. No job changes were made. Check saved drafts before generating another.'},{status:503});
 return NextResponse.json({id:run.id,...(errorMessage?{error:errorMessage}:{ok:true})},{status:errorMessage?502:200});
}
