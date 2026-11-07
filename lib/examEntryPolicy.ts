// Non-identity local UI preferences only. No candidate-entered value is accepted here.
export type ExamDisplayPreference='show'|'hide';
export function examEntryKey(caseId:string,paperKey:string){return `isolated-exam-entry:${caseId}:${paperKey}`;}
export function readExamEntry(storage:Pick<Storage,'getItem'>,key:string):{started:boolean;score:ExamDisplayPreference;allScore:ExamDisplayPreference}|null{
 try{const x=JSON.parse(storage.getItem(key)||'null');return x&&x.v===2&&x.started===true&&['show','hide'].includes(x.score)&&['show','hide'].includes(x.allScore)?{started:true,score:x.score,allScore:x.allScore}:null;}catch{return null;}
}
export function saveExamEntry(storage:Pick<Storage,'setItem'>,key:string,score:ExamDisplayPreference,allScore:ExamDisplayPreference='hide'){
 try{if(!['show','hide'].includes(score)||!['show','hide'].includes(allScore))return false;storage.setItem(key,JSON.stringify({v:2,started:true,score,allScore}));return true;}catch{return false;}
}
export function isMobileExamClient(width:number,ua:string,platform:string,touch:number,coarse=false){return (width<768&&coarse)||/Android|iPhone|iPad|iPod|Mobile/i.test(ua)||(platform==='MacIntel'&&touch>1);}
