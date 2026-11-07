import type {Attempt,QuizSession} from '@/types/quiz';
export type AnswerEdit={counter:number;actor:string;value:Attempt|null};
export type QuizAnswerEdits={schema:1;baseline:Attempt[];entries:Record<string,AnswerEdit>};
const answerIdentity=(value:Attempt|null)=>{if(!value)return null;const {correctAnswer,isCorrect,errorType,...identity}=value;return identity;};
// Local receipt only: never trusted as authorization by the server.
export function completionIdentity(s:QuizSession){return JSON.stringify([s.id,s.completedAt,s.questionOrder,(s.questionOrder??[]).map(id=>{const e=s.answerEdits?.entries[id];return e?[id,e.counter,e.actor,answerIdentity(e.value)]:[id,answerIdentity(s.attempts.find(a=>a.questionId===id)??null)];})]);}
function legacyCompletionIdentity(s:QuizSession){const identity=(a:Attempt|null)=>{if(!a)return null;const {correctAnswer,isCorrect,...rest}=a;return rest;};return JSON.stringify([s.id,s.completedAt,s.questionOrder,(s.questionOrder??[]).map(id=>{const e=s.answerEdits?.entries[id];return e?[id,e.counter,e.actor,identity(e.value)]:[id,identity(s.attempts.find(a=>a.questionId===id)??null)];})]);}
export function isAcceptedCompletion(s:QuizSession){return Boolean(s.completedAt&&(s.completionReceipt===completionIdentity(s)||s.completionReceipt===legacyCompletionIdentity(s)));}
export function acceptCanonicalCompletion(s:QuizSession):QuizSession{return {...s,completionReceipt:s.completedAt?completionIdentity(s):undefined};}
const cmp=(a:AnswerEdit,b:AnswerEdit)=>a.counter-b.counter||(a.actor<b.actor?-1:a.actor>b.actor?1:0);
export function validateAnswerEdits(s:QuizSession){
 const e=s.answerEdits;if(!e)return;
 if(e.schema!==1||!Array.isArray(e.baseline)||e.baseline.length>1000||!s.questionOrder?.length||s.questionOrder.length>1000||new Set(s.questionOrder).size!==s.questionOrder.length||!e.entries||Object.keys(e.entries).length!==s.questionOrder.length)throw Error('INVALID_ANSWER_EDITS');
 for(const id of s.questionOrder??[]){const x=e.entries[id];if(!Object.hasOwn(e.entries,id)||['__proto__','constructor','prototype'].includes(id)||!x||!Number.isSafeInteger(x.counter)||x.counter<0||x.counter>1e9||!/^[-\w]{1,64}$/.test(x.actor)||(x.value!==null&&(x.value.questionId!==id||!['A','B','C','D'].includes(x.value.selectedAnswer)||typeof x.value.isCorrect!=='boolean'||!Number.isFinite(Date.parse(x.value.answeredAt))||!Number.isInteger(x.value.confidence)||x.value.confidence<1||x.value.confidence>5)))throw Error('INVALID_ANSWER_EDITS');}
}
export function materializeAnswerEdits(s:QuizSession):QuizSession{
 if(!s.answerEdits)return s;validateAnswerEdits(s);
 return {...s,attempts:(s.questionOrder??[]).flatMap(id=>s.answerEdits!.entries[id].value?[s.answerEdits!.entries[id].value!]:[])};
}
export function editCanonicalAnswer(s:QuizSession,id:string,value:Attempt|null,actor=globalThis.crypto.randomUUID()):QuizSession{
 if(s.completedAt||!s.questionOrder?.includes(id))return s;
 const entries=s.answerEdits?.entries??Object.fromEntries(s.questionOrder.map(q=>[q,{counter:0,actor:'baseline',value:s.attempts.find(a=>a.questionId===q)??null}]));
 const counter=Math.max(0,...Object.values(entries).map(x=>x.counter))+1;
 return materializeAnswerEdits({...s,isReviewingAnswer:false,answerEdits:{schema:1,baseline:s.answerEdits?.baseline??s.attempts,entries:{...entries,[id]:{counter,actor,value}}}});
}
/** Only exact session identities merge. Never infer owner equivalence from a suffix. */
export function mergeCanonicalAnswerEdits(a:QuizSession,b:QuizSession):QuizSession|null{
 if(!a.answerEdits&&!b.answerEdits)return null;
 if(a.id!==b.id||JSON.stringify(a.questionOrder)!==JSON.stringify(b.questionOrder))throw Error('ANSWER_EDIT_SCOPE_MISMATCH');
 if(isAcceptedCompletion(a)||isAcceptedCompletion(b))return isAcceptedCompletion(a)?a:b;
 const base=a.answerEdits?a:b,other=base===a?b:a;validateAnswerEdits(base);validateAnswerEdits(other);
 const entries={...base.answerEdits!.entries};
 for(const [id,edit] of Object.entries(other.answerEdits?.entries??{})){const old=entries[id];if(cmp(edit,old)===0&&JSON.stringify(answerIdentity(edit.value))!==JSON.stringify(answerIdentity(old.value)))throw Error('ANSWER_EDIT_COLLISION');if(cmp(edit,old)>0)entries[id]=edit;}
 const merged=materializeAnswerEdits({...base,...(Math.max(a.simulationElapsedSeconds??0,b.simulationElapsedSeconds??0)?{simulationElapsedSeconds:Math.max(a.simulationElapsedSeconds??0,b.simulationElapsedSeconds??0)}:{}),answerEdits:{...base.answerEdits!,entries}});
 // A local completion is only a proposal for its exact answer revision.
 const proposal=[a,b].filter(x=>x.completedAt&&completionIdentity({...merged,completedAt:x.completedAt})===completionIdentity(x)).sort((x,y)=>x.completedAt!.localeCompare(y.completedAt!))[0];
 if(proposal)merged.completedAt=proposal.completedAt;else delete merged.completedAt;
 delete merged.completionReceipt;
 return merged;
}

