import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkDuration,formatWorkDuration,durationLabel} from '../apps/web/lib/work-duration.ts';
test('hours.minutes accepts either separator, including the requested shorthand',()=>{
 for(const [value,expected] of [['0.3',30],['0,3',30],['0.30',30],['0,30',30],['1.30',90],['1,30',90],['0,05',5],['0.01',1],['12',720],['280.01',16801],['360',21600],[' 2,45 ',165]])assert.equal(parseWorkDuration(value),expected,value);
});
test('rejects invalid minute portions, malformed values and more than 360h',()=>{
 for(const value of ['','0','0.00','0,60','1.75','360,01','361','-1','1e2','1.234','1,2.3','abc'])assert.equal(parseWorkDuration(value),null,value);
});
test('editing preserves stored integer minutes, including values that were formerly decimal hours',()=>{
 for(const value of [1,3,5,18,30,45,60,63,90,105,720,21599,21600])assert.equal(parseWorkDuration(formatWorkDuration(value)),value);
 assert.equal(formatWorkDuration(18),'0,18');assert.equal(durationLabel(30),'30 min');assert.equal(durationLabel(90),'1h30');
});
