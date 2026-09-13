'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { membership } from '@/lib/data';
import { canWrite } from '@/lib/core';
import { reviewSchema } from '@/lib/ai/contracts';
export async function applyAIDraft(workspaceId:string,draftId:string,review:unknown){
 try {
  z.uuid().parse(workspaceId);z.uuid().parse(draftId);const validated=reviewSchema.safeParse(review);
  if(!validated.success)return {error:'Check the draft fields and confirm quantities before saving.'};
  const {db,role}=await membership(workspaceId);if(!canWrite(role))return {error:'This workspace is read only for your account.'};
  const {data:record,error:readError}=await db.from('ai_drafts').select('id').eq('workspace_id',workspaceId).eq('id',draftId).maybeSingle();
  if(readError||!record)return {error:'AI draft not found in this workspace.'};
  const {error}=await db.rpc('apply_field_ai',{p_id:draftId,p_review:validated.data});if(error)return {error:error.message};
  revalidatePath('/');revalidatePath(`/ai/drafts/${draftId}`);return {ok:true};
 }catch{return {error:'Unable to save this draft. Check your session and try again.'};}
}
