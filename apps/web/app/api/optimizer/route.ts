import {limitedBody,BodyLimitError,upstreamHeaders,ProxyAccessError} from '@/lib/proxy-security';
const unavailable = 'O motor de cálculo está indisponível. Na pasta do projeto, execute npm run dev para iniciar a interface e a API, ou confira o terminal da API na porta 8000.';
export async function POST(request: Request) {
  let payload: unknown;
  try { payload = JSON.parse(await limitedBody(request,64000)); }
  catch(error) { if(error instanceof BodyLimitError)return Response.json({detail:'Os dados enviados excedem o limite de tamanho.'},{status:413,headers:{'Cache-Control':'no-store'}});return Response.json({ detail: 'Não foi possível ler os dados enviados. Tente calcular novamente.' }, { status: 400 }); }
  try {
    const upstream = await fetch(`${process.env.API_URL || 'http://127.0.0.1:8000'}/api/optimizer`, {
      method: 'POST', headers: upstreamHeaders(request),
      body: JSON.stringify(payload), signal: AbortSignal.timeout(20000), cache: 'no-store',
    });
    const responseHeaders:Record<string,string>={'Cache-Control':'no-store'};const retry=upstream.headers.get('retry-after');if(retry)responseHeaders['Retry-After']=retry;
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { return Response.json({ detail: upstream.ok ? 'O motor retornou uma resposta inválida. Reinicie a API e tente novamente.' : 'O motor encontrou um erro ao calcular. Confira o terminal da API e tente novamente.' }, { status: 502 }); }
    if (!upstream.ok) {
      const detail = upstream.status >= 500 ? 'O motor encontrou um erro ao calcular. Confira o terminal da API e tente novamente.' : typeof data?.detail === 'string' ? data.detail : 'Revise os valores, horas e limites dos trabalhos cadastrados.';
      return Response.json({ detail }, { status: upstream.status,headers:responseHeaders });
    }
    if (!data || !Array.isArray(data.scenarios) || !['feasible','infeasible','achieved','over_capacity'].includes(data.status)) {
      return Response.json({ detail: 'A resposta do motor está incompleta. Atualize o projeto e reinicie a API.' }, { status: 502 });
    }
    return Response.json(data,{headers:responseHeaders});
  } catch(error) { if(error instanceof ProxyAccessError)return Response.json({detail:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return Response.json({ detail: unavailable }, { status: 503 }); }
}
