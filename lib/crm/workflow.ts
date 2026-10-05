import type { Activity, Deal, Stage } from './types.ts';
export type Attention = 'all'|'overdue'|'missing'|'stalled'|'high';
export function daysInStage(deal:Deal, now:number) { return Math.max(0,Math.floor((now-Date.parse(deal.stage_entered_at))/86400000)); }
export function isStalled(deal:Deal,stage:Stage|undefined,now:number) { return deal.status==='open'&&daysInStage(deal,now)>=(stage?.stale_days||7); }
export function stepKey(stage:Stage,step:string) { return `${stage.id}:${step}`; }
export function qualificationScore(deal:Deal) {return [deal.need,deal.budget,deal.decision_maker,deal.buying_timeline].filter(v=>v?.trim()).length;}
export function attentionMatches(deal:Deal,filter:Attention,activities:Activity[],stages:Stage[],now:number) {
 if(filter==='all')return true;if(deal.status!=='open')return false;
 const pending=activities.filter(a=>a.deal_id===deal.id&&!a.completed_at);
 return filter==='high'?deal.priority==='high':filter==='missing'?pending.length===0:filter==='overdue'?pending.some(a=>Date.parse(a.due_at)<now):isStalled(deal,stages.find(s=>s.id===deal.stage_id),now);
}
export function dateKey(value:string|number,timezone:string) {return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
