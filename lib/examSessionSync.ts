import { examElapsed, checkpointClock, type ExamRuntimeClock } from "./examRuntimeClock";
import type { Attempt, OptionKey, Question, QuizSession } from "../types/quiz";
import { isQuestionAnswerCorrect } from "./answerScoring";
import { regradeSessionForCurrentAnswerKey } from "./answerKeyRevisions";

export type ExamFlag = "" | "triangle" | "circle" | "square";
export type ExamStamp = { counter: number; actor: string };
export type ExamRegister<T> = { stamp: ExamStamp; value: T };
export type ExamSessionSync = {
  schema: 1;
  sessionId: string;
  questionOrder: string[];
  revision: number;
  answers: Record<string, ExamRegister<Attempt | null>>;
  flags: Record<string, ExamRegister<ExamFlag>>;
  cursor: ExamRegister<number>;
  timer?: ExamRegister<ExamRuntimeClock>;
  completion?: { id: string; at: string };
};
export class ExamSyncConflict extends Error {}
const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);
const token = (x: unknown): x is string => typeof x === "string" && !["__proto__", "constructor", "prototype"].includes(x) && /^[A-Za-z0-9_.:-]{1,160}$/.test(x);
const uint = (x: unknown): x is number => Number.isSafeInteger(x) && Number(x) >= 0 && Number(x) < Number.MAX_SAFE_INTEGER;
const time = (x: unknown): x is string => typeof x === "string" && x.length <= 40 && Number.isFinite(Date.parse(x));
// Do not infer account equivalence from a suffix; the future authenticated adapter owns any explicit rebinding.
const canonical = (id: string) => id;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => JSON.stringify(k)+":"+stable((value as Record<string, unknown>)[k])).join(",")}}`;
  return JSON.stringify(value);
};
function requireScope(session: QuizSession) {
  const order = session.questionOrder;
  if (session.settings?.mode !== "simulation" || !token(canonical(session.id)) || !order?.length || order.length > 1000 || new Set(order).size !== order.length || order.some(id => !token(id))) throw new ExamSyncConflict("invalid exam session scope");
  return order;
}
function stamp(value: unknown): value is ExamStamp {
  const s = value as ExamStamp | undefined;
  return !!s && uint(s.counter) && token(s.actor);
}
function validAttempt(value: unknown, id: string): value is Attempt {
  const a = value as Attempt | undefined;
  return !!a && a.questionId === id && /^[A-E]$/.test(a.selectedAnswer) && /^[A-E]$/.test(a.correctAnswer) && typeof a.isCorrect === "boolean" && [1,2,3,4,5].includes(a.confidence) && time(a.answeredAt) && (!a.eliminatedOptions || (Array.isArray(a.eliminatedOptions) && a.eliminatedOptions.every(o => /^[A-E]$/.test(o))));
}
export function validatedExamState(session: QuizSession): ExamSessionSync | undefined {
  if (session.examSessionSync === undefined) return undefined;
  const order = requireScope(session), s = session.examSessionSync;
  if (!s || s.schema !== 1 || s.sessionId !== canonical(session.id) || stable(s.questionOrder) !== stable(order) || !uint(s.revision) || !s.answers || Array.isArray(s.answers) || typeof s.answers !== "object" || !s.flags || Array.isArray(s.flags) || typeof s.flags !== "object" || !s.cursor || !stamp(s.cursor.stamp) || !uint(s.cursor.value) || s.cursor.value >= order.length) throw new ExamSyncConflict("invalid exam state binding");
  const ids = new Set(order);
  for (const [id,r] of Object.entries(s.answers)) if (!ids.has(id) || !r || !stamp(r.stamp) || (r.value !== null && !validAttempt(r.value,id))) throw new ExamSyncConflict("invalid exam answer operation");
  for (const [id,r] of Object.entries(s.flags)) if (!ids.has(id) || !r || !stamp(r.stamp) || !["", "triangle", "circle", "square"].includes(r.value)) throw new ExamSyncConflict("invalid exam flag operation");
  if (s.timer) {
    const t=s.timer.value;
    if (!stamp(s.timer.stamp) || !t || !uint(t.durationSeconds) || !t.durationSeconds || t.durationSeconds>86400 || !uint(t.accumulatedSeconds) || typeof t.paused!=="boolean" || !Number.isFinite(t.updatedAt) || t.updatedAt<0 || (t.paused ? t.runningSince!==null : typeof t.runningSince!=="number" || !Number.isFinite(t.runningSince) || t.runningSince<0)) throw new ExamSyncConflict("invalid exam timer");
  }
  if (s.completion && (!token(s.completion.id) || !time(s.completion.at))) throw new ExamSyncConflict("invalid exam completion");
  return copy(s);
}
export function materializeExamSession(session: QuizSession): QuizSession {
  const s = validatedExamState(session);
  if (!s) return session;
  return regradeSessionForCurrentAnswerKey({...session, examSessionSync:s, attempts:s.questionOrder.flatMap(id => s.answers[id]?.value ? [copy(s.answers[id].value!)] : []), currentQuestionIndex:s.cursor.value, completedAt:s.completion?.at, isReviewingAnswer:s.completion ? false : session.isReviewingAnswer});
}
export function beginExamSession(session: QuizSession): QuizSession {
  if (session.examSessionSync !== undefined) return materializeExamSession(session);
  const order = requireScope(session), answers: ExamSessionSync["answers"] = {};
  for (const a of session.attempts) {
    if (!order.includes(a.questionId) || !validAttempt(a,a.questionId) || own(answers,a.questionId)) throw new ExamSyncConflict("invalid imported attempts");
    answers[a.questionId]={stamp:{counter:0,actor:"seed"},value:copy(a)};
  }
  const s: ExamSessionSync = {schema:1,sessionId:canonical(session.id),questionOrder:[...order],revision:0,answers,flags:{},cursor:{stamp:{counter:0,actor:"seed"},value:Math.min(Math.max(session.currentQuestionIndex ?? 0,0),order.length-1)}};
  if (session.completedAt) s.completion={id:"legacy-completed",at:session.completedAt};
  return materializeExamSession({...session,examSessionSync:s});
}
function nextStamp(s: ExamSessionSync, actor: string): ExamStamp {
  if (!token(actor)) throw new ExamSyncConflict("invalid actor");
  const counter=Math.max(s.cursor.stamp.counter,s.timer?.stamp.counter ?? 0,...Object.values(s.answers).map(r=>r.stamp.counter),...Object.values(s.flags).map(r=>r.stamp.counter))+1;
  if (!uint(counter)) throw new ExamSyncConflict("exam clock exhausted");
  return {counter,actor};
}
export type ExamEdit = {type:"timer"; value:ExamRuntimeClock} | {type:"answer"; question:Question; option:OptionKey; at:string} | {type:"clear"; questionId:string} | {type:"flag"; questionId:string; value:ExamFlag} | {type:"navigate"; index:number};
export function editExamSession(input: QuizSession, actor: string, edit: ExamEdit): QuizSession {
  const session=beginExamSession(input), s=validatedExamState(session)!;
  if (s.completion) throw new ExamSyncConflict("exam already completed");
  const revision=nextStamp(s,actor);
  if (edit.type === "timer") {
    if (s.timer && (edit.value.durationSeconds!==s.timer.value.durationSeconds || edit.value.accumulatedSeconds<examElapsed(s.timer.value,edit.value.updatedAt))) throw new ExamSyncConflict("timer cannot reset");
    s.timer={stamp:revision,value:copy(edit.value)};
  } else if (edit.type === "navigate") {
    if (!uint(edit.index) || edit.index >= s.questionOrder.length) throw new ExamSyncConflict("invalid question index");
    s.cursor={stamp:revision,value:edit.index};
  } else {
    const id=edit.type === "answer" ? edit.question.id : edit.questionId;
    if (!s.questionOrder.includes(id)) throw new ExamSyncConflict("question outside exam");
    if (edit.type === "flag") s.flags[id]={stamp:revision,value:edit.value};
    else if (edit.type === "clear") s.answers[id]={stamp:revision,value:null};
    else {
      if (!own(edit.question.options,edit.option) || !time(edit.at)) throw new ExamSyncConflict("invalid answer");
      const old=s.answers[id]?.value;
      s.answers[id]={stamp:revision,value:{questionId:id,selectedAnswer:edit.option,correctAnswer:edit.question.answer,isCorrect:isQuestionAnswerCorrect(edit.question,edit.option),confidence:old?.confidence ?? 4,eliminatedOptions:old?.eliminatedOptions,answeredAt:edit.at}};
    }
  }
  return materializeExamSession({...session,examSessionSync:s});
}
function join<T>(a: ExamRegister<T> | undefined,b: ExamRegister<T> | undefined): ExamRegister<T> {
  if (!a) return copy(b!); if (!b) return copy(a);
  const order=a.stamp.counter-b.stamp.counter || (a.stamp.actor > b.stamp.actor ? 1 : a.stamp.actor < b.stamp.actor ? -1 : 0);
  if (!order && stable(a.value) !== stable(b.value)) throw new ExamSyncConflict("same operation stamp has different content");
  return copy(order >= 0 ? a:b);
}
function joinActive(a:ExamSessionSync,b:ExamSessionSync):ExamSessionSync {
  if (a.sessionId !== b.sessionId || stable(a.questionOrder) !== stable(b.questionOrder)) throw new ExamSyncConflict("different exam binding");
  const answers:ExamSessionSync["answers"]={},flags:ExamSessionSync["flags"]={};
  for (const id of new Set([...Object.keys(a.answers),...Object.keys(b.answers)])) answers[id]=join(a.answers[id],b.answers[id]);
  for (const id of new Set([...Object.keys(a.flags),...Object.keys(b.flags)])) flags[id]=join(a.flags[id],b.flags[id]);
  return {...copy(a),revision:Math.max(a.revision,b.revision),answers,flags,cursor:join(a.cursor,b.cursor),...(a.timer||b.timer?{timer:join(a.timer,b.timer)}:{})};
}
export function mergeExamSessionCopies(a: QuizSession,b: QuizSession): QuizSession {
  const sa=validatedExamState(a),sb=validatedExamState(b);
  if (!sa && !sb) throw new ExamSyncConflict("no exam protocol");
  if (canonical(a.id) !== canonical(b.id) || stable(a.questionOrder)!==stable(b.questionOrder)) throw new ExamSyncConflict("different exam scope");
  // An unfinished pre-protocol tab cannot resurrect answers or erase flags.
  if (!sa) return a.completedAt ? mergeExamSessionCopies(beginExamSession(a),b) : materializeExamSession(b);
  if (!sb) return b.completedAt ? mergeExamSessionCopies(a,beginExamSession(b)) : materializeExamSession(a);
  if (sa.completion && sb.completion) {
    if (stable({...sa,revision:0}) !== stable({...sb,revision:0})) throw new ExamSyncConflict("competing completed snapshots; read authoritative checkpoint");
    return materializeExamSession({...a,examSessionSync:{...sa,revision:Math.max(sa.revision,sb.revision)}});
  }
  if (sa.completion) return materializeExamSession(a);
  if (sb.completion) return materializeExamSession(b);
  return materializeExamSession({...a,simulationElapsedSeconds:Math.max(a.simulationElapsedSeconds ?? 0,b.simulationElapsedSeconds ?? 0),examSessionSync:joinActive(sa,sb)});
}
export function sealExamSession(input:QuizSession,id:string,at:string):QuizSession {
  const session=beginExamSession(input),s=validatedExamState(session)!;
  if (s.completion) return session;
  if (!token(id) || !time(at)) throw new ExamSyncConflict("invalid completion request");
  if(s.timer && (!s.timer.value.paused || s.timer.value.runningSince!==null || s.timer.value.updatedAt!==Date.parse(at))) s.timer={stamp:nextStamp(s,"seal"),value:checkpointClock(s.timer.value,true,Date.parse(at))};
  s.completion={id,at};return materializeExamSession({...session,simulationElapsedSeconds:s.timer?s.timer.value.accumulatedSeconds:session.simulationElapsedSeconds,examSessionSync:s});
}

// Pure transaction core. The production adapter must lock/CAS one authenticated
// session atomically; a read followed by ordinary upsert does not satisfy this.
export type ExamCheckpoint = {revision:number; session:QuizSession; lastRequestId:string; lastFingerprint:string};
export type CheckpointCommand = {requestId:string; expectedRevision:number; session:QuizSession};
export type CheckpointResult = {kind:"accepted"|"duplicate"|"conflict"|"completed"; checkpoint:ExamCheckpoint};
export function applyExamCheckpoint(current:ExamCheckpoint|undefined,command:CheckpointCommand):CheckpointResult {
  if (!token(command.requestId) || !uint(command.expectedRevision)) throw new ExamSyncConflict("invalid checkpoint request");
  const incoming=materializeExamSession(command.session),state=validatedExamState(incoming);
  if (!state) throw new ExamSyncConflict("missing exam protocol");
  const fingerprint=stable(copy(command));
  if (current) {
    const savedState=validatedExamState(current.session);
    if (!uint(current.revision) || !savedState || savedState.revision!==current.revision) throw new ExamSyncConflict("corrupt authoritative checkpoint");
    if (canonical(current.session.id)!==canonical(incoming.id) || stable(current.session.questionOrder)!==stable(incoming.questionOrder)) throw new ExamSyncConflict("checkpoint binding mismatch");
    if (current.lastRequestId===command.requestId) {
      if (current.lastFingerprint!==fingerprint) throw new ExamSyncConflict("request ID reused with different content");
      return {kind:"duplicate",checkpoint:copy(current)};
    }
    if (current.session.completedAt) return {kind:"completed",checkpoint:copy(current)};
    if (current.revision!==command.expectedRevision) return {kind:"conflict",checkpoint:copy(current)};
  } else if (command.expectedRevision!==0) throw new ExamSyncConflict("missing checkpoint version");
  let merged=incoming;
  if (current) {
    if (state.completion) {
      const activeIncoming={...incoming,completedAt:undefined,examSessionSync:{...state,completion:undefined}};
      const active=mergeExamSessionCopies(activeIncoming,current.session);
      merged=sealExamSession(active,state.completion.id,state.completion.at);
    } else merged=mergeExamSessionCopies(incoming,current.session);
  }
  const revision=(current?.revision ?? 0)+1;
  merged=materializeExamSession({...merged,examSessionSync:{...validatedExamState(merged)!,revision}});
  return {kind:"accepted",checkpoint:copy({revision,session:merged,lastRequestId:command.requestId,lastFingerprint:fingerprint})};
}

/** The legacy upsert path has no atomic revision/terminal guard. Never fall back to it. */
export function assertLegacyCloudSyncAllowed(sessions: QuizSession[]) {
  if (sessions.some(session => session.examSessionSync !== undefined)) throw new ExamSyncConflict("仿真作答已保留；版本化雲端承接尚未安裝，禁止以舊同步覆寫。請讀回檢查，不要自動重送。");
}
