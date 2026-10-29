import {proxyApi} from '@/lib/api-proxy';
export async function POST(request:Request){return proxyApi(request,'/api/optimizer/less-hours');}
