import assert from "node:assert/strict";
import test from "node:test";
import { isQuestionAnswerCorrect } from "./answerScoring";
import type { Question } from "../types/quiz";

type TestQuestion = Pick<Question, "answer" | "acceptedAnswers" | "answerCreditType">;

test("複數給分題接受公告列出的每一個答案", () => {
  const question: TestQuestion = {
    answer: "B",
    acceptedAnswers: ["B", "D"],
    answerCreditType: "multiple_accepted"
  };

  assert.equal(isQuestionAnswerCorrect(question, "B"), true);
  assert.equal(isQuestionAnswerCorrect(question, "D"), true);
  assert.equal(isQuestionAnswerCorrect(question, "A"), false);
  assert.equal(isQuestionAnswerCorrect(question, "C"), false);
});

test("一律給分題選任何有效選項都算答對", () => {
  const question: TestQuestion = {
    answer: "A",
    acceptedAnswers: ["A", "B", "C", "D"],
    answerCreditType: "all_credit"
  };

  for (const selectedAnswer of ["A", "B", "C", "D"] as const) {
    assert.equal(isQuestionAnswerCorrect(question, selectedAnswer), true);
  }
});

test("一般題仍只接受單一正確答案", () => {
  const question: TestQuestion = {
    answer: "C",
    answerCreditType: "standard"
  };

  assert.equal(isQuestionAnswerCorrect(question, "C"), true);
  assert.equal(isQuestionAnswerCorrect(question, "D"), false);
});
