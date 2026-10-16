import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hqAppointments} from '../lib/portfolio-appointments.ts';
const identity={email:'shawn@starrlimited.com',fullName:'Shawn Starr'};
const event={id:'HQ-1',title:'Discovery call',owner:'Shawn',starts_at:'2026-10-20T16:00:00Z',ends_at:'2026-10-20T17:00:00Z',notes:''};
test('HQ event follows its fixed owner alias and retains identity after rescheduling',()=>{
 assert.equal(hqAppointments([event],identity).length,1);
 const updated=hqAppointments([{...event,starts_at:'2026-10-21T16:00:00Z'}],identity)[0];
 assert.equal(updated.id,event.id);assert.equal(updated.start,'2026-10-21T16:00:00Z');
 assert.equal(hqAppointments([{...event,owner:'Neil'}],identity).length,0);
 assert.equal(hqAppointments([],identity).length,0);
 assert.equal(hqAppointments([event],{email:'another@example.com',fullName:'Shawn Jones'}).length,0);
});
