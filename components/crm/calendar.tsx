'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Activity } from '@/lib/crm/types';
import { dateKey } from '@/lib/crm/workflow';
export function ActivityCalendar({activities,timezone,loadedAt,onOpen,onNew}:{activities:Activity[];timezone:string;loadedAt:string;onOpen:(a:Activity)=>void;onNew?:(()=>void)}) {
 const [offset,setOffset]=useState(0),today=dateKey(loadedAt,timezone),anchor=new Date(today+'T12:00:00Z');
 anchor.setUTCDate(anchor.getUTCDate()-((anchor.getUTCDay()+6)%7)+offset*7);
 const days=Array.from({length:7},(_,i)=>{const date=new Date(anchor);date.setUTCDate(date.getUTCDate()+i);return date.toISOString().slice(0,10);});
 const title=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 return <section className="crm-panel crm-calendar"><header><div><h2>{title(days[0])} – {title(days[6])}</h2><p>{timezone} · All scheduled activities, including completed</p></div><div className="crm-actions"><button className="crm-btn" aria-label="Previous week" onClick={()=>setOffset(offset-1)}><ChevronLeft size={17}/></button><button className="crm-btn" onClick={()=>setOffset(0)}>This week</button><button className="crm-btn" aria-label="Next week" onClick={()=>setOffset(offset+1)}><ChevronRight size={17}/></button>{onNew&&<button className="crm-btn" onClick={onNew}><Plus size={16}/>Activity</button>}</div></header><div className="crm-week-grid">{days.map(day=><section key={day} className={day===today?'is-today':''}><h3>{new Intl.DateTimeFormat('en-US',{weekday:'short',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'))}</h3>{activities.filter(a=>dateKey(a.due_at,timezone)===day).sort((a,b)=>a.due_at.localeCompare(b.due_at)).map(a=><button key={a.id} className={a.completed_at?'is-complete':''} onClick={()=>onOpen(a)}><small>{new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:timezone}).format(new Date(a.due_at))} · {a.kind}</small><strong>{a.title}</strong>{a.completed_at&&<small>Completed</small>}</button>)}{!activities.some(a=>dateKey(a.due_at,timezone)===day)&&<small className="crm-calendar-empty">No activities</small>}</section>)}</div></section>;
}
