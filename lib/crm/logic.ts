import type { Activity, Deal, Stage } from './types.ts';
export const SOURCES = ['Manual','Meta','Google Ads','Google organic','Referral','Website','Outbound','Event','Other'];
export function followupState(deal:Deal,activities:Activity[],now:number) {
 const next=activities.filter(a=>a.deal_id===deal.id&&!a.completed_at).sort((a,b)=>a.due_at.localeCompare(b.due_at))[0];
 return {next,state:deal.status!=='open'?'closed':!next?'missing':new Date(next.due_at).getTime()<now?'overdue':'scheduled'};
}
export function summarize(deals:Deal[],stages:Stage[]) {
 const open=deals.filter(x=>x.status==='open'),won=deals.filter(x=>x.status==='won'),lost=deals.filter(x=>x.status==='lost');
 return {open:open.length,value:open.reduce((sum,d)=>sum+Number(d.value_cents),0),weighted:Math.round(open.reduce((sum,d)=>sum+Number(d.value_cents)*(stages.find(s=>s.id===d.stage_id)?.probability??0)/100,0)),won:won.reduce((sum,d)=>sum+Number(d.value_cents),0),winRate:won.length+lost.length?Math.round(won.length/(won.length+lost.length)*100):null};
}
export function csvCell(value:unknown) {
 const raw=Array.isArray(value)?value.join('; '):String(value??'');
 const safe=/^[\s]*[=+\-@]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function parseCSV(text:string):Record<string,string>[] {
 if(text.length>500000)throw new Error('Use a CSV smaller than 500 KB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw new Error('Invalid CSV quoting.');}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('A quoted CSV field was not closed.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const header=rows.shift()?.map(x=>x.trim().toLowerCase());if(!header?.includes('name'))throw new Error('CSV needs a name column. Optional columns: email, phone, source, job_title, tags.');
 if(new Set(header).size!==header.length)throw new Error('CSV headers must be unique.');
 if(rows.length>500)throw new Error('Import up to 500 contacts at a time.');
 return rows.map((r,i)=>{if(r.length!==header.length)throw new Error(`Check the number of columns on row ${i+2}.`);return Object.fromEntries(header.map((h,j)=>[h,r[j].trim()]));});
}
export function calendarFile(activity:Activity) {
 const escape=(s:string)=>s.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\r','');
 const date=(s:Date)=>s.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 const start=new Date(activity.due_at),end=new Date(start.getTime()+activity.duration_minutes*60000);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//WorkForge//CRM//EN','BEGIN:VEVENT',`UID:${activity.id}@workforge`, `DTSTAMP:${date(new Date())}`,`DTSTART:${date(start)}`,`DTEND:${date(end)}`,`SUMMARY:${escape(activity.title)}`,`DESCRIPTION:${escape(activity.outcome)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
