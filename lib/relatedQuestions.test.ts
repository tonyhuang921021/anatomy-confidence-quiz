import assert from "node:assert/strict";
import test from "node:test";
import { buildRelatedQuestionIndex, getRelatedQuestions } from "./relatedQuestions";
import type { Question } from "../types/quiz";

function makeQuestion(overrides: Partial<Question> & Pick<Question, "id" | "stem">): Question {
  return {
    id: overrides.id,
    subject: overrides.subject ?? "藥理學",
    chapter: overrides.chapter ?? "呼吸系統用藥",
    section: overrides.section ?? "支氣管平滑肌",
    stem: overrides.stem,
    options: overrides.options ?? {
      A: "histamine H1 receptor activation",
      B: "beta 2 receptor activation",
      C: "muscarinic blockade",
      D: "cAMP increase"
    },
    answer: overrides.answer ?? "A",
    explanation: overrides.explanation ?? "測試詳解",
    testedConcept: overrides.testedConcept ?? "bronchoconstriction",
    primaryTag: overrides.primaryTag,
    sourceType: overrides.sourceType ?? "MOEX_PAST_EXAM",
    sourceYear: overrides.sourceYear,
    sourceRound: overrides.sourceRound,
    originalQuestionNumber: overrides.originalQuestionNumber,
    paperCode: overrides.paperCode
  };
}

test("類似題以題幹與選項文字為主，不讓不可信 testedConcept 單獨拉題", () => {
  const current = makeQuestion({
    id: "current",
    stem: "下列何者最可能造成支氣管收縮？",
    testedConcept: "bronchoconstriction"
  });
  const textMatch = makeQuestion({
    id: "text-match",
    stem: "histamine 作用於支氣管平滑肌時，最可能造成何種變化？",
    testedConcept: "wrong-imported-concept",
    sourceYear: 2024
  });
  const misleadingConcept = makeQuestion({
    id: "misleading-concept",
    chapter: "腎臟生理",
    section: "腎小管運輸",
    stem: "葡萄糖與鈉離子在近端小管共同運輸，最可能屬於何種機轉？",
    options: {
      A: "secondary active transport",
      B: "simple diffusion",
      C: "filtration",
      D: "osmosis"
    },
    testedConcept: "bronchoconstriction",
    sourceYear: 2025
  });

  const related = getRelatedQuestions(
    current,
    buildRelatedQuestionIndex([textMatch, misleadingConcept])
  );

  assert.deepEqual(
    related.map((question) => question.id),
    ["text-match"]
  );
});

test("類似題只取同科考古題，不混入 AI 題或其他科目", () => {
  const current = makeQuestion({
    id: "current",
    stem: "acetylcholine 對支氣管平滑肌的影響為何？",
    testedConcept: "bronchoconstriction"
  });
  const pastExamSameSubject = makeQuestion({
    id: "past-exam-same-subject",
    stem: "muscarinic receptor 活化後，支氣管平滑肌最可能產生何種反應？"
  });
  const aiGenerated = makeQuestion({
    id: "ai-generated",
    stem: "muscarinic receptor 活化後，支氣管平滑肌最可能產生何種反應？",
    sourceType: "AI_GENERATED"
  });
  const otherSubject = makeQuestion({
    id: "other-subject",
    subject: "解剖學",
    chapter: "呼吸系統",
    section: "支氣管",
    stem: "muscarinic receptor 活化後，支氣管平滑肌最可能產生何種反應？"
  });

  const related = getRelatedQuestions(
    current,
    buildRelatedQuestionIndex([pastExamSameSubject, aiGenerated, otherSubject])
  );

  assert.deepEqual(
    related.map((question) => question.id),
    ["past-exam-same-subject"]
  );
});

