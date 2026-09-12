import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesOrderKind, partnerLabel, withCurrentOption } from '../lib/field-options.ts';
import { closeoutChecks } from '../lib/field.ts';

test('purchase types require the matching partner category', () => {
  for (const [order, expected] of [['materials','vendor'],['subcontract','subcontractor'],['internal','crew']]) {
    for (const kind of ['vendor','subcontractor','crew']) assert.equal(matchesOrderKind(order,kind),kind===expected);
  }
  assert.equal(partnerLabel({name:"Neil's Crew",kind:'crew'}),"Neil's Crew (Internal Crew)");
});
test('standard dropdowns preserve existing custom values without duplicates', () => {
  assert.deepEqual(withCurrentOption(['Google','Referral'],'Trade show'),['Google','Referral','Trade show']);
  assert.deepEqual(withCurrentOption(['Google','Referral'],'Google'),['Google','Referral']);
  assert.deepEqual(withCurrentOption(['Google'],''),['Google']);
});
const fixture=()=>({workspace:{id:'w'},contacts:[],profiles:[{work_order_id:'job',walkthrough_complete:true,costs_reviewed:true}],tasks:[{work_order_id:'job',completed:true},{work_order_id:'other',completed:false}],purchases:[{work_order_id:'job',status:'received'},{work_order_id:'other',status:'planned'}],estimates:[{work_order_id:'job',status:'approved',price_cents:10000,tax_cents:0}],financials:[{work_order_id:'job',kind:'receipt',amount_cents:10000,voided:false}]});
const order={id:'job',stage:'invoice_ready'};
test('closeout requires saved delivery, cost review, completed assignments and exact settlement', () => {
  assert.ok(closeoutChecks(fixture(),order).every(x=>x.done));
  const mutations=[d=>{d.profiles[0].walkthrough_complete=false;},d=>{d.profiles[0].costs_reviewed=false;},d=>{d.tasks[0].completed=false;},d=>{d.purchases[0].status='ordered';},d=>{d.financials[0].amount_cents=9999;},d=>{d.financials[0].amount_cents=10001;},d=>{d.financials[0].voided=true;},d=>{d.estimates=[];}];
  for(const mutate of mutations){const d=fixture();mutate(d);assert.ok(closeoutChecks(d,order).some(x=>!x.done));}
  assert.ok(closeoutChecks(fixture(),{...order,stage:'completed'}).some(x=>!x.done));
});
