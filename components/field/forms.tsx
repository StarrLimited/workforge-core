'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from '@/app/actions';

export function SaveForm({workspaceId,orderId,action,children,label='Save changes',writable=true,onSaved,extra,className='field-form'}:{workspaceId:string;orderId?:string;action:string;children:React.ReactNode;label?:string;writable?:boolean;onSaved?:(id?:string)=>void;extra?:Record<string,string>;className?:string}){
  const router=useRouter();const [pending,startTransition]=useTransition();const [error,setError]=useState('');const [saved,setSaved]=useState(false);
  return <form className={className} onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);if(orderId)fd.set('work_order_id',orderId);for(const [key,value] of Object.entries(extra??{}))fd.set(key,value);setError('');setSaved(false);startTransition(async()=>{try{const r=await mutate(workspaceId,action,fd);if(!r.ok){setError(r.error??'Unable to save.');return;}setSaved(true);onSaved?.(r.id);router.refresh();}catch{setError('Connection interrupted. Please retry.');}});}}>
    <fieldset disabled={!writable||pending}>{children}</fieldset>
    {error&&<p className="error" role="alert">{error}</p>}{saved&&<p className="success-message" role="status">Saved successfully.</p>}
    {writable&&<div className="field-form-footer"><button className="primary" disabled={pending}>{pending?'Saving…':label}</button></div>}
  </form>;
}
export function CheckField({name,label,checked=false}:{name:string;label:string;checked?:boolean}){return <label className="check-field"><input type="checkbox" name={name} defaultChecked={checked}/><span>{label}</span></label>;}
export function Empty({children}:{children:React.ReactNode}){return <div className="field-empty">{children}</div>;}
