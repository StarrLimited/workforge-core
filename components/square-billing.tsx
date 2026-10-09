'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BillingCustomer, BillingRecord, BillingSource, InvoiceRecord } from '@/lib/square/core';

type Data={ready:boolean;setupMessage?:string;environment?:string;writable:boolean;customers:BillingCustomer[];sources:BillingSource[];records:BillingRecord[];invoices:InvoiceRecord[]};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const label=(s:string)=>s.toLowerCase().replaceAll('_',' ');
async function api(body?:Record<string,unknown>,query='') {
 const response=await fetch('/api/square/billing'+query,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error||'Unable to load Square billing.');
 return result;
}
function BillingDialog({children,onClose}:{children:React.ReactNode;onClose:()=>void}) {
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="sq-modal" ref={ref} onCancel={onClose}>{children}</dialog>;
}
export default function SquareBilling({brand,back,accountingNote}:{brand:string;back:string;accountingNote:string}) {
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState<'invoice'|'monthly'>('invoice'),[sourceId,setSourceId]=useState(''),[customerId,setCustomerId]=useState('');
 const [title,setTitle]=useState(''),[amount,setAmount]=useState(''),[deposit,setDeposit]=useState('0'),[depositKind,setDepositKind]=useState('amount');
 const [depositDate,setDepositDate]=useState(localDay),[balanceDate,setBalanceDate]=useState(localDay),[startDate,setStartDate]=useState(localDay);
 const [cards,setCards]=useState<Array<{id:string;label:string}>>([]),[cardId,setCardId]=useState(''),[consent,setConsent]=useState(''),[confirmMonthly,setConfirmMonthly]=useState(false);
 const [confirmAction,setConfirmAction]=useState<{action:string;record:BillingRecord}|null>(null);
 const load=useCallback(async()=>{setData(await api());},[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));},[load]);
 const source=data?.sources.find(s=>s.id===sourceId);
 const customer=data?.customers.find(c=>c.id===(source?.customerId||customerId));
 const options=data?.sources.filter(s=>s.cadence===(mode==='invoice'?'one_time':'monthly'))??[];
 const requested=source?.amountCents??Math.round(Number(amount||0)*100);
 const depositCents=depositKind==='percent'?Math.round(requested*Number(deposit||0)/100):Math.round(Number(deposit||0)*100);
 async function run(body:Record<string,unknown>) {
   setBusy(true);setError('');setMessage('');
   try {const result=await api(body);await load();setMessage(result.message||'Saved.');setConfirmAction(null);}
   catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);}
 }
 async function loadCards() {
   if(!customer)return;
   setBusy(true);setError('');
   try{const result=await api(undefined,'?cards='+encodeURIComponent(customer.id));setCards(result.cards);setMessage(result.cards.length?'Select an authorized card.':'No saved cards yet. The customer can save a card while paying a Square invoice.');}
   catch(e){setError(e instanceof Error?e.message:'Unable to load cards.');}finally{setBusy(false);}
 }
 function selectSource(value:string){setSourceId(value);setCards([]);setCardId('');setConsent('');setConfirmMonthly(false);}
 return <main className="sq-page">
  <header className="sq-header"><div><a href={back}>← Back to {brand}</a><p className="sq-eyebrow">{brand} / BILLING</p><h1>Square payments</h1><p>Deposits, final balances, and ongoing monthly service.</p></div><span className="sq-badge">{data?.ready?(data.environment==='production'?'Live account':'Sandbox · test payments'):'Setup required'}</span></header>
  {error&&<div className="sq-alert sq-error" role="alert">{error}</div>}
  {message&&<div className="sq-alert" role="status">{message}</div>}
  {!data&&!error&&<p>Loading billing…</p>}
  {data&&!data.ready&&<section className="sq-card"><h2>Connect your Square account</h2><p>{data.setupMessage}</p><p>An administrator must add the account credentials and webhook settings to this app. Each business can use its own Square account.</p><p>Once connected, test a deposit, final payment, and monthly subscription in Square Sandbox before collecting live payments.</p></section>}
  {data&&<div className="sq-grid">
   <section className="sq-card"><div className="sq-section-heading"><h2>Set up billing</h2>{data.ready&&data.writable&&<button type="button" disabled={busy} onClick={()=>void run({action:'check'})}>Check connection</button>}</div>
    <fieldset disabled={busy||!data.ready||!data.writable}>
    <div className="sq-tabs"><button type="button" aria-pressed={mode==='invoice'} onClick={()=>{setMode('invoice');selectSource('');}}>Project invoice</button><button type="button" aria-pressed={mode==='monthly'} onClick={()=>{setMode('monthly');selectSource('new-monthly');}}>Monthly service</button></div>
    <form onSubmit={e=>{e.preventDefault();void run({action:'create',mode,sourceId,customerId,title,amount,deposit,depositKind,depositDate,balanceDate,startDate,cardId,consent,confirmMonthly});}}>
     <label>{mode==='invoice'?'Invoice or agreed fee':'Monthly service'}<select required value={sourceId} onChange={e=>selectSource(e.target.value)}><option value="">Choose a record</option>{mode==='monthly'&&<option value="new-monthly">New monthly service</option>}{options.map(s=><option key={s.id} value={s.id}>{s.title} · {money(s.amountCents)}</option>)}</select></label>
     {mode==='invoice'&&!options.length&&<p className="sq-help">Create or approve an invoice or one-time fee first, and link it to a customer with a billing email.</p>}
     {sourceId==='new-monthly'&&mode==='monthly'&&<><label>Customer<select required value={customerId} onChange={e=>{setCustomerId(e.target.value);setCards([]);setCardId('');setConfirmMonthly(false);}}><option value="">Choose a customer</option>{data.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Service name<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Monthly landscape maintenance" /></label><label>Monthly total, including applicable tax<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} /></label></>}
     {customer&&<div className="sq-recipient"><strong>{customer.name}</strong><span>{customer.email||'Add a billing email before continuing.'}</span></div>}
     {mode==='invoice'&&<><div className="sq-row"><label>Deposit amount<input type="number" min="0" step="0.01" value={deposit} onChange={e=>setDeposit(e.target.value)} required /></label><label>Unit<select value={depositKind} onChange={e=>setDepositKind(e.target.value)}><option value="amount">Dollars</option><option value="percent">Percent</option></select></label></div><div className="sq-row"><label>Deposit due<input type="date" min={localDay()} value={depositDate} onChange={e=>setDepositDate(e.target.value)} required /></label><label>Final payment due<input type="date" min={depositCents>0?depositDate:localDay()} value={balanceDate} onChange={e=>setBalanceDate(e.target.value)} required /></label></div><div className="sq-summary"><span>Invoice balance <strong>{money(requested)}</strong></span><span>Deposit <strong>{money(depositCents||0)}</strong></span><span>Final payment <strong>{money(Math.max(0,requested-(depositCents||0)))}</strong></span></div><p className="sq-help">Set the deposit to $0 for one full payment. Saving creates an unsent draft. Review it before sending.</p></>}
     {mode==='monthly'&&<><label>First billing date<input type="date" required min={localDay()} value={startDate} onChange={e=>setStartDate(e.target.value)} /></label><label>Payment collection<select value={cardId} onChange={e=>setCardId(e.target.value)}><option value="">Email a payment link each month</option>{cards.map(c=><option key={c.id} value={c.id}>{c.label} · automatic payment</option>)}</select></label><button type="button" disabled={!customer} onClick={()=>void loadCards()}>Load customer’s saved cards</button>{cardId&&<label>Customer’s recurring-payment authorization<textarea required minLength={10} maxLength={2000} value={consent} onChange={e=>setConsent(e.target.value)} placeholder="Who authorized this amount, when, and where the authorization is recorded" /></label>}<p className="sq-help">Bills {money(requested)} each month until canceled. Automatic collection requires a saved card and the customer’s authorization.</p><label className="sq-check"><input type="checkbox" required checked={confirmMonthly} onChange={e=>setConfirmMonthly(e.target.checked)} />I confirm this customer’s monthly service, amount, and start date.</label></>}
     <button className="sq-primary" disabled={!sourceId||!customer?.email||requested<=0}>{busy?'Working…':mode==='invoice'?'Save invoice draft':'Start monthly billing'}</button>
    </form></fieldset>
    {!data.writable&&<p className="sq-help">Your role can view billing. Ask an authorized billing team member to make changes.</p>}
   </section>
   <section className="sq-card"><h2>Payment history</h2><p className="sq-help">{accountingNote}</p><p className="sq-help">Showing the latest 200 billing arrangements and 1,000 invoice updates.</p>
    {!data.records.length&&<div className="sq-empty"><h3>No Square billing yet</h3><p>Your invoices and monthly services will appear here with their payment status.</p></div>}
    {data.records.map(r=>{const invoices=data.invoices.filter(i=>i.record_id===r.id);return <article className="sq-record" key={r.id}><div className="sq-section-heading"><div><h3>{r.request.source.title}</h3><p>{r.request.customer.name} · {r.mode==='monthly'?'Monthly service':'Project invoice'}</p></div><span className="sq-badge">{label(r.status)}</span></div><p><strong>{money(r.request.source.amountCents)}{r.mode==='monthly'?' / month':''}</strong>{r.mode==='monthly'?' · starts '+r.request.startDate:''}</p>{r.canceled_date&&<p>Cancellation effective: {r.canceled_date}</p>}{r.charged_through_date&&<p>Charged through: {r.charged_through_date}</p>}
     {r.mode==='invoice'&&<p className="sq-help">Deposit {money(r.request.schedule.depositCents)} on {r.request.schedule.depositDate}; final balance on {r.request.schedule.balanceDate}.</p>}
     {r.last_error&&<p className="sq-error" role="alert">{r.last_error}</p>}
     {invoices.map(i=><div className="sq-invoice" key={i.invoice_id}><div><strong>{label(i.status)}</strong><span>Collected {money(i.paid_cents)} · Remaining {money(i.due_cents)}{i.due_date?' · Due '+i.due_date:''}</span>{i.status.includes('REFUND')&&<span>Refund recorded. Review net proceeds and any remaining collection in Square.</span>}</div>{i.public_url&&i.status!=='DRAFT'&&<a target="_blank" rel="noopener noreferrer" href={i.public_url}>Open payment page ↗</a>}</div>)}
     <div className="sq-actions">{data.writable&&<><button disabled={busy||!data.ready} onClick={()=>void run({action:r.square_invoice_id||r.square_subscription_id?'refresh':'retry',id:r.id})}>{r.square_invoice_id||r.square_subscription_id?'Refresh status':'Retry setup'}</button>{r.status==='DRAFT'&&<button className="sq-primary" disabled={busy} onClick={()=>setConfirmAction({action:'publish',record:r})}>Review & send</button>}{!['PREPARING','DRAFT','CANCELED','PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(r.status)&&!r.canceled_date&&<button disabled={busy} onClick={()=>setConfirmAction({action:'cancel',record:r})}>{r.mode==='monthly'?'Cancel renewal':'Cancel unpaid invoice'}</button>}</>}</div>
    </article>;})}
   </section>
  </div>}
  {confirmAction&&<BillingDialog onClose={()=>setConfirmAction(null)}><section className="sq-card"><h2 id="sq-confirm-title">{confirmAction.action==='publish'?'Send this invoice?':'Confirm cancellation'}</h2><p>{confirmAction.record.request.source.title} · {confirmAction.record.request.customer.name}</p><p>{confirmAction.action==='publish'?'Square will email the customer a payment link for '+money(confirmAction.record.request.source.amountCents)+'.':confirmAction.record.mode==='monthly'?'Square will stop renewals at the end of the current billing period. Existing unpaid invoices remain due.':'Square will cancel the unpaid remainder. This does not refund any collected payments.'}</p><div className="sq-actions"><button autoFocus disabled={busy} onClick={()=>setConfirmAction(null)}>Go back</button><button className="sq-primary" disabled={busy} onClick={()=>void run({action:confirmAction.action,id:confirmAction.record.id})}>{busy?'Working…':'Confirm'}</button></div></section></BillingDialog>}
 </main>;
}
