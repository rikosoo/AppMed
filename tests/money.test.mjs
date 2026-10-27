import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney} from '../apps/web/lib/money.ts';
test('money separates Brazilian thousands and cents without floating point rounding',()=>{
 for(const [text,amount] of [['15.000',1500000],['15.000,50',1500050],['1.234.567,89',123456789],['15000',1500000],['15,50',1550],['15.50',1550],['0,01',1],['R$ 1.000',100000]])assert.equal(parseMoney(text),amount,text);
 for(const text of ['','abc','1e3','-10','15.1234','1,000.50','1.23.456','1,2,3'])assert.equal(parseMoney(text),null,text);
});
