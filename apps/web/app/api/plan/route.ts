import { proxyApi } from '@/lib/api-proxy';
export async function GET(request:Request){return proxyApi(request,'/api/plan');}
export async function PUT(request:Request){return proxyApi(request,'/api/plan');}
