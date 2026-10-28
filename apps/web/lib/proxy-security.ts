import {isIP} from 'node:net';
import {timingSafeEqual} from 'node:crypto';
export class ProxyAccessError extends Error {constructor(public status:number,message:string){super(message);}}
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
 const trusted=process.env.TRUST_PROXY_CLIENT_IP==='true';
 const token=process.env.INTERNAL_PROXY_TOKEN||'';
 const url=new URL(request.url);
 if(trusted){
  if(!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw new ProxyAccessError(503,'A comunicação interna do servidor ainda não foi configurada.');
  if(!(request.method==='GET'&&url.pathname==='/api/health')){
   const supplied=Buffer.from(request.headers.get('x-financemed-proxy-token')||'');const expected=Buffer.from(token);
   if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new ProxyAccessError(403,'Acesse o aplicativo pelo endereço HTTPS configurado.');
  }
  const ip=(request.headers.get('x-financemed-client-ip')||'').trim();if(isIP(ip))headers['x-financemed-client-ip']=ip;
 }
 // A direct client cannot assert HTTPS by sending a forwarded header.
 headers['x-forwarded-proto']=trusted?(request.headers.get('x-forwarded-proto')||'http'):url.protocol.replace(':','');
 if(token)headers['x-financemed-proxy-token']=token;
 return headers;
}
