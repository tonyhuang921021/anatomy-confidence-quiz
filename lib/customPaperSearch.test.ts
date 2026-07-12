import assert from "node:assert/strict";
import test from "node:test";
import {
  expandCustomPaperSearchTerms,
  orderCustomPaperSearchResults,
  rankCustomPaperSearchCandidates
} from "./customPaperSearch";
import type { Question } from "../types/quiz";

function makeQuestion(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    subject: "生理學",
    chapter: "腎臟生理",
    section: "酸鹼平衡",
    stem: "腎小管如何調節氫離子排泄？",
    options: { A: "增加 H+ 分泌", B: "減少 HCO3- 再吸收", C: "無變化", D: "停止產氨" },
    answer: "A",
    testedConcept: "腎臟酸鹼調節",
    explanation: "集合管與近端腎小管共同參與酸鹼平衡。",
    ...overrides
  };
}

test("斜線、頓號與換行輸入會真的拆成多個搜題詞", () => {
  const terms = expandCustomPaperSearchTerms(["腎臟／酸鹼、集合管\n產氨"]);

  assert.ok(terms.includes("腎臟"));
  assert.ok(terms.includes("酸鹼"));
  assert.ok(terms.includes("集合管"));
  assert.ok(terms.includes("產氨"));
});

test("新分類與題幹命中優先，不讓詳解偶然提及單獨拉題", () => {
  const direct = makeQuestion("direct");
  const incidental = makeQuestion("incidental", {
    chapter: "心臟生理",
    section: "心輸出量",
    stem: "下列何者會增加心輸出量？",
    options: { A: "心率增加", B: "前負荷下降", C: "收縮力下降", D: "後負荷增加" },
    testedConcept: "心輸出量",
    explanation: "腎臟酸鹼失衡也可能間接影響循環。"
  });

  const ranked = rankCustomPaperSearchCandidates(
    [incidental, direct],
    expandCustomPaperSearchTerms(["腎臟酸鹼"])
  );

  assert.deepEqual(ranked.map((item) => item.question.id), ["direct"]);
});

test("搜題會忽略題幹開頭的不可見字元並統一 OCR 相容字形", () => {
  const hiddenOcrText = makeQuestion("hidden-ocr", {
    stem: "\u200B\uFEFF下列何種蛋⽩質純化方法的專一性最好？"
  });

  const ranked = rankCustomPaperSearchCandidates(
    [hiddenOcrText],
    expandCustomPaperSearchTerms(["下列何種蛋白質純化方法"])
  );

  assert.deepEqual(ranked.map((item) => item.question.id), ["hidden-ocr"]);
});

test("AI 回傳題號順序會保留，無效與重複題號會被忽略", () => {
  const q1 = makeQuestion("q1");
  const q2 = makeQuestion("q2");

  assert.deepEqual(
    orderCustomPaperSearchResults([q1, q2], ["q2", "missing", "q2", "q1"]).map(
      (question) => question.id
    ),
    ["q2", "q1"]
  );
});

test("AI 沒確認任何題目時不會偷偷塞入關鍵字候選題", () => {
  const q1 = makeQuestion("q1");

  assert.deepEqual(orderCustomPaperSearchResults([q1], []), []);
});
