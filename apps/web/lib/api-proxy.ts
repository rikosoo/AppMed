export async function proxyApi(request:Request,path:string,method=request.method) {
 const limit=path.startsWith('/api/auth/')?10000:2_000_000;
 let body:string|undefined;
 if(!['GET','HEAD'].includes(method)){
  const chunks:Uint8Array[]=[];let size=0;
  const reader=request.body?.getReader();
  if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();return Response.json({detail:'Os dados enviados excedem o limite de tamanho.'},{status:413});}chunks.push(value);}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=new TextDecoder().decode(bytes);
 }
 const headers:Record<string,string>={'Content-Type':'application/json'};
 for(const name of ['cookie','origin','x-financemed-account']){const value=request.headers.get(name);if(value)headers[name]=value;}
 headers['x-forwarded-proto']=request.headers.get('x-forwarded-proto')||new URL(request.url).protocol.replace(':','');
 try{
  const upstream=await fetch(`${process.env.API_URL||'http://127.0.0.1:8000'}${path}`,{method,headers,body,cache:'no-store',signal:AbortSignal.timeout(20000)});
  const responseHeaders=new Headers({'Cache-Control':'no-store'});
  const cookie=upstream.headers.get('set-cookie');if(cookie)responseHeaders.set('set-cookie',cookie);
  const retry=upstream.headers.get('retry-after');if(retry)responseHeaders.set('retry-after',retry);
  if(upstream.status===204)return new Response(null,{status:204,headers:responseHeaders});
  const text=await upstream.text();let data;
  try{data=JSON.parse(text);}catch{return Response.json({detail:'O servidor retornou uma resposta inválida. Confira os logs da API.'},{status:502});}
  if(!upstream.ok&&typeof data?.detail!=='string')data={detail:upstream.status===422?'Revise os campos informados.':'Não foi possível concluir a operação. Tente novamente.'};
  if(upstream.status>=500)data={detail:'Não foi possível concluir a operação no servidor. Tente novamente.'};
  return Response.json(data,{status:upstream.status,headers:responseHeaders});
 }catch{return Response.json({detail:'Não foi possível conectar ao servidor. Confira se a API está em execução.'},{status:503});}
}
