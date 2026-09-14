'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {membership} from '@/lib/data';
import {canWrite} from '@/lib/core';
import {HQ_WORKSPACE_ID} from '@/lib/hq';
import {signatureSchema} from '@/lib/hq-estimating';

export async function signProvider(id:string,input:unknown){
 const {db,role}=await membership(HQ_WORKSPACE_ID);
 if(!canWrite(role))return {ok:false,error:'HQ write access required.'};
 try{const s=signatureSchema.parse(input);const r=await db.rpc('hq_sign_provider',{p_id:z.uuid().parse(id),p_name:s.name,p_title:s.title,p_email:s.email,p_image:s.signature_image,p_consent:s.consent});if(r.error)throw new Error(r.error.message);
  revalidatePath('/hq/sales');revalidatePath('/hq/agreements/[id]','page');return {ok:true};
 }catch(e){return {ok:false,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'Unable to save your signature.'};}
}
export async function createSigningLink(id:string,email:string){
 const {db,role}=await membership(HQ_WORKSPACE_ID);if(!canWrite(role))return {ok:false,error:'HQ write access required.'};
 try{const r=await db.rpc('hq_create_signing_request',{p_id:z.uuid().parse(id),p_email:z.email().parse(email)});if(r.error)throw new Error(r.error.message);revalidatePath('/hq/sales');return {ok:true,token:r.data.token as string};}
 catch(e){return {ok:false,error:e instanceof Error?e.message:'Unable to create a signing link.'};}
}
export async function revokeSigningLinks(id:string){
 const {db,role}=await membership(HQ_WORKSPACE_ID);if(!canWrite(role))return {ok:false,error:'HQ write access required.'};
 const r=await db.rpc('hq_revoke_signing_requests',{p_id:z.uuid().parse(id)});revalidatePath('/hq/sales');return r.error?{ok:false,error:r.error.message}:{ok:true};
}
export async function gmailAction(input:Record<string,unknown>):Promise<Record<string,any>>{
 const {db,role}=await membership(HQ_WORKSPACE_ID);
 if(input.action!=='status'&&!canWrite(role))return {error:'HQ write access required.'};
 const {data,error}=await db.functions.invoke('hq-gmail',{body:input});
 if(error){try{const body=await error.context?.json();return {error:body?.error||'Gmail is unavailable. Please retry.'};}catch{return {error:'Gmail is unavailable. Please retry.'};}}
 if(input.action!=='status')revalidatePath('/hq/sales');return data;
}
