import { Capacitor, CapacitorHttp } from '@capacitor/core';
declare const __FINANCEMED_API_ORIGIN__:string;
// Defined only by the bundled mobile build. Web requests remain on their own origin.
export const mobileApiOrigin=()=>typeof __FINANCEMED_API_ORIGIN__==='string'?__FINANCEMED_API_ORIGIN__:null;
export async function apiFetch(path:string,options:RequestInit={}):Promise<Response>{
 const origin=mobileApiOrigin();
 if(!origin)return fetch(path,options);
 if(!Capacitor.isNativePlatform())throw Error('Abra esta versão no aplicativo Android ou iOS.');
 if(!path.startsWith('/api/')||path.includes('..')||path.includes('\\'))throw Error('Endereço da API inválido.');
 const headers=Object.fromEntries(new Headers(options.headers).entries());
 headers['Origin']=origin;
 if(options.signal?.aborted)throw new DOMException('Operação cancelada.','AbortError');
 let data:unknown=options.body;
 if(typeof data==='string'&&new Headers(options.headers).get('content-type')?.includes('application/json'))data=JSON.parse(data);
 // Native HTTP maintains the server session cookie outside browser storage. Never save tokens in JS.
 const result=await CapacitorHttp.request({url:origin+path,method:options.method||'GET',headers,data,connectTimeout:15000,readTimeout:25000,responseType:'text',disableRedirects:true});
 if(options.signal?.aborted)throw new DOMException('Operação cancelada.','AbortError');
 return new Response(result.status===204?null:typeof result.data==='string'?result.data:JSON.stringify(result.data),{status:result.status,headers:result.headers});
}
