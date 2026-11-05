import test from "node:test";
import assert from "node:assert/strict";
import { getComparisonPaper } from "./simulationComparisonCatalog";
import { aggregatePaperSubjects, comparisonSubject, comparisonClassificationLabel, isMatchingSubjectStats, scoreCompletePaper, scoreOwnCompletePaper, unavailableSubjectStats, type CohortRecord } from "./simulationSubjectComparison";
import { loadSimulationSubjectCohort, type CohortReader } from "./simulationSubjectCohort";
import type { QuizSession, Question } from "@/types/quiz";

const paper=getComparisonPaper("115090-1301")!;
const answers=(wrongEvery=0)=>paper.questions.map((q,i)=>({questionId:q.id,selectedAnswer:wrongEvery&&i%wrongEvery===0 ? Object.keys(q.options).find(a=>a!==q.answer)!:q.answer}));
const record=(index:number,wrongEvery=0):CohortRecord=>({sessionId:`s${index}`,accountId:`private-account-${index}`,completedAt:`2026-11-0${index+1}T00:00:00Z`,answers:answers(wrongEvery)});

test("comparison preserves the original results-page categories and denominators",()=>{
  assert.equal(paper.questions.length,100);
  const rows=scoreCompletePaper(paper,answers())!;
  assert.deepEqual(rows.map(r=>[r.subject,r.total]),[["解剖學",31],["胚胎學",5],["組織學",10],["生理學",27],["生物化學",27]]);
  assert.equal(comparisonSubject({...paper.questions[52],subject:"藥理學"}),"藥理學");
  assert.equal(rows.reduce((n,r)=>n+r.total,0),100);
});
test("a changed results-page category rejects a stale cohort even when totals stay equal",()=>{
  const good=aggregatePaperSubjects(paper,Array.from({length:5},(_,i)=>record(i)));
  const changed={...paper,questions:paper.questions.map((q,i)=>i===0?{...q,subject:paper.questions[31].subject}:i===31?{...q,subject:paper.questions[0].subject}:q)};
  assert.equal(isMatchingSubjectStats(good,changed),false);
  assert.equal(isMatchingSubjectStats(good,paper),true);
});
test("old regrouping and verified 80-question/AI papers do not borrow modern nominal bands",()=>{
  const old=getComparisonPaper("100030-1101")!;
  assert.equal(comparisonSubject(old.questions[50]),"微生物免疫學");
  const eighty=getComparisonPaper("MOEX-C217-091030-S4004-STAGE1")!;
  assert.equal(eighty.questions.length,80);
  assert.match(comparisonClassificationLabel(eighty),/網站分類/);
  const ai=getComparisonPaper("AI-MED1-113115-HUMANLIKE-002")!;
  assert.equal(ai.questions.length,100);
  assert.match(comparisonClassificationLabel(ai),/網站分類/);
  assert.equal(getComparisonPaper("arbitrary-private-paper"),null);
});
test("missing, duplicated, mixed-paper, blank and unsupported option answers are rejected",()=>{
  const valid=answers();
  for(const invalid of [valid.slice(1),[...valid.slice(1),valid[1]],valid.map((a,i)=>i? a:{...a,questionId:"other-Q001"}),valid.map((a,i)=>i?a:{...a,selectedAnswer:""}),valid.map((a,i)=>i?a:{...a,selectedAnswer:"E"})])assert.equal(scoreCompletePaper(paper,invalid),null);
});
test("current multiple-accepted/all-credit scoring ignores stale stored booleans",()=>{
  const q=(id:string,extra:Partial<Question>):Question=>({...paper.questions[0],id,subject:"生理學",...extra});
  const small={key:"fixture",questions:[q("fixture1",{answer:"A",acceptedAnswers:["A","B"],answerCreditType:"multiple_accepted"}),q("fixture2",{answerCreditType:"all_credit"})]};
  assert.equal(scoreCompletePaper(small,[{questionId:"fixture1",selectedAnswer:"B"},{questionId:"fixture2",selectedAnswer:"D"}])![0].correct,2);
});
test("each subject shares the exact same distinct-person cohort; latest valid record wins",()=>{
  const records=Array.from({length:5},(_,i)=>record(i,3));
  const newer={...record(0),sessionId:"newer",completedAt:"2026-11-10T00:00:00Z"};
  const result=aggregatePaperSubjects(paper,[...records,newer,records[1]]);
  assert.equal(result.sampleCount,5);
  const expected=[scoreCompletePaper(paper,newer.answers)!,...records.slice(1).map(r=>scoreCompletePaper(paper,r.answers)!)];
  result.subjects.forEach((r,i)=>assert.equal(r.averageCorrect,expected.reduce((n,s)=>n+s[i].correct,0)/5));
  assert.equal(isMatchingSubjectStats(result,paper),true);
});
test("four people including repeated sessions disclose no averages, exact count or identifiers",()=>{
  const records=Array.from({length:4},(_,i)=>record(i));
  const result=aggregatePaperSubjects(paper,[...records,{...records[0],sessionId:"repeat"}]);
  assert.equal(result.available,false);assert.equal(result.sampleCount,null);assert.deepEqual(result.subjects,[]);
  assert.ok(!JSON.stringify(result).includes("private-account"));assert.ok(!JSON.stringify(result).includes("sessionId"));
});
test("no-data and low-score records are not filled with zero averages",()=>{
  assert.equal(aggregatePaperSubjects(paper,[]).reason,"insufficient");
  const zero={...record(0),answers:paper.questions.map(q=>({questionId:q.id,selectedAnswer:Object.keys(q.options).find(a=>a!==q.answer)!}))};
  assert.equal(aggregatePaperSubjects(paper,Array.from({length:5},(_,i)=>({...zero,sessionId:`z${i}`,accountId:`z${i}`}))).available,false);
});
test("response validation rejects different paper, different answer key, missing subjects and impossible averages",()=>{
  const good=aggregatePaperSubjects(paper,Array.from({length:5},(_,i)=>record(i)));
  for(const bad of [{...good,paperKey:"other"},{...good,paperSignature:"old"},{...good,subjects:good.subjects.slice(1)},{...good,sampleCount:4},{...good,subjects:good.subjects.map((s,i)=>i?s:{...s,averageCorrect:s.total+1})}])assert.equal(isMatchingSubjectStats(bad,paper),false);
  assert.equal(isMatchingSubjectStats(unavailableSubjectStats(paper),paper),true);
});
test("own score requires a completed fixed paper and preserves the original session",()=>{
  const session={id:"own",subject:"醫學（一）",startedAt:"2026-11-05",completedAt:"2026-11-05",settings:{mode:"simulation",questionCount:100,selectedPaperKey:paper.key},questionOrder:paper.questions.map(q=>q.id),attempts:answers().map(a=>({...a,isCorrect:false}))} as QuizSession;
  const before=JSON.stringify(session);
  assert.equal(scoreOwnCompletePaper(paper,session)!.reduce((n,s)=>n+s.correct,0),100);
  assert.equal(JSON.stringify(session),before);
  assert.equal(scoreOwnCompletePaper(paper,{...session,completedAt:undefined}),null);
  assert.equal(scoreOwnCompletePaper(paper,{...session,questionOrder:["wrong"]}),null);
});

