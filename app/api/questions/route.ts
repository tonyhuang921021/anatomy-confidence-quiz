import { NextRequest, NextResponse } from "next/server";
import { anatomyQuestions } from "@/data/anatomyQuestions";

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const chapter = searchParams.get("chapter");
  const section = searchParams.get("section");
  const includeAnswer = searchParams.get("includeAnswer") === "true";
  const limit = Number(searchParams.get("limit") || anatomyQuestions.length);

  const filtered = anatomyQuestions
    .filter((question) => (chapter ? question.chapter === chapter : true))
    .filter((question) => (section ? question.section === section : true))
    .slice(0, Math.max(1, limit));

  const questions = filtered.map((question) =>
    includeAnswer
      ? question
      : {
          id: question.id,
          subject: question.subject,
          chapter: question.chapter,
          section: question.section,
          stem: question.stem,
          options: question.options,
          testedConcept: question.testedConcept
        }
  );

  return NextResponse.json({
    total: filtered.length,
    questions
  });
}
