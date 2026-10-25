import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pythonPath, pythonCandidates, nextEntrypoint, apiMatches } from '../scripts/dev-support.mjs';
test('Windows uses Scripts/python.exe and tries the official py launcher first',()=>{
 assert.equal(pythonPath('/project','win32'),path.join('/project','.venv','Scripts/python.exe'));
 assert.deepEqual(pythonCandidates('win32'),[['py','-3'],['python'],['python3']]);
});
test('Unix uses the venv interpreter and python3',()=>{
 assert.equal(pythonPath('/project','linux'),path.join('/project','.venv','bin/python'));
 assert.deepEqual(pythonCandidates('linux')[0],['python3']);
});
test('Next resolves from the web workspace, independent of dependency hoisting',()=>{
 assert.match(nextEntrypoint(process.cwd()),/next[/\\]dist[/\\]bin[/\\]next$/);
});
test('only the expected FinanceMed API version can be reused',()=>{
 assert.equal(apiMatches({status:'ok',engine:'1.1.0'},'1.1.0'),true);
 assert.equal(apiMatches({status:'ok',engine:'1.0.0'},'1.1.0'),false);
 assert.equal(apiMatches({status:'error',engine:'1.1.0'},'1.1.0'),false);
 assert.equal(apiMatches(null,'1.1.0'),false);
});
