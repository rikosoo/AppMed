import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const helperUrl=url(compile('apps/web/lib/proxy-security.ts'));
const {limitedBody,BodyLimitError,upstreamHeaders}=await import(helperUrl);
const {POST}=await import(url(compile('apps/web/app/api/optimizer/route.ts').replace('@/lib/proxy-security',helperUrl)));
const {proxyApi}=await import(url(compile('apps/web/lib/api-proxy.ts').replace('@/lib/proxy-security',helperUrl)));
function fetchMock(t,callback){const previous=globalThis.fetch;globalThis.fetch=callback;t.after(()=>globalThis.fetch=previous);}
const TOKEN='test-proxy-token-'+ 'A'.repeat(48);
function env(t,value){const oldToken=process.env.INTERNAL_PROXY_TOKEN;if(value==='true')process.env.INTERNAL_PROXY_TOKEN=TOKEN;else delete process.env.INTERNAL_PROXY_TOKEN;t.after(()=>oldToken===undefined?delete process.env.INTERNAL_PROXY_TOKEN:process.env.INTERNAL_PROXY_TOKEN=oldToken);const old=process.env.TRUST_PROXY_CLIENT_IP;if(value===undefined)delete process.env.TRUST_PROXY_CLIENT_IP;else process.env.TRUST_PROXY_CLIENT_IP=value;t.after(()=>old===undefined?delete process.env.TRUST_PROXY_CLIENT_IP:process.env.TRUST_PROXY_CLIENT_IP=old);}
test('chunked bodies are bounded before parsing, without relying on Content-Length',async()=>{
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(40000));controller.enqueue(new Uint8Array(40000));controller.close();}});
 await assert.rejects(limitedBody(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'}),64000),BodyLimitError);
 assert.equal(await limitedBody(new Request('http://localhost',{method:'POST',body:'{}'}),64000),'{}');
});
test('oversized optimizer and authentication payloads never reach upstream',async t=>{
 let calls=0;fetchMock(t,async()=>{calls++;return Response.json({});});
 const oversized=new Request('http://localhost/api/optimizer',{method:'POST',body:'x'.repeat(64001)});
 assert.equal((await POST(oversized)).status,413);
 const auth=new Request('http://localhost/api/auth/login',{method:'POST',body:'x'.repeat(10001)});
 assert.equal((await proxyApi(auth,'/api/auth/login')).status,413);assert.equal(calls,0);
});
test('proxy forwards browser origin metadata and ignores client IP headers unless explicitly trusted',t=>{
 env(t,undefined);const headers=upstreamHeaders(new Request('http://localhost',{headers:{origin:'https://evil.example','sec-fetch-site':'cross-site','x-financemed-client-ip':'192.0.2.1','x-forwarded-for':'203.0.113.1'}}));
 assert.equal(headers.origin,'https://evil.example');assert.equal(headers['sec-fetch-site'],'cross-site');assert.equal(headers['x-financemed-client-ip'],undefined);
});
test('private proxy uses only the IP header overwritten by Caddy and validates it',t=>{
 env(t,'true');const headers=upstreamHeaders(new Request('https://app.example',{headers:{'x-financemed-proxy-token':TOKEN,'x-financemed-client-ip':'192.0.2.1','x-forwarded-for':'203.0.113.7'}}));assert.equal(headers['x-financemed-client-ip'],'192.0.2.1');assert.equal(headers['x-forwarded-for'],undefined);
 assert.equal(upstreamHeaders(new Request('https://app.example',{headers:{'x-financemed-proxy-token':TOKEN,'x-financemed-client-ip':'not-an-ip'}}))['x-financemed-client-ip'],undefined);
 assert.match(readFileSync('deploy/Caddyfile','utf8'),/header_up X-FinanceMed-Client-IP \{remote_host\}/);
});
test('optimizer preserves Retry-After and marks private responses no-store',async t=>{
 fetchMock(t,async()=>Response.json({detail:'Muitas solicitações.'},{status:429,headers:{'Retry-After':'30'}}));
 const response=await POST(new Request('http://localhost/api/optimizer',{method:'POST',body:'{}'}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'30');assert.equal(response.headers.get('cache-control'),'no-store');
});

test('direct requests cannot forge HTTPS or impersonate the private proxy',t=>{
 env(t,undefined);
 assert.equal(upstreamHeaders(new Request('http://localhost/api/auth/me',{headers:{'x-forwarded-proto':'https'}}))['x-forwarded-proto'],'http');
 process.env.TRUST_PROXY_CLIENT_IP='true';process.env.INTERNAL_PROXY_TOKEN=TOKEN;
 assert.throws(()=>upstreamHeaders(new Request('https://app.example/api/auth/me',{headers:{'x-forwarded-proto':'https'}})),error=>error.status===403);
 assert.throws(()=>upstreamHeaders(new Request('https://app.example/api/auth/me',{headers:{'x-financemed-proxy-token':'wrong'}})),error=>error.status===403);
 assert.equal(upstreamHeaders(new Request('http://localhost/api/health'))['x-financemed-proxy-token'],TOKEN);
 process.env.INTERNAL_PROXY_TOKEN='';assert.throws(()=>upstreamHeaders(new Request('http://localhost/api/health')),error=>error.status===503);
});
