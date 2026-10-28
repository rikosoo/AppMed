import {isIP} from 'node:net';
export class BodyLimitError extends Error {}
export async function limitedBody(request:Request,limit:number):Promise<string>{
 const declared=Number(request.headers.get('content-length'));
 if(Number.isFinite(declared)&&declared>limit)throw new BodyLimitError();
 const reader=request.body?.getReader();if(!reader)return '';
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new BodyLimitError();}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return new TextDecoder().decode(bytes);
}
export function upstreamHeaders(request:Request):Record<string,string>{
 const headers:Record<string,string>={'Content-Type':'application/json'};
 for(const name of ['cookie','origin','sec-fetch-site','x-financemed-account']){const value=request.headers.get(name);if(value)headers[name]=value;}
 headers['x-forwarded-proto']=request.headers.get('x-forwarded-proto')||new URL(request.url).protocol.replace(':','');
 // Enabled only on the private production network. Caddy overwrites this
 // header with the TCP peer address; neither web nor API ports may be public.
 if(process.env.TRUST_PROXY_CLIENT_IP==='true'){
  const ip=(request.headers.get('x-financemed-client-ip')||'').trim();
  if(isIP(ip))headers['x-financemed-client-ip']=ip;
 }
 return headers;
}
