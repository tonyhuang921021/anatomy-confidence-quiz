import { aggregatePaperSubjects, COMPARISON_SCAN_LIMIT, type ComparisonPaper, type CohortRecord } from "./simulationSubjectComparison";

export type CohortScore = { session_id: string; completed_at: string };
export type CohortSession = { id: string; user_id: string; mode: string; completed_at: string | null; updated_at: string };
export type CohortAnswer = { session_id: string; question_id: string; selected_answer: string };
export type CohortReader = {
  readScores: (paperKey: string, limit: number) => Promise<CohortScore[]>;
  readSessions: (ids: string[]) => Promise<CohortSession[]>;
  readAnswers: (ids: string[], limit: number) => Promise<CohortAnswer[]>;
};

// Only indexed, bounded reads. No fallback to a whole-table scan or to per-item
// public accuracy. All subjects are calculated from the same complete cohort.
export async function loadSimulationSubjectCohort(paper: ComparisonPaper, reader: CohortReader) {
  const summaries = await reader.readScores(paper.key, COMPARISON_SCAN_LIMIT);
  if (summaries.length > COMPARISON_SCAN_LIMIT || new Set(summaries.map(s=>s.session_id)).size !== summaries.length) throw new Error("invalid summary batch");
  if (!summaries.length) return aggregatePaperSubjects(paper,[]);
  const allIds=summaries.map(s=>s.session_id);
  const sessions=await reader.readSessions(allIds);
  if (sessions.length>allIds.length || sessions.some(s=>!allIds.includes(s.id))) throw new Error("invalid session batch");
  const allAnswers:CohortAnswer[]=[];
  const records: CohortRecord[] = [];
  for (let offset=0; offset<summaries.length; offset+=5) {
    const batch=summaries.slice(offset,offset+5), ids=batch.map(s=>s.session_id);
    const answers=await reader.readAnswers(ids,501);
    if (answers.length>=501 || answers.some(a=>!ids.includes(a.session_id))) throw new Error("incomplete or unexpected read");
    allAnswers.push(...answers);
  }
  const after=await reader.readSessions(allIds);
  for (const session of sessions) {
      const current=after.find(s=>s.id===session.id);
      if (!session.updated_at || !current || current.updated_at!==session.updated_at ||
        current.user_id!==session.user_id || current.completed_at!==session.completed_at || current.mode!==session.mode) continue;
      if (session.mode!=="simulation" || !session.completed_at || session.completed_at!==summaries.find(s=>s.session_id===session.id)?.completed_at) continue;
      records.push({sessionId:session.id,accountId:session.user_id,completedAt:session.completed_at,
        answers:allAnswers.filter(a=>a.session_id===session.id).map(a=>({questionId:a.question_id,selectedAnswer:a.selected_answer}))});
  }
  return aggregatePaperSubjects(paper,records);
}
