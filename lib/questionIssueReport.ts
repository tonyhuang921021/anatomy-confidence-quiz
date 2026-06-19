"use client";

import type { Question } from "@/types/quiz";
import { getOrCreateVisitorId } from "@/lib/visitor";

export type QuestionIssueReportDetails = {
  issueCategory?: string;
  issueNote?: string;
};

export async function submitQuestionIssueReport(
  question: Question,
  accessToken?: string | null,
  details: QuestionIssueReportDetails = {}
) {
  const response = await fetch("/api/question-issue-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      visitorId: getOrCreateVisitorId(),
      accessToken: accessToken ?? null,
      issueCategory: details.issueCategory ?? null,
      issueNote: details.issueNote ?? null,
      question: {
        id: question.id,
        subject: question.subject,
        chapter: question.chapter,
        section: question.section,
        stem: question.stem,
        options: question.options,
        answer: question.answer,
        acceptedAnswers: question.acceptedAnswers,
        explanation: question.explanation,
        testedConcept: question.testedConcept
      }
    })
  });

  const rawText = await response.text();
  const payload = (rawText ? JSON.parse(rawText) : null) as
    | { ok?: boolean; message?: string }
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message || rawText || "題目瑕疵回報送出失敗。");
  }

  return payload;
}