/** Official answer-key regrading changes grades, never the user's edit ordering or selected answer. */
export function syncAnswerEditGrades(s:QuizSession):QuizSession{
 if(!s.answerEdits)return s;
 const byId=new Map(s.attempts.map(a=>[a.questionId,a]));
 return {...s,answerEdits:{...s.answerEdits,entries:Object.fromEntries(Object.entries(s.answerEdits.entries).map(([id,e])=>{const a=byId.get(id);return [id,e.value&&a?{...e,value:{...e.value,correctAnswer:a.correctAnswer,isCorrect:a.isCorrect,...(Object.hasOwn(e.value,"errorType")||a.errorType!==undefined?{errorType:a.errorType}:{})}}:e]}))}};
}

/** Explicit local metadata edits participate in the same revision register. */
export function syncAnswerEditMetadata(s:QuizSession):QuizSession{
 if(!s.answerEdits||isAcceptedCompletion(s))return s;
 let next={...s,completedAt:undefined};
 for(const a of s.attempts){const old=next.answerEdits?.entries[a.questionId]?.value;
  if(old&&old.selectedAnswer===a.selectedAnswer&&old.answeredAt===a.answeredAt&&JSON.stringify([old.confidence,old.errorType,old.eliminatedOptions])!==JSON.stringify([a.confidence,a.errorType,a.eliminatedOptions]))next={...editCanonicalAnswer(next,a.questionId,a),completedAt:undefined};
 }
 return {...next,completedAt:s.completedAt};
}

/** Exact request identity only; account changes/foreign rounds cannot redirect results. */
export function canonicalCompletionResponse(owner:string,activeOwner:string,requestId:string,values:QuizSession[]=[]):QuizSession|undefined {
 if(owner!==activeOwner)return;
 const prefix=`user-${owner}:`;
 if(requestId.startsWith('user-')&&!requestId.startsWith(prefix))return;
 const id=requestId.startsWith(prefix)?requestId:prefix+requestId;
 return values.find(value=>value.id===id);
}
