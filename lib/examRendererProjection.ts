import {editCanonicalAnswer} from "./quizAnswerEdits";
import type {QuizSession,Attempt} from '@/types/quiz';
import type {ExamFlag,ExamSessionSync} from './examSessionSync';
/** Read-only view model. Never store this projection or send it to a sync API. */
export function projectExamRenderer(session:QuizSession,flags:Record<string,ExamFlag>,elapsed:number,paused:boolean):QuizSession {
 const stamp={counter:0,actor:'presentation'};
 const answers:ExamSessionSync['answers']={};
 for(const attempt of session.attempts)answers[attempt.questionId]={stamp,value:attempt};
 return {...session,examSessionSync:{schema:1,sessionId:session.id,questionOrder:session.questionOrder??[],revision:0,answers,flags:Object.fromEntries(Object.entries(flags).map(([id,value])=>[id,{stamp,value}])),cursor:{stamp,value:session.currentQuestionIndex??0},timer:{stamp,value:{durationSeconds:session.simulationTimerDurationSeconds??7200,accumulatedSeconds:elapsed,paused,runningSince:null,updatedAt:0}}}};
}
/** Same attempt collection contract as normal QuizClient; identity and scoring are unchanged. */
export function replaceRendererAttempt(session:QuizSession,attempt:Attempt):QuizSession {
 if(session.completedAt||!session.questionOrder?.includes(attempt.questionId))return session;
 return session.answerEdits?editCanonicalAnswer(session,attempt.questionId,attempt):{...session,attempts:[...session.attempts.filter(a=>a.questionId!==attempt.questionId),attempt],isReviewingAnswer:false};
}
export function clearRendererAttempt(session:QuizSession,questionId:string):QuizSession {
 if(session.completedAt||!session.questionOrder?.includes(questionId))return session;
 return editCanonicalAnswer(session,questionId,null);
}
