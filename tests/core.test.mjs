import test from 'node:test';
import assert from 'node:assert/strict';
import { priceForMargin, moneyToCents, nextStage, canWrite } from '../lib/core.ts';
test('40 percent margin on $900 cost produces $1500 price',()=>assert.equal(priceForMargin(90000,40),150000));
test('fractional-cent prices round upward so target margin is preserved',()=>assert.equal(priceForMargin(10000,35),15385));
test('invalid costs and impossible margins are rejected',()=>{for(const pair of [[-1,40],[1.5,40],[500,100],[500,NaN],[Infinity,40]])assert.throws(()=>priceForMargin(...pair));});
test('currency input is converted in decimal cents without floating point drift',()=>{assert.equal(moneyToCents('19.99'),1999);assert.equal(moneyToCents('0.29'),29);assert.throws(()=>moneyToCents('1e5'));assert.throws(()=>moneyToCents('10.001'));});
test('completed work moves to invoice preparation and workflow then ends',()=>{assert.equal(nextStage('completed'),'invoice_ready');assert.equal(nextStage('invoice_ready'),null);});
test('read-only role cannot write',()=>assert.equal(canWrite('read_only'),false));
