import { proxyApi } from '@/lib/api-proxy';
type Context={params:Promise<{action:string}>};
export async function GET(request:Request,{params}:Context){const {action}=await params;if(!['me','recovery-email'].includes(action))return new Response(null,{status:404});return proxyApi(request,`/api/auth/${action}`);}
export async function POST(request:Request,{params}:Context){const {action}=await params;if(!['register','login','logout','delete-account','update-account','recovery-email','forgot-password','confirm-email','reset-password'].includes(action))return new Response(null,{status:404});return proxyApi(request,`/api/auth/${action}`);}
