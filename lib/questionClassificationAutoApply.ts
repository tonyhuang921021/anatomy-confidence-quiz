import type { SubjectName } from "@/types/quiz";

const VALID_CLASSIFICATION_SUBJECTS = new Set<SubjectName>([
  "醫學（一）",
  "醫學（二）",
  "解剖學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "胚胎學",
  "組織學",
  "寄生蟲學",
  "公共衛生學",
  "細胞生物學",
  "分子生物學",
  "其他醫學一"
]);

export const AUTO_CLASSIFICATION_APPROVER = "AI 自動套用";

export type AutoApplyQuestionClassificationInput = {
  reportId: string | number;
  questionId: string;
  subject?: string | null;
  chapter?: string | null;
  section?: string | null;
  approvedBy?: string | null;
  appliedAt?: string;
};

export function isValidClassificationSubject(subject?: string | null): subject is SubjectName {
  return Boolean(subject && VALID_CLASSIFICATION_SUBJECTS.has(subject.trim() as SubjectName));
}

export async function autoApplyQuestionClassification(
  supabase: any,
  input: AutoApplyQuestionClassificationInput
) {
  const subject = input.subject?.trim();
  if (!isValidClassificationSubject(subject)) {
    throw new Error("AI 回傳的科目不在可用分類清單內。");
  }

  const chapter = input.chapter?.trim() || subject;
  const section = input.section?.trim() || chapter;
  const appliedAt = input.appliedAt ?? new Date().toISOString();
  const approvedBy = input.approvedBy?.trim() || AUTO_CLASSIFICATION_APPROVER;

  const { error: overrideError } = await supabase.from("question_classification_overrides").upsert(
    {
      question_id: input.questionId,
      subject,
      chapter,
      section,
      source_report_id: input.reportId,
      updated_at: appliedAt
    },
    { onConflict: "question_id" }
  );

  if (overrideError) throw overrideError;

  const { error: reportError } = await supabase
    .from("question_classification_reports")
    .update({
      applied_at: appliedAt,
      approved_by_email: approvedBy
    })
    .eq("id", input.reportId);

  if (reportError) throw reportError;

  return {
    subject,
    chapter,
    section,
    appliedAt,
    approvedByEmail: approvedBy
  };
}
