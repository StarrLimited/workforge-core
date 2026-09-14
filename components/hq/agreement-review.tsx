'use client';
import {useEffect,useState} from 'react';
import type {Proposal} from '@/lib/hq-sales';
import type {AgreementSignature} from '@/lib/hq-estimating';
import AgreementDocument from './agreement-document';
import SignaturePad from './signature-pad';
import PrintButton from './print-button';
type Review={proposal:Proposal;signatures:AgreementSignature[];recipient_email:string;expires_at:string};
export default function AgreementReview(){
 const [review,setReview]=useState<Review|null>(null);const [token,setToken]=useState('');const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);
 async function load(value:string){const r=await fetch('/api/agreements/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'review',token:value})});const data=await r.json();if(!r.ok)throw new Error(data.error);setReview(data);}
 useEffect(()=>{const value=window.location.hash.slice(1);setToken(value);if(!/^[a-f0-9]{64}$/.test(value)){setError('This link is incomplete. Please use the full signing link from WorkForge.');setLoading(false);return;}load(value).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
 return <main className="agreement-page"><div className="agreement-toolbar"><strong>WorkForge · Client agreement</strong>{review&&<PrintButton/>}</div>{loading&&<p role="status">Loading your agreement…</p>}{error&&<p className="error" role="alert">{error}</p>}{review&&<><AgreementDocument proposal={review.proposal} signatures={review.signatures}/><section className="agreement-sign-panel">{done||review.proposal.status==='accepted'?<div role="status"><h2>Agreement signed</h2><p>Both signatures are saved with this revision. WorkForge has received your acceptance and your project is ready for kickoff. Use Print / Save PDF to keep a copy.</p></div>:<SignaturePad party="Client" email={review.recipient_email} busy={busy} onSign={async s=>{if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/agreements/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sign',token,signature:s})});const d=await r.json();if(!r.ok)throw new Error(d.error);setDone(true);await load(token);}catch(e){setError(e instanceof Error?e.message:'Unable to save. Please try again.');}finally{setBusy(false);}}}/>}</section></>}</main>;
}
