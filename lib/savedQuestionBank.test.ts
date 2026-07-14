import assert from "node:assert/strict";
import test from "node:test";
import {
  getAISimulationPaperKeyFromQuestionId,
  loadSavedAISimulationQuestions
} from "./savedQuestionBank";

test("AI 模擬題號可還原卷別，正常考古題不會被誤判", () => {
  assert.equal(
    getAISimulationPaperKeyFromQuestionId("AI-MED1-113115-HUMANLIKE-002-Q001"),
    "AI-MED1-113115-HUMANLIKE-002"
  );
  assert.equal(
    getAISimulationPaperKeyFromQuestionId("MOEX-114100-1301-Q001"),
    undefined
  );
});

test("以前儲存的各版 AI 模擬題可由同一份收藏紀錄重新載入", async () => {
  const questionIds = [
    "AI-MED1-ADV-B-001-Q001",
    "AI-MED2-ADV-001-Q100",
    "AI-MED1-113115-HUMANLIKE-001-Q001",
    "AI-MED1-113115-HUMANLIKE-002-Q001",
    "AI-MED2-113115-HUMANLIKE-001-Q001"
  ];
  const questions = await loadSavedAISimulationQuestions(questionIds);

  assert.deepEqual(
    questions.map((question) => question.id),
    questionIds
  );
});
