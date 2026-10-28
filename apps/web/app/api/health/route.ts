import {proxyApi} from '@/lib/api-proxy';
export async function GET(request:Request){
 const response=await proxyApi(request,'/api/health');
 const data=await response.json();
 return Response.json(response.ok&&data?.status==='ok'?{status:'ok'}:{status:'unavailable'},{status:response.ok&&data?.status==='ok'?200:503,headers:{'Cache-Control':'no-store'}});
}
