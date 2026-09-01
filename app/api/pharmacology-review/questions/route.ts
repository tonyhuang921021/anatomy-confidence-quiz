import { NextRequest, NextResponse } from "next/server";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";

const MAX_QUESTION_IDS = 24;
const QUESTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const QUESTION_BY_ID = new Map(getCanonicalQuestionBank().map((question) => [question.id, question]));

export function GET(request: NextRequest) {
  const ids = [...new Set(
    (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => QUESTION_ID_PATTERN.test(value))
  )].slice(0, MAX_QUESTION_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ questions: [] }, { status: 400 });
  }

  const questions = ids.flatMap((id) => {
    const question = QUESTION_BY_ID.get(id);
    return question ? [question] : [];
  });

  return NextResponse.json(
    { questions },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}
