import { proxyApi } from '@/lib/api-proxy';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,{params}:Context){const {action}=await params;if(action!=='me')return new Response(null,{status:404});return proxyApi(request,'/api/auth/me');}
export async function POST(request:Request,{params}:Context){const {action}=await params;if(!['register','login','logout','delete-account'].includes(action))return new Response(null,{status:404});return proxyApi(request,`/api/auth/${action}`);}
