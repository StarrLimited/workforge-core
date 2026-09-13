'use client';
import { useCallback,useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles,ChevronDown,ExternalLink,RefreshCw } from 'lucide-react';
import { applyAIDraft } from '@/app/ai/actions';
import { AI_LABELS,estimatePreview,type AIDraft,type AIKind,type Review } from '@/lib/ai/contracts';
import { money } from '@/lib/field';

const descriptions:Record<AIKind,string>={consultation:'Turn saved site notes into a consultation brief and a list of open questions.',estimate:'Match the saved scope and measurements to your active pricebook, then review quantities and pricing.',handoff:'Turn the approved scope into production notes, a materials checklist and job tasks.'};
export function AIAssistant({workspaceId,orderId,kind,writable,initialDraft}:{workspaceId:string;orderId:string;kind:AIKind;writable:boolean;initialDraft?:AIDraft}){
 const [open,setOpen]=useState(!!initialDraft),[drafts,setDrafts]=useState<AIDraft[]>(initialDraft?[initialDraft]:[]),[selected,setSelected]=useState(initialDraft?.id??''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const query=new URLSearchParams({workspace_id:workspaceId,work_order_id:orderId,kind}).toString();
 const refresh=useCallback(async(id?:string)=>{
  setLoading(true);
  try {const response=await fetch(`/api/ai/drafts?${query}`,{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to load saved drafts.');setDrafts(initialDraft&&!data.drafts.some((d:AIDraft)=>d.id===initialDraft.id)?[...data.drafts,initialDraft]:data.drafts);if(id)setSelected(id);else setSelected(current=>current||data.drafts[0]?.id||'');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load saved drafts.');}finally{setLoading(false);}
 },[query,initialDraft]);
 useEffect(()=>{if(open)void refresh();},[open,refresh]);
 async function generate(){
  setBusy(true);setError('');setOpen(true);
  try {
   const response=await fetch('/api/ai/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace_id:workspaceId,work_order_id:orderId,kind})});
   const data=await response.json();await refresh(data.id);
   if(!response.ok)throw new Error(data.error||'The AI request did not complete.');
  }catch(e){setError(e instanceof Error?e.message:'Connection interrupted. Check saved drafts before trying again.');}finally{setBusy(false);}
 }
 const active=drafts.find(d=>d.id===selected);
 return <section className="ai-assistant" aria-label={AI_LABELS[kind]}>
  <button type="button" className="ai-assistant-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><span><Sparkles size={18}/><strong>{AI_LABELS[kind]}</strong><small>WorkForge AI</small></span><ChevronDown size={18}/></button>
  {open&&<div className="ai-assistant-body"><p>{descriptions[kind]}</p><p className="muted small">Save your edits first. The assistant uses saved job information. Review each draft before applying it.</p>
   <div className="button-row"><button className="primary" disabled={!writable||busy||loading} onClick={generate}><Sparkles size={16}/>{busy?'Preparing your draft…':'Generate new draft'}</button><button className="secondary" disabled={loading||busy} onClick={()=>{setError('');void refresh();}}><RefreshCw size={15}/>Refresh history</button></div>
   <p className="muted small">Workspace limit: 20 drafts per day and $10 per month in estimated AI usage. Each request reserves up to $1 while running.</p>
   {busy&&<p role="status">This may take about a minute. No job records change during generation.</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   {drafts.length>0&&<label className="ai-history">Saved drafts<select value={selected} onChange={e=>setSelected(e.target.value)}>{drafts.map(d=><option key={d.id} value={d.id}>{new Date(d.created_at).toISOString().slice(0,16).replace('T',' ')+' UTC'} · {d.status}</option>)}</select></label>}
   {active&&<><div className="ai-draft-meta"><span>Draft · {active.status}</span><a href={`/ai/drafts/${active.id}`} target="_blank" rel="noreferrer">Open saved draft<ExternalLink size={13}/></a></div>
    {active.status==='pending'&&<p role="status">{Date.now()-new Date(active.created_at).getTime()>180000?'This request did not finish in time. No job changes were made. You can generate a new draft.':'This draft is still running. Refresh history shortly.'}</p>}
    {active.status==='failed'&&<p className="error" role="alert">{active.error_message||'This draft could not be completed.'}</p>}
    {active.result&&['ready','applied'].includes(active.status)&&<DraftReview key={`${active.id}-${active.status}`} draft={active} writable={writable} onApplied={()=>refresh(active.id)}/>}</>}
   {!loading&&!drafts.length&&!busy&&<p className="muted small">Your saved drafts will appear here.</p>}
  </div>}
 </section>;
}
function DraftReview({draft:d,writable,onApplied}:{draft:AIDraft;writable:boolean;onApplied:()=>Promise<void>}){
 const router=useRouter();const result=d.result!;const reviewed=d.reviewed_result;
 const [summary,setSummary]=useState(reviewed&&'summary'in reviewed?reviewed.summary:result.summary);
 const [scope,setScope]=useState(reviewed&&'scope'in reviewed?reviewed.scope:result.scope);
 const [notes,setNotes]=useState(reviewed&&'notes'in reviewed?reviewed.notes:result.notes);
 const [items,setItems]=useState<{product_id:string;quantity:number|null;description:string;quantity_evidence?:string;selected:boolean}[]>((reviewed&&'items'in reviewed?reviewed.items:result.items).map(i=>({...i,selected:true})));
 const [tasks,setTasks]=useState((reviewed&&'tasks'in reviewed?reviewed.tasks:result.tasks).map(title=>({title,selected:true})));
 const [saving,setSaving]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false);
 const applied=d.status==='applied';const disabled=!writable||applied||saving;
 let preview:ReturnType<typeof estimatePreview>|undefined,previewError='';
 if(d.kind==='estimate'){try{const selected=items.filter(i=>i.selected);if(!selected.length)throw new Error('Select at least one pricebook item.');preview=estimatePreview(d.input_snapshot,selected);}catch(e){previewError=e instanceof Error?e.message:'Check estimate quantities.';}}
 async function apply(){
  if(!confirmed)return;setSaving(true);setError('');
  const payload:Review=d.kind==='consultation'?{summary}:d.kind==='estimate'?{scope,items:items.filter(i=>i.selected).map(i=>({product_id:i.product_id,quantity:i.quantity!,description:i.description}))}:{notes,tasks:tasks.filter(t=>t.selected).map(t=>t.title)};
  try {const saved=await applyAIDraft(d.workspace_id,d.id,payload);
   if(saved.error)setError(saved.error);else{await onApplied();router.refresh();}
  }catch{setError('Connection interrupted while saving. Refresh history before trying again.');}finally{setSaving(false);}
 }
 return <div className="ai-review">
  {applied&&<p className="ai-applied" role="status">This reviewed draft has been saved to the job.</p>}
  {!!result.questions.length&&<div className="ai-questions"><strong>Questions to resolve</strong><ul>{result.questions.map((question,i)=><li key={i}>{question}</li>)}</ul></div>}
  <fieldset disabled={disabled}>
   {d.kind==='consultation'&&<label>Review consultation summary<textarea rows={8} maxLength={5000} value={summary} onChange={e=>setSummary(e.target.value)}/><small>The summary is saved separately from your original site notes.</small></label>}
   {d.kind==='estimate'&&<><label>Review scope of work<textarea rows={6} maxLength={10000} value={scope} onChange={e=>setScope(e.target.value)}/></label>
    <p className="muted small">Prices use saved pricebook costs and this job’s {d.input_snapshot.order.target_margin}% target margin. Confirm measurements and quantities before saving.</p>
    {items.map((item,index)=>{const product=d.input_snapshot.pricebook.find(p=>p.id===item.product_id);return <div className="ai-estimate-item" key={item.product_id}>
     <label className="check-field"><input type="checkbox" checked={item.selected} onChange={e=>setItems(items.map((v,i)=>i===index?{...v,selected:e.target.checked}:v))}/>{product?.name??'Unavailable pricebook item'}</label>
     <div className="form-grid"><label>Quantity · {product?.unit}<input type="number" min="0.001" max="100000" step="0.001" value={item.quantity??''} placeholder="Confirm quantity" onChange={e=>setItems(items.map((v,i)=>i===index?{...v,quantity:e.target.value===''?null:Number(e.target.value)}:v))}/></label><div className="ai-price"><small>Material + labor / unit</small><strong>{product?money(product.material_cents+product.labor_cents):'Unavailable'}</strong></div></div>
     {'quantity_evidence'in item&&<p className="muted small">Quantity reference: {item.quantity_evidence}</p>}
     <label>Item description<textarea rows={2} maxLength={3000} value={item.description} onChange={e=>setItems(items.map((v,i)=>i===index?{...v,description:e.target.value}:v))}/></label>
    </div>;})}
    {!items.length&&<p>No matching pricebook items were found. Add the needed items to your pricebook, then generate a fresh draft or use the estimate builder.</p>}
    {previewError&&<p className="error">{previewError}</p>}
    {preview&&<div className="ai-totals"><span>Subtotal<strong>{money(preview.totals.subtotal_cents)}</strong></span><span>Discount<strong>{money(preview.totals.discount_cents)}</strong></span><span>Tax<strong>{money(preview.totals.tax_cents)}</strong></span><span>Total<strong>{money(preview.totals.price_cents)}</strong></span><span>Requested deposit<strong>{money(preview.totals.deposit_cents)}</strong></span></div>}
   </>}
   {d.kind==='handoff'&&<><label>Review production handoff<textarea rows={9} maxLength={4500} value={notes} onChange={e=>setNotes(e.target.value)}/><small>This will be added after the existing production notes.</small></label><strong>Tasks to add</strong>{tasks.map((task,index)=><div className="ai-task" key={index}><input type="checkbox" aria-label={`Include task ${index+1}`} checked={task.selected} onChange={e=>setTasks(tasks.map((t,i)=>i===index?{...t,selected:e.target.checked}:t))}/><input aria-label={`Task ${index+1} title`} maxLength={300} value={task.title} onChange={e=>setTasks(tasks.map((t,i)=>i===index?{...t,title:e.target.value}:t))}/></div>)}<p className="muted small">Selected tasks are added to the job’s punch list. Matching existing task titles are skipped.</p></>}
   {!applied&&<label className="check-field ai-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{d.kind==='estimate'?`I reviewed the scope and quantities. Save this as the job’s estimate, replacing ${d.input_snapshot.order.estimate_lines.length} existing draft item(s).`:d.kind==='handoff'?'I reviewed the notes and selected tasks for this job.':'I reviewed the summary against the original site notes.'}</label>}
  </fieldset>
  {error&&<p className="error" role="alert">{error}</p>}
  {!applied&&<button className="primary" disabled={disabled||!confirmed||(d.kind==='estimate'&&!!previewError)} onClick={apply}>{saving?'Saving reviewed draft…':d.kind==='consultation'?'Save reviewed summary':d.kind==='estimate'?'Use reviewed estimate':'Save handoff & selected tasks'}</button>}
 </div>;
}
