import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionMatches, daysInStage, isStalled, dateKey, qualificationScore } from '../lib/crm/workflow.ts';
test('CRM attention distinguishes missing, overdue, stalled, and closed opportunities',()=>{
 const now=Date.parse('2026-10-05T20:00:00Z'),d={id:'d',status:'open',stage_id:'s',stage_entered_at:'2026-09-28T20:00:00Z',priority:'high'},s={id:'s',stale_days:7};
 assert.equal(daysInStage(d,now),7);assert.equal(isStalled(d,s,now),true);
 assert.equal(attentionMatches(d,'missing',[],[s],now),true);
 assert.equal(attentionMatches(d,'overdue',[{deal_id:'d',completed_at:null,due_at:'2026-10-05T19:00:00Z'}],[s],now),true);
 assert.equal(attentionMatches({...d,status:'won'},'stalled',[],[s],now),false);
 assert.equal(attentionMatches(d,'missing',[{deal_id:'d',completed_at:null,due_at:'2026-10-08T20:00:00Z'}],[s],now),false);
});
test('CRM calendar/report dates use workspace time and qualification ignores blank answers',()=>{
 assert.equal(dateKey('2026-10-06T01:00:00Z','America/Denver'),'2026-10-05');
 assert.equal(qualificationScore({need:'A need',budget:'  ',decision_maker:'Owner',buying_timeline:''}),2);
});