test("類似題優先使用新考點分類，也允許文字證據充分的跨標籤題目", () => {
  const current = makeQuestion({
    id: "current-classified",
    chapter: "舊章節 A",
    section: "舊小節 A",
    primaryTag: "藥理學－自律神經藥理",
    stem: "muscarinic receptor 活化對支氣管平滑肌有何影響？"
  });
  const samePrimaryTag = makeQuestion({
    id: "same-primary-tag",
    chapter: "舊章節 B",
    section: "舊小節 B",
    primaryTag: "藥理學－自律神經藥理",
    stem: "muscarinic receptor 刺激後，支氣管平滑肌如何變化？",
    sourceYear: 2025
  });
  const oldSectionOnly = makeQuestion({
    id: "old-section-only",
    chapter: "舊章節 A",
    section: "舊小節 A",
    primaryTag: "藥理學－抗感染藥物",
    stem: "muscarinic receptor 刺激後，支氣管平滑肌如何變化？",
    sourceYear: 2026
  });
  const sameTagWithoutKeywordSupport = makeQuestion({
    id: "same-tag-no-keywords",
    primaryTag: "藥理學－自律神經藥理",
    stem: "某藥物主要經由腎小管分泌排除，何者正確？",
    options: {
      A: "glomerular filtration",
      B: "tubular secretion",
      C: "hepatic metabolism",
      D: "biliary excretion"
    }
  });

  const related = getRelatedQuestions(
    current,
    buildRelatedQuestionIndex([samePrimaryTag, oldSectionOnly, sameTagWithoutKeywordSupport])
  );

  assert.deepEqual(
    related.map((question) => question.id),
    ["same-primary-tag", "old-section-only"]
  );
});

test("蛋白質層析題可跨新分類連到同科舊考古題", () => {
  const current = makeQuestion({
    id: "MOEX-113090-1301-Q074",
    subject: "生物化學",
    chapter: "生物化學",
    section: "分子生物技術與遺傳檢驗",
    primaryTag: "生物化學－分子生物技術與遺傳檢驗",
    stem: "下列何種蛋白質純化方法的專一性（specificity）最好？",
    options: {
      A: "親合力層析法（affinity chromatography）",
      B: "離子交換層析法（ion-exchange chromatography）",
      C: "膠體過濾層析法（gel filtration chromatography）",
      D: "鹽析法（salting-out）"
    }
  });
  const sameTagGelFiltration = makeQuestion({
    id: "MOEX-108030-1301-Q076",
    subject: "生物化學",
    chapter: "生物化學",
    section: "分子生物技術與遺傳檢驗",
    primaryTag: "生物化學－分子生物技術與遺傳檢驗",
    stem: "蛋白質混合物以凝膠過濾色層分析法（gel filtration chromatography）分離時，第二順位沖提出來的是何者？",
    options: {
      A: "cytochrome c，Mr 13,000",
      B: "immunoglobulin G，Mr 145,000",
      C: "ribonuclease A，Mr 13,700",
      D: "RNA polymerase，Mr 450,000"
    }
  });
  const crossTagGelFiltration = makeQuestion({
    id: "MOEX-112020-1301-Q074",
    subject: "生物化學",
    chapter: "生物化學",
    section: "胺基酸與蛋白質結構功能",
    primaryTag: "生物化學－胺基酸與蛋白質結構功能",
    stem: "蛋白質純化方法中的膠體過濾層析法（gel filtration chromatography），依何種差異達成分離？",
    options: {
      A: "電性高低（charge）",
      B: "分子大小（molecular size）",
      C: "質荷比高低（mass-to-charge ratio）",
      D: "穩定程度（stability）"
    }
  });
  const unrelatedBiochemistry = makeQuestion({
    id: "unrelated-biochemistry",
    subject: "生物化學",
    chapter: "生物化學",
    section: "脂質與脂蛋白代謝",
    primaryTag: "生物化學－脂質與脂蛋白代謝",
    stem: "乳糜微粒中的三酸甘油酯主要由何種酵素水解？",
    options: {
      A: "lipoprotein lipase",
      B: "hormone-sensitive lipase",
      C: "pancreatic lipase",
      D: "hepatic lipase"
    }
  });

  const related = getRelatedQuestions(
    current,
    buildRelatedQuestionIndex([
      current,
      sameTagGelFiltration,
      crossTagGelFiltration,
      unrelatedBiochemistry
    ])
  );

  assert.deepEqual(
    new Set(related.map((question) => question.id)),
    new Set(["MOEX-108030-1301-Q076", "MOEX-112020-1301-Q074"])
  );
});
