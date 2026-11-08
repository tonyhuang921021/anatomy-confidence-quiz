import type {QuizSession} from '@/types/quiz';
import type {ExamFlag} from './examSessionSync';
type Entries=NonNullable<QuizSession['examQuestionFlags']>;
export function normalizedExamFlags(s:QuizSession):Entries {
 const result:Entries={};const allowed=new Set(s.questionOrder??[]);
 for(const [id,x] of Object.entries(s.examQuestionFlags??{}))if(allowed.has(id)&&x&&['','triangle','circle','square'].includes(x.value)&&Number.isSafeInteger(x.counter)&&x.counter>0&&x.counter<=1e9&&typeof x.actor==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(x.actor))result[id]={value:x.value,counter:x.counter,actor:x.actor};
 return result;
}
export function mergeExamFlags(a:QuizSession,b:QuizSession):Entries {
 if(a.id!==b.id)throw Error('FLAG_SCOPE_MISMATCH');const result=normalizedExamFlags(a);
 for(const [id,x] of Object.entries(normalizedExamFlags(b))){const old=result[id];if(!old||x.counter>old.counter||(x.counter===old.counter&&x.actor>old.actor))result[id]=x;}
 return result;
}
export function setExamQuestionFlag(s:QuizSession,id:string,value:ExamFlag,actor=crypto.randomUUID()):QuizSession {
 if(s.completedAt||!s.questionOrder?.includes(id))return s;const entries=normalizedExamFlags(s),counter=Math.max(0,...Object.values(entries).map(x=>x.counter))+1;
 if(counter>1e9)throw Error('FLAG_COUNTER_EXHAUSTED');
 const answerEdits=s.answerEdits??{schema:1 as const,baseline:s.attempts,entries:Object.fromEntries((s.questionOrder??[]).map(q=>[q,{counter:0,actor:'baseline',value:s.attempts.find(a=>a.questionId===q)??null}]))};
 return {...s,answerEdits,examQuestionFlags:{...entries,[id]:{value,counter,actor}}};
}
export function examFlagValue(s:QuizSession|undefined|null,id:string):ExamFlag {return s?normalizedExamFlags(s)[id]?.value??'':'';}
