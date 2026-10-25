import { proxyApi } from '@/lib/api-proxy';
type Context={params:Promise<{path:string[]}>};
export async function GET(request:Request,{params}:Context){
 const {path}=await params;
 if(path.length!==1||!['metrics','users'].includes(path[0]))return new Response(null,{status:404});
 return proxyApi(request,`/api/admin/${path[0]}${new URL(request.url).search}`);
}
export async function PATCH(request:Request,{params}:Context){
 const {path}=await params;
 if(path.length!==3||path[0]!=='users'||path[2]!=='status'||!/^[a-zA-Z0-9-]{1,100}$/.test(path[1]))return new Response(null,{status:404});
 return proxyApi(request,`/api/admin/users/${path[1]}/status`);
}
