import test from 'node:test';
import assert from 'node:assert/strict';
import { responseAnswers } from '../lib/hq-form-responses.ts';
test('form display supports original provider questions, legacy keys and multiselect values',()=>{
 const rows=responseAnswers({answers:{interest:'a_custom_crm','what_is_your_role?':'owner',services:['CRM','Automation'],count:0,approved:false,empty:''}});
 assert.deepEqual(rows,[{question:'What would you like to explore?',answer:'A custom CRM'},{question:'What is your role?',answer:'Owner'},{question:'Services',answer:'CRM, Automation'},{question:'Count',answer:'0'},{question:'Approved',answer:'No'}]);
});
test('legacy website answers remain visible without displaying attribution as questions',()=>{
 assert.deepEqual(responseAnswers({'Business Type':'Plumbing','Main Challenge':'Scheduling','UTM Campaign':'Private'},true),[{question:'Business Type',answer:'Plumbing'},{question:'Main Challenge',answer:'Scheduling'}]);
 assert.deepEqual(responseAnswers({answers:{}}),[]);
});
