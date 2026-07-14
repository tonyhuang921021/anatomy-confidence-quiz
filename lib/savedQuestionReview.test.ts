import assert from "node:assert/strict";
import test from "node:test";
import {
  SAVED_QUESTION_REVIEW_POOL_LABEL,
  buildSavedQuestionReviewSettings,
  isSavedQuestionReviewSettings
} from "./savedQuestionReview";
import type { Question } from "../types/quiz";

function makeQuestion(id: string, subject: Question["subject"]): Question {
  return {
    id,
    subject,
    chapter: "測試章節",
    section: "測試小節",
    stem: `題目 ${id}`,
    options: { A: "A", B: "B", C: "C", D: "D" },
    answer: "A",
    explanation: "測試",
    testedConcept: "測試"
  };
}

test("儲存題目複習只建立獨立 review 題池並保留完整題號", () => {
  const questions = Array.from({ length: 205 }, (_, index) =>
    makeQuestion(`saved-${index + 1}`, index % 2 === 0 ? "解剖學" : "生理學")
  );
  const settings = buildSavedQuestionReviewSettings([...questions, questions[0]]);

  assert.equal(settings.mode, "review");
  assert.equal(settings.customPoolLabel, SAVED_QUESTION_REVIEW_POOL_LABEL);
  assert.equal(settings.strictCustomQuestionPool, true);
  assert.equal(settings.excludeAiGenerated, false);
  assert.equal(settings.excludePreviouslyAnswered, false);
  assert.equal(settings.questionCount, 205);
  assert.equal(settings.customQuestionIds?.length, 205);
  assert.deepEqual(settings.subjectFilters, ["解剖學", "生理學"]);
  assert.equal(isSavedQuestionReviewSettings(settings), true);
});

test("其他 review 題池不會被當成儲存題目複習", () => {
  assert.equal(
    isSavedQuestionReviewSettings({
      ...buildSavedQuestionReviewSettings([makeQuestion("wrong-1", "病理學")]),
      customPoolLabel: "散題錯題庫"
    }),
    false
  );
});
