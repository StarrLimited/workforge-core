import { notFound } from 'next/navigation';
import { z } from 'zod';
import { session,membership } from '@/lib/data';
import { canWrite } from '@/lib/core';
import { AI_LABELS,type AIDraft } from '@/lib/ai/contracts';
import { AIAssistant } from '@/components/field/ai-assistant';
export const dynamic='force-dynamic';
export default async function SavedDraft({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 const {db}=await session();const {data,error}=await db.from('ai_drafts').select('id,workspace_id,work_order_id,kind,status,input_snapshot,result,reviewed_result,error_message,created_at,finished_at,estimated_cost_cents').eq('id',id).maybeSingle();
 if(error||!data)notFound();const draft=data as AIDraft;const {role}=await membership(draft.workspace_id);
 return <main className="ai-draft-page"><a href={`/?workspace=${draft.workspace_id}`}>← Back to WorkForge</a><p className="eyebrow">WORKFORGE AI · SAVED DRAFT</p><h1>{AI_LABELS[draft.kind]}</h1><p>WF-{draft.input_snapshot.order.number} · {draft.input_snapshot.order.title}</p><AIAssistant workspaceId={draft.workspace_id} orderId={draft.work_order_id} kind={draft.kind} writable={canWrite(role)} initialDraft={draft}/></main>;
}
