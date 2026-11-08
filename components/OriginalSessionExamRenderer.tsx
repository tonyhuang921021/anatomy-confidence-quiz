'use client';
import {useEffect,useRef,useState} from 'react';
import type {QuizSession,Question,OptionKey} from '@/types/quiz';
import type {ExamFlag} from '@/lib/examSessionSync';
import {normalizedExamFlags} from '@/lib/examQuestionFlags';
import {projectExamRenderer} from '@/lib/examRendererProjection';
import {ExamLikeSurface} from './ExamLikeSurface';
import {ExamScreenFrame} from './ExamScreenFrame';
import {ExamEntryGate} from './ExamEntryGate';
import styles from './ExamLikeSurface.module.css';
type Props={session:QuizSession;questions:Question[];owner:string;elapsed:number;paused:boolean;disabled:boolean;onAnswer:(option:OptionKey)=>void;onClear:()=>void;onNavigate:(index:number)=>void;onFlag:(value:ExamFlag)=>void;onFinish:()=>void;onPause:()=>void};
export function OriginalSessionExamRenderer(p:Props){
 const [review,setReview]=useState(false),[scale,setScale]=useState(1),[confirm,setConfirm]=useState(0);
 const scope=JSON.stringify([p.owner,p.session.id]),autoEnd=useRef(false);
 useEffect(()=>{autoEnd.current=false;setConfirm(0);setReview(false);},[scope]);
 const flags=Object.fromEntries(Object.entries(normalizedExamFlags(p.session)).map(([id,x])=>[id,x.value]));
 // Timer and completion remain owned by QuizClient. No checkpoint API or result projection here.
 useEffect(()=>{if(p.paused||p.disabled||p.session.completedAt||autoEnd.current||p.elapsed<(p.session.simulationTimerDurationSeconds??7200))return;autoEnd.current=true;p.onFinish();},[p.elapsed,p.paused,p.disabled,p.session.completedAt,p.session.simulationTimerDurationSeconds,p.onFinish]);
 const view=projectExamRenderer(p.session,flags,p.elapsed,p.paused);
 return <ExamScreenFrame><ExamEntryGate timerAlreadyRunning fixture={{standard:false,caseId:scope,paperKey:p.session.settings?.selectedPaperKey??p.session.id,paperLabel:p.session.subject,questions:p.questions,durationSeconds:p.session.simulationTimerDurationSeconds??7200}}><main id="main-content" className={styles.root}>
 {confirm?<section className="confirm-page" aria-label="交卷確認"><header className="confirm-banner">國家考試電腦化測驗流程演練</header><div className="confirm-sheet"><h2>{confirm===1?'注意：結束作答視同繳卷':'再次確認是否結束本次應考？'}</h2>{confirm===1?<p>是否結束本次應考？</p>:null}<p>已答 {p.session.attempts.length} 題，尚有 {p.questions.length-p.session.attempts.length} 題未作答。</p><div className="confirm-buttons"><button className="silver" disabled={p.disabled} onClick={()=>confirm===1?setConfirm(2):p.onFinish()}>確定</button><button className="silver" onClick={()=>setConfirm(0)}>取消</button></div></div></section>:<ExamLikeSurface session={view} questions={p.questions} review={review} scale={scale} now={0} disabled={p.disabled} onAnswer={p.onAnswer} onClear={p.onClear} onFlag={p.onFlag} onNavigate={index=>{setReview(false);p.onNavigate(index)}} onReview={()=>setReview(!review)} onFinish={()=>setConfirm(1)} onScale={setScale} onPause={p.onPause}/>}
 </main></ExamEntryGate></ExamScreenFrame>;
}
