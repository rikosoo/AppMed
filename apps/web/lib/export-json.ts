import { Capacitor } from '@capacitor/core';
export async function exportJson(text:string,filename:string,accountId?:string){
 if(Capacitor.isNativePlatform()){
  const [{Filesystem,Directory,Encoding},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
  const file=await Filesystem.writeFile({path:`financemed-exports/${accountId?`${accountId}/`:''}${filename}`,recursive:true,data:text,directory:Directory.Cache,encoding:Encoding.UTF8});
  await Share.share({title:'Cópia do Axterix Med',files:[file.uri],dialogTitle:'Salvar ou compartilhar planejamento'});
  return;
 }
 const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
