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

function makeUnrelatedPastExamQuestions(count: number, subject: Question["subject"] = "解剖學") {
  return Array.from({ length: count }, (_, index) =>
    makeQuestion({
      id: `unrelated-${subject}-${index}`,
      subject,
      chapter: "腹部解剖",
      section: "腹膜與腸繫膜",
      primaryTag: `${subject}－腹部`,
      stem: `腹膜反摺與腸繫膜附著位置的基礎題 ${index}`,
      options: {
        A: "greater omentum",
        B: "lesser omentum",
        C: "transverse mesocolon",
        D: "sigmoid mesocolon"
      },
      testedConcept: "腹膜反摺與腸繫膜"
    })
  );
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
    testedConcept: "bronchoconstriction",
    sourceType: "AI_GENERATED"
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

test("AI 題可用正確選項與核心考點跨分類找到考古題，且不硬湊旁支題", () => {
  const current = makeQuestion({
    id: "ai-thyroid-surgery",
    subject: "解剖學",
    chapter: "AI 模擬卷",
    section: "AI 模擬卷",
    primaryTag: "解剖學－甲狀腺手術",
    sourceType: "AI_GENERATED",
    stem: "甲狀腺上極手術後無法唱高音，最可能受傷的構造為何？",
    options: {
      A: "喉返神經與後環杓肌",
      B: "上喉神經外支與環甲肌",
      C: "舌下神經與頦舌肌",
      D: "迷走神經與莖突咽肌"
    },
    answer: "B",
    testedConcept: "上喉神經外支支配環甲肌，受傷會造成高音困難"
  });
  const sameConcept = makeQuestion({
    id: "past-exam-superior-laryngeal",
    subject: "解剖學",
    chapter: "頭頸部",
    section: "喉部神經",
    primaryTag: "解剖學－頭頸部",
    stem: "上喉神經外支受損時，下列何種肌肉功能最容易受到影響？",
    options: {
      A: "環甲肌",
      B: "後環杓肌",
      C: "眼輪匝肌",
      D: "莖突咽肌"
    },
    testedConcept: "imported concept is intentionally ignored"
  });
  const sameRegionWrongConcept = makeQuestion({
    id: "past-exam-superior-thyroid-vein",
    subject: "解剖學",
    chapter: "頭頸部",
    section: "頭頸血管",
    primaryTag: "解剖學－頭頸部",
    stem: "上甲狀腺靜脈通常注入下列何者？",
    options: {
      A: "外頸靜脈",
      B: "內頸靜脈",
      C: "頭臂靜脈",
      D: "前頸靜脈"
    }
  });
  const index = buildRelatedQuestionIndex([
    sameConcept,
    sameRegionWrongConcept,
    ...makeUnrelatedPastExamQuestions(30)
  ]);

  const related = getRelatedQuestions(current, index);

  assert.deepEqual(related.map((question) => question.id), [sameConcept.id]);
});

test("AI 補題不使用候選題 testedConcept 單獨建立關聯", () => {
  const current = makeQuestion({
    id: "ai-current-concept",
    subject: "解剖學",
    chapter: "AI 模擬卷",
    section: "AI 模擬卷",
    sourceType: "AI_GENERATED",
    stem: "後交通動脈瘤壓迫動眼神經時的瞳孔變化為何？",
    options: {
      A: "同側瞳孔散大",
      B: "同側瞳孔縮小",
      C: "雙側瞳孔縮小",
      D: "瞳孔不受影響"
    },
    answer: "A",
    testedConcept: "後交通動脈瘤壓迫動眼神經會使同側瞳孔散大"
  });
  const misleadingCandidate = makeQuestion({
    id: "misleading-imported-concept",
    subject: "解剖學",
    chapter: "腹部解剖",
    section: "腎臟血管",
    primaryTag: "解剖學－腹部",
    stem: "腎動脈進入腎門前通常如何分支？",
    options: {
      A: "segmental arteries",
      B: "interlobar veins",
      C: "arcuate veins",
      D: "cortical radiate veins"
    },
    testedConcept: "後交通動脈瘤壓迫動眼神經會使同側瞳孔散大"
  });
  const index = buildRelatedQuestionIndex([
    misleadingCandidate,
    ...makeUnrelatedPastExamQuestions(30)
  ]);

  assert.deepEqual(getRelatedQuestions(current, index), []);
});

test("AI 補題不把只在候選干擾選項出現一次的詞當成同考點", () => {
  const current = makeQuestion({
    id: "ai-external-laryngeal-current",
    subject: "解剖學",
    chapter: "AI 模擬卷",
    section: "AI 模擬卷",
    sourceType: "AI_GENERATED",
    stem: "甲狀腺手術後無法唱高音，最可能受傷的神經為何？",
    options: {
      A: "喉返神經",
      B: "上喉神經外支",
      C: "舌下神經",
      D: "舌咽神經"
    },
    answer: "B",
    testedConcept: "上喉神經外支支配環甲肌並控制高音"
  });
  const distractorOnlyCandidate = makeQuestion({
    id: "hyoglossus-distractor-only",
    subject: "解剖學",
    chapter: "頭頸部",
    section: "舌骨舌肌",
    primaryTag: "解剖學－頭頸部",
    stem: "下列何者走在舌骨舌肌外表面並向前進入下頷舌骨肌深層？",
    options: {
      A: "舌動脈",
      B: "舌咽神經",
      C: "舌下神經",
      D: "上喉神經"
    }
  });
  const index = buildRelatedQuestionIndex([
    distractorOnlyCandidate,
    ...makeUnrelatedPastExamQuestions(30)
  ]);

  assert.deepEqual(getRelatedQuestions(current, index), []);
});

test("AI 補題讓 B19 這類精確識別詞優先於泛用前驅細胞題", () => {
  const current = makeQuestion({
    id: "ai-b19-current",
    subject: "微生物免疫學",
    chapter: "AI 模擬卷",
    section: "AI 模擬卷",
    primaryTag: "病毒學－DNA 病毒",
    sourceType: "AI_GENERATED",
    stem: "鐮刀型紅血球疾病患者突然出現再生不良危象，最可能的病毒作用為何？",
    options: {
      A: "感染成熟嗜中性球",
      B: "抑制巨核細胞",
      C: "感染並抑制紅系前驅細胞",
      D: "破壞成熟血小板"
    },
    answer: "C",
    testedConcept: "辨認 B19 對紅系前驅細胞的嗜性"
  });
  const exactB19Candidate = makeQuestion({
    id: "past-exam-b19",
    subject: "微生物免疫學",
    chapter: "病毒學",
    section: "DNA 病毒",
    primaryTag: "病毒學－DNA 病毒",
    stem: "有關 parvovirus B19 的敘述，下列何者最適當？",
    options: {
      A: "為雙股 DNA 病毒",
      B: "主要經糞口傳染",
      C: "感染紅血球先驅細胞",
      D: "造成嬰兒玫瑰疹"
    },
    answer: "C"
  });
  const genericPrecursorCandidate = makeQuestion({
    id: "generic-precursor",
    subject: "微生物免疫學",
    chapter: "免疫學",
    section: "造血細胞",
    primaryTag: "免疫學－免疫細胞",
    stem: "骨髓系與淋巴系前驅細胞可共同產生下列何種細胞？",
    options: {
      A: "樹突細胞",
      B: "紅血球",
      C: "血小板",
      D: "嗜中性球"
    }
  });
  const index = buildRelatedQuestionIndex([
    exactB19Candidate,
    genericPrecursorCandidate,
    ...makeUnrelatedPastExamQuestions(60, "微生物免疫學")
  ]);

  const related = getRelatedQuestions(current, index);

  assert.equal(related[0]?.id, exactB19Candidate.id);
});

test("非 AI 題不啟用第二階段補題", () => {
  const current = makeQuestion({
    id: "past-exam-current",
    subject: "解剖學",
    chapter: "AI 模擬卷",
    section: "AI 模擬卷",
    sourceType: "MOEX_PAST_EXAM",
    stem: "甲狀腺上極手術後無法唱高音，最可能受傷的構造為何？",
    options: {
      A: "喉返神經",
      B: "上喉神經外支",
      C: "舌下神經",
      D: "舌咽神經"
    },
    answer: "B",
    testedConcept: "上喉神經外支受傷會造成高音困難"
  });
  const fallbackOnlyCandidate = makeQuestion({
    id: "fallback-only-candidate",
    subject: "解剖學",
    chapter: "頭頸部",
    section: "喉部神經",
    primaryTag: "解剖學－頭頸部",
    stem: "上喉神經外支受損時最直接影響何種肌肉？",
    options: {
      A: "環甲肌",
      B: "後環杓肌",
      C: "眼輪匝肌",
      D: "頦舌肌"
    }
  });
  const index = buildRelatedQuestionIndex([
    fallbackOnlyCandidate,
    ...makeUnrelatedPastExamQuestions(30)
  ]);

  assert.deepEqual(getRelatedQuestions(current, index), []);
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