function fakeReader(change=false) {
  const records=Array.from({length:5},(_,i)=>record(i,3));let reads=0;
  const reader:CohortReader={
    readScores:async(key,limit)=>{assert.equal(key,paper.key);assert.equal(limit,100);return records.map(r=>({session_id:r.sessionId,completed_at:r.completedAt}));},
    readSessions:async ids=>{reads++;assert.ok(ids.length<=100);return records.filter(r=>ids.includes(r.sessionId)).map(r=>({id:r.sessionId,user_id:r.accountId,completed_at:r.completedAt,mode:"simulation",updated_at:change&&reads===2?"changed":"unchanged"}));},
    readAnswers:async(ids,limit)=>{assert.equal(limit,501);return records.filter(r=>ids.includes(r.sessionId)).flatMap(r=>r.answers.map(a=>({session_id:r.sessionId,question_id:a.questionId,selected_answer:a.selectedAnswer})));}
  };
  return reader;
}
test("bounded reader uses indexed session batches and does not expose private input fields",async()=>{
  const result=await loadSimulationSubjectCohort(paper,fakeReader());
  assert.equal(result.sampleCount,5);assert.ok(!JSON.stringify(result).includes("private-account"));
});
test("concurrent session updates invalidate the affected records",async()=>{
  assert.equal((await loadSimulationSubjectCohort(paper,fakeReader(true))).available,false);
});
test("read errors and truncated batches fail closed, never reuse partial group averages",async()=>{
  await assert.rejects(loadSimulationSubjectCohort(paper,{...fakeReader(),readAnswers:async()=>{throw Error("timeout");}}));
  await assert.rejects(loadSimulationSubjectCohort(paper,{...fakeReader(),readAnswers:async()=>Array.from({length:501},()=>({session_id:"s0",question_id:"unknown",selected_answer:"A"}))}));
});
