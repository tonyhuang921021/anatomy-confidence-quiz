import { NextResponse } from "next/server";
import { anatomyQuestions } from "@/data/anatomyQuestions";
import { isOpenAIConfigured } from "@/lib/openai";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "Anatomy Confidence Quiz API",
    timestamp: new Date().toISOString(),
    questionCount: anatomyQuestions.length,
    openaiConfigured: isOpenAIConfigured(),
    openaiModel: process.env.OPENAI_MODEL || "gpt-5.4-mini"
  });
}
