/** Hours.minutes input: 0.3 and 0,30 both mean thirty minutes, never decimal hours. */
export function parseWorkDuration(value:string):number|null{
 const match=/^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(value.trim());
 if(!match)return null;
 const hours=Number(match[1]);
 const minutes=Number((match[2]||'').padEnd(2,'0'));
 const total=hours*60+minutes;
 return minutes<60&&total>=1&&total<=280*60?total:null;
}
export function formatWorkDuration(minutes:number):string{
 const whole=Math.floor(minutes/60),rest=minutes%60;
 return rest?`${whole},${String(rest).padStart(2,'0')}`:String(whole);
}
export function durationLabel(minutes:number):string{
 const whole=Math.floor(minutes/60),rest=minutes%60;
 return whole?`${whole}h${rest?String(rest).padStart(2,'0'):''}`:`${rest} min`;
}
