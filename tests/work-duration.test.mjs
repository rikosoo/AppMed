import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseWorkDuration,formatWorkDuration,durationLabel} from '../apps/web/lib/work-duration.ts';
test('decimal hours accepts dot or comma and converts to minutes',()=>{
 for(const [value,expected] of [['1.5',90],['1,5',90],['0.5',30],['0,5',30],['.5',30],[',5',30],['0.3',18],['0,30',18],['1.30',78],['0,75',45],['1.25',75],['0,05',3],['0.01',1],['12',720],['360',21600],[' 2,45 ',147]])assert.equal(parseWorkDuration(value),expected,value);
});
test('rejects malformed, sub-minute and above-limit entries before rounding',()=>{
 for(const value of ['','0','0.00','0.001','360,01','360.000001','361','-1','1e2','1,2.3','abc'])assert.equal(parseWorkDuration(value),null,value);
});
test('editing every valid stored minute duration preserves its original time',()=>{
 for(let minutes=1;minutes<=21600;minutes++)assert.equal(parseWorkDuration(formatWorkDuration(minutes)),minutes);
 assert.equal(formatWorkDuration(18),'0,3');assert.equal(formatWorkDuration(90),'1,5');assert.equal(durationLabel(30),'30 min');assert.equal(durationLabel(90),'1h30');
});

test('minutes mode accepts whole minutes and enforces the same 360h ceiling',()=>{
 for(const value of [1,30,45,90,21600]){assert.equal(parseWorkDuration(String(value),'minutes'),value);assert.equal(formatWorkDuration(value,'minutes'),String(value));}
 for(const value of ['0','-1','21601','1.5','1,5','abc'])assert.equal(parseWorkDuration(value,'minutes'),null,value);
});
