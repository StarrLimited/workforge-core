'use client';
import {useRef,useState} from 'react';
import {SIGNING_CONSENT} from '@/lib/hq-estimating';
export default function SignaturePad({email='',party,onSign,busy=false}:{email?:string;party:string;onSign:(v:{name:string;title:string;email:string;signature_image:string;consent:true})=>Promise<void>;busy?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);const drawing=useRef(false);const [ink,setInk]=useState(false);
 const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect();return {x:(e.clientX-r.left)*800/r.width,y:(e.clientY-r.top)*200/r.height};};
 function start(e:React.PointerEvent<HTMLCanvasElement>){if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);drawing.current=true;const c=e.currentTarget.getContext('2d')!;const p=point(e);c.beginPath();c.moveTo(p.x,p.y);c.lineWidth=3;c.lineCap='round';c.strokeStyle='#17212b';}
 function move(e:React.PointerEvent<HTMLCanvasElement>){if(!drawing.current)return;const c=e.currentTarget.getContext('2d')!;const p=point(e);c.lineTo(p.x,p.y);c.stroke();setInk(true);}
 return <form className="hq-form signature-form" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await onSign({name:String(f.get('name')),title:String(f.get('title')),email:String(f.get('email')),signature_image:ink?canvas.current!.toDataURL('image/png'):'',consent:true});}}><fieldset disabled={busy}>
 <h3>{party} signature</h3><div className="hq-form-grid"><label>Full legal name<input name="name" required minLength={2} maxLength={200} autoComplete="name"/></label><label>Title / role<input name="title" required maxLength={200}/></label></div><label>Email<input name="email" type="email" defaultValue={email} required maxLength={254}/></label>
 <p>Your typed name is your electronic signature. You can also draw your signature below.</p><canvas ref={canvas} width={800} height={200} className="signature-canvas" aria-label="Draw your signature (optional)" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drawing.current=false;}} onPointerCancel={()=>{drawing.current=false;}}/>
 <button type="button" className="secondary" onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,800,200);setInk(false);}}>Clear drawing</button>
 <label className="sales-checkbox"><input type="checkbox" required/>{SIGNING_CONSENT}</label><button className="primary" disabled={busy}>{busy?'Saving signature…':'Sign this agreement'}</button>
 </fieldset></form>;
}
