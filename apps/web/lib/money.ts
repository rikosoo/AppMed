/** Brazilian grouping, comma decimals, and ungrouped dot decimals. Integer cents only. */
export function parseMoney(value:string):number|null {
 const raw=value.trim().replace(/^R\$\s*/, '');
 let whole:string,fraction='';
 if(raw.includes(',')){
  if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw))return null;
  [whole,fraction]=raw.split(',');whole=whole.replaceAll('.','');
 }else if(/^\d{1,3}(?:\.\d{3})+$/.test(raw))whole=raw.replaceAll('.','');
 else if(/^\d+(?:\.\d{1,2})?$/.test(raw))[whole,fraction='']=raw.split('.');
 else return null;
 const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(amount)?amount:null;
}
