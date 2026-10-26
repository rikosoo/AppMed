'use client';
import { useEffect, useState } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Browser } from '@capacitor/browser';
export default function NativeRuntime(){
 const [offline,setOffline]=useState(false);
 useEffect(()=>{
  if(!Capacitor.isNativePlatform())return;
  document.documentElement.classList.add('native-app');
  let active=true;const handles:PluginListenerHandle[]=[];
  const retain=async(promise:Promise<PluginListenerHandle>)=>{const handle=await promise;if(active)handles.push(handle);else await handle.remove();};
  void Network.getStatus().then(s=>{if(active)setOffline(!s.connected);}).catch(()=>{});
  void retain(Network.addListener('networkStatusChange',s=>{if(active)setOffline(!s.connected);})).catch(()=>{});
  void retain(App.addListener('appStateChange',s=>{if(s.isActive)document.dispatchEvent(new Event('visibilitychange'));})).catch(()=>{});
  if(Capacitor.getPlatform()==='android')void retain(App.addListener('backButton',({canGoBack})=>{
   const event=new Event('financemed:back',{cancelable:true});
   if(!document.dispatchEvent(event))return;
   if(canGoBack)window.history.back();else void App.minimizeApp();
  })).catch(()=>{});
  const links=(event:MouseEvent)=>{const link=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;if(!link)return;const url=new URL(link.href);if(url.origin!==location.origin&&url.protocol==='https:'){event.preventDefault();void Browser.open({url:url.href});}};
  document.addEventListener('click',links);
  return()=>{active=false;handles.forEach(h=>void h.remove());document.removeEventListener('click',links);document.documentElement.classList.remove('native-app');};
 },[]);
 return offline?<div className="native-offline" role="status">Sem conexão. Seus dados não foram apagados. Reconecte para entrar ou salvar alterações.</div>:null;
}
