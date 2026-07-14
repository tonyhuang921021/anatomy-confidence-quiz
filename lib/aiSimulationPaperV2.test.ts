import assert from "node:assert/strict";
import test from "node:test";
import {
  getAISimulationPaperOptions,
  getQuestionsForAISimulationPaper
} from "../data/aiSimulationPapers";
import { buildRelatedQuestionIndex, getRelatedQuestions } from "./relatedQuestions";
import type { Question } from "../types/quiz";

const PAPER_KEY = "AI-MED1-113115-HUMANLIKE-002";

test("第二份 GPT 5.6 醫學一完整註冊且細節題標記正確", () => {
  const option = getAISimulationPaperOptions("醫學（一）").find(
    (paper) => paper.key === PAPER_KEY
  );
  const questions = getQuestionsForAISimulationPaper(PAPER_KEY, "醫學（一）");

  assert.equal(option?.label, "第二份gpt5.6出的醫學一（有改良）");
  assert.equal(option?.questionCount, 100);
  assert.equal(option?.info?.highlights.length, 4);
  assert.equal(questions.length, 100);
  assert.equal(new Set(questions.map((question) => question.id)).size, 100);
  assert.equal(questions.filter((question) => question.isDetailQuestion).length, 15);
  assert.ok(questions.every((question) => question.paperCode === "002"));
});

test("改良卷可用題幹、選項與觀念連到同科考古題", () => {
  const source = getQuestionsForAISimulationPaper(PAPER_KEY, "醫學（一）").find(
    (question) => question.originalQuestionNumber === 68
  );
  assert.ok(source);

  const relatedPastExam: Question = {
    id: "MOEX-RELATED-5301-Q068",
    subject: "生理學",
    chapter: "腎臟生理",
    section: "腎血流與腎小管重吸收",
    stem: "出球小動脈中度收縮使 filtration fraction 增加時，周小管毛細血管膠體滲透壓與近端小管水鈉再吸收如何改變？",
    options: {
      A: "膠體滲透壓上升且重吸收增加",
      B: "膠體滲透壓下降且重吸收增加",
      C: "膠體滲透壓上升且重吸收下降",
      D: "膠體滲透壓下降且重吸收下降"
    },
    answer: "A",
    explanation: "filtration fraction 上升會濃縮出球端血漿蛋白。",
    testedConcept: "腎小球與周小管 Starling force",
    sourceType: "MOEX_PAST_EXAM",
    sourceYear: 2024,
    sourceRound: 2,
    originalQuestionNumber: 68,
    examCode: "RELATED",
    paperCode: "5301"
  };

  const related = getRelatedQuestions(
    source,
    buildRelatedQuestionIndex([relatedPastExam])
  );

  assert.deepEqual(related.map((question) => question.id), [relatedPastExam.id]);
});
