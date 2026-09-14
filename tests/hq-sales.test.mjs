import test from 'node:test';
import assert from 'node:assert/strict';
import {decimalUnits,lineAmount,estimateTotals,proposalSchema,latestRun,betaReadiness} from '../lib/hq-sales.ts';
test('HQ estimates round decimal quantities to cents and keep billing cadences separate',()=>{
 const line={description:'Setup',service:'implementation',cadence:'one_time',quantity_units:decimalUnits('1.25'),unit_cents:decimalUnits('99.99'),discount_cents:decimalUnits('5.00')};
 assert.equal(lineAmount(line),11999);
 assert.deepEqual(estimateTotals([line,{...line,cadence:'monthly',quantity_units:100,unit_cents:29900,discount_cents:0},{...line,cadence:'annual',quantity_units:100,unit_cents:120000,discount_cents:0},{...line,cadence:'usage',quantity_units:100,unit_cents:200,discount_cents:0}]),{one_time:11999,monthly:29900,annual:120000});
 assert.throws(()=>decimalUnits('1.234'));assert.throws(()=>decimalUnits('-1'));
});
test('A deposit cannot exceed project fees plus stated tax; discounts cannot erase a line',()=>{
 const p={opportunity_id:'10000000-0000-4000-8000-000000000001',title:'Build',valid_until:'2026-10-01',document:{},lines:[{description:'Build',service:'implementation',cadence:'one_time',quantity_units:100,unit_cents:100000,discount_cents:0}],deposit_cents:101000,tax_cents:1000,terms_reviewed:false};
 assert.equal(proposalSchema.safeParse(p).success,true);
 assert.equal(proposalSchema.safeParse({...p,deposit_cents:101001}).success,false);
 assert.equal(proposalSchema.safeParse({...p,lines:[{...p.lines[0],discount_cents:100000}]}).success,false);
});
test('Beta readiness uses the latest run of the exact release and keeps critical defects blocking',()=>{
 const runs=[{id:'1',test_id:'test',release:'v1',result:'passed',created_at:'2026-09-14T00:00:00Z'},{id:'2',test_id:'test',release:'v2',result:'passed',created_at:'2026-09-14T01:00:00Z'},{id:'3',test_id:'test',release:'v2',result:'failed',created_at:'2026-09-14T02:00:00Z'}];
 assert.equal(latestRun(runs,'test','v2').result,'failed');
 assert.deepEqual(betaReadiness({id:'project',release:'v2'},[{id:'test',implementation_id:'project',mandatory:true}],runs,[{implementation_id:'project',severity:'high',status:'open'},{implementation_id:'project',severity:'low',status:'accepted'}]),{total:1,passed:0,blockers:1});
});
