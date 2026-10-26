/** Decimal hours, rounded to the integer minutes used by the planning engine. */
export function parseWorkDuration(value:string):number|null{
 const normalized=value.trim().replace(',','.');
 if(!/^(?:\d{1,3}(?:\.\d{1,6})?|\.\d{1,6})$/.test(normalized))return null;
 const hours=Number(normalized),minutes=Math.round(hours*60);
 return hours<=360&&minutes>=1?minutes:null;
}
export function formatWorkDuration(minutes:number):string{
 // Four decimals preserve every whole-minute duration when rounded on save.
 return String(Number((minutes/60).toFixed(4))).replace('.',',');
}
export function durationLabel(minutes:number):string{
 const whole=Math.floor(minutes/60),rest=minutes%60;
 return whole?`${whole}h${rest?String(rest).padStart(2,'0'):''}`:`${rest} min`;
}
