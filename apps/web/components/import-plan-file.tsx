'use client';
import { useState } from 'react';
import { validStore, type Store } from '@/lib/model';
export default function ImportPlanFile({accountName,onImport}:{accountName:string;onImport:(store:Store)=>void}){
 const [pending,setPending]=useState<Store|null>(null),[error,setError]=useState('');
 return <details className="file-import"><summary>Já tem um arquivo exportado? Importar JSON</summary><p>Importe uma cópia do FinanceMed para a conta <strong>{accountName}</strong>. Use apenas dados que pertencem a você. O arquivo original não será alterado.</p><label>Arquivo de planejamento<input type="file" accept="application/json,.json" onChange={async event=>{setError('');setPending(null);const file=event.target.files?.[0];if(!file)return;if(file.size>2_000_000){setError('Escolha um arquivo de até 2 MB.');return;}try{const parsed:unknown=JSON.parse(await file.text());if(!validStore(parsed))throw Error();setPending(parsed);}catch{setError('O arquivo não é uma exportação válida do FinanceMed.');}}}/></label>{error&&<p role="alert">{error}</p>}{pending&&<><p>{Object.keys(pending.months).length} meses encontrados. Confirme para salvar na sua conta.</p><button className="primary-button" onClick={()=>onImport(pending)}>Confirmar importação</button></>}</details>;
}
