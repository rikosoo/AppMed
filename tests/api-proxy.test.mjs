import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const helper=ts.transpileModule(readFileSync('apps/web/lib/proxy-security.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const helperUrl=`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`;
const source = ts.transpileModule(readFileSync('apps/web/app/api/optimizer/route.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("@/lib/proxy-security",helperUrl);
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function request(body='{}'){return new Request('http://localhost/api/optimizer',{method:'POST',headers:{'Content-Type':'application/json'},body});}
function mockFetch(t, handler){const original=globalThis.fetch;globalThis.fetch=handler;t.after(()=>{globalThis.fetch=original;});}
test('non-JSON upstream server errors become actionable JSON',async t=>{
 mockFetch(t,async()=>new Response('Internal Server Error',{status:500}));
 const response=await POST(request());
 assert.equal(response.status,502);
 const data=await response.json();assert.match(data.detail,/terminal da API/);assert.doesNotMatch(data.detail,/Unexpected token|Internal Server Error/);
});
test('offline calculation API returns 503 and startup guidance',async t=>{
 mockFetch(t,async()=>{throw new TypeError('fetch failed');});
 const response=await POST(request());assert.equal(response.status,503);assert.match((await response.json()).detail,/npm run dev/);
});
test('validation messages survive the proxy',async t=>{
 mockFetch(t,async()=>Response.json({detail:'Reduza os limites de atividades adicionais.'},{status:422}));
 const response=await POST(request());assert.equal(response.status,422);assert.match((await response.json()).detail,/Reduza os limites/);
});
test('successful scenarios are forwarded and incomplete responses rejected',async t=>{
 const payload={status:'feasible',scenarios:[{counts:[88,0],extra_cents:4400000,minutes:5280}]};
 mockFetch(t,async()=>Response.json(payload));
 assert.deepEqual(await (await POST(request())).json(),payload);
 globalThis.fetch=async()=>Response.json({status:'ok'});
 assert.equal((await POST(request())).status,502);
});
test('malformed client JSON is rejected before calling the API',async t=>{
 mockFetch(t,async()=>{assert.fail('Should not call upstream');});
 assert.equal((await POST(request('invalid'))).status,400);
});
