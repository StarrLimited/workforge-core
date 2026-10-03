'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createHash, randomBytes } from 'node:crypto';
import { membership } from '@/lib/data';
import { HQ_WORKSPACE_ID } from '@/lib/hq';

export async function manageUser(action: string, form: FormData): Promise<{ok:boolean; message?:string; error?:string}> {
  const {db,role}=await membership(HQ_WORKSPACE_ID);
  if(!['owner','administrator'].includes(role)) return {ok:false,error:'HQ administrator access required.'};
  try {
    const raw=Object.fromEntries(form);
    const access=z.enum(['administrator','member','read_only']);
    let values;
    if(action==='add') values=z.object({email:z.email().max(254),role:access}).parse(raw);
    else if(action==='update') {const v=z.object({user_id:z.uuid(),role:access,is_active:z.enum(['true','false'])}).parse(raw);values={...v,is_active:v.is_active==='true'};}
    else if(action==='revoke_invitation') values=z.object({id:z.uuid()}).parse(raw);
    else throw new Error('Unknown action.');
    const {data,error}=await db.rpc('hq_manage_user',{p_action:action,p_values:values});
    if(error) throw new Error(error.message);
    revalidatePath('/hq/admin');return {ok:true,message:data};
  } catch(e) {return {ok:false,error:e instanceof z.ZodError?e.issues[0]?.message:e instanceof Error?e.message:'Unable to update access.'};}
}

export async function configureRelay(form:FormData):Promise<{ok:boolean;key?:string;error?:string}> {
  const {db,role}=await membership(HQ_WORKSPACE_ID);
  if(!['owner','administrator'].includes(role)) return {ok:false,error:'HQ administrator access required.'};
  try {
    const v=z.object({provider:z.enum(['meta','google_ads']),enabled:z.enum(['true','false']),default_owner:z.enum(['Shawn','Neil']),form_ids:z.string().max(4000),page_id:z.string().max(100),rotate:z.enum(['true','false'])}).parse(Object.fromEntries(form));
    const key=v.enabled==='true'&&v.rotate==='true'?randomBytes(32).toString('hex'):'';
    const {error}=await db.rpc('hq_configure_relay',{p_provider:v.provider,p_values:{...v,enabled:v.enabled==='true',form_ids:v.form_ids.split(/[\s,]+/).filter(Boolean),key_hash:key?createHash('sha256').update(key).digest('hex'):''}});
    if(error) throw new Error(error.message);
    revalidatePath('/hq');return {ok:true,key};
  }catch(e){return {ok:false,error:e instanceof z.ZodError?'Check the connection fields.':e instanceof Error?e.message:'Unable to save.'};}
}
