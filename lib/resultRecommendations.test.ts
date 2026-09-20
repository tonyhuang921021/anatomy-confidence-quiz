import assert from "node:assert/strict";
import test from "node:test";
import { buildResultRecommendations, formatResultRecommendationLabel } from "./resultRecommendations";
import { calculateCompletionStats, createQuestionOrder, getLowCompletionSections, getTopWeakSections, calculateSectionStats } from "./quizAnalysis";
import type { Attempt, Question, QuizSession } from "../types/quiz";

function question(id: string, subject: Question["subject"], topic = `${subject}－測試分類`): Question {
  return { id, subject, chapter: subject, section: topic, primaryTag: topic, stem: "既有測試題", options: { A: "甲", B: "乙", C: "丙", D: "丁" }, answer: "A", explanation: "既有測試詳解", testedConcept: "", sourceType: "MOEX_PAST_EXAM", sourceYear: 2026, sourceRound: 1 };
}
function attempt(questionId: string, isCorrect = false, confidence: Attempt["confidence"] = 3): Attempt {
  return { questionId, selectedAnswer: isCorrect ? "A" : "B", correctAnswer: "A", isCorrect, confidence, answeredAt: "2026-09-20T01:00:00Z" };
}
function session(id: string, attempts: Attempt[], settings: QuizSession["settings"] = { mode: "random", questionCount: attempts.length }): QuizSession {
  return { id, subject: "醫學（二）", startedAt: "2026-09-20T00:00:00Z", completedAt: "2026-09-20T02:00:00Z", attempts, settings };
}
function recommendations(questions: Question[], questionBank: Question[], current = session("current", questions.map((item) => attempt(item.id))), history: QuizSession[] = []) {
  return buildResultRecommendations({ session: current, questions, questionBank, completedSessions: history });
}

test("completion groups come from the supplied subjects and preserve raw chapter__section keys", () => {
  const bank = [question("path-1", "病理學"), question("path-2", "病理學"), question("pharm", "藥理學")];
  bank[0].chapter = bank[1].chapter = "既有病理章節";
  const stats = calculateCompletionStats(bank, [{ attempts: [attempt("path-1")] }]);
  assert.deepEqual(stats.chapters.map((item) => item.chapter).sort(), ["既有病理章節", "藥理學"]);
  assert.equal(stats.sections.find((item) => `${item.chapter}__${item.section}` === "既有病理章節__病理學－測試分類")?.completionRate, 50);
  assert.doesNotMatch(JSON.stringify(stats), /肩胛|前臂|解剖/);
});

test("completion excludes unrelated questions, incomplete sessions and unanswered records, deduping bank IDs", () => {
  const first = question("q1", "生理學"), second = question("q2", "生理學");
  const unfinished = session("unfinished", [attempt("q2")]);
  delete unfinished.completedAt;
  const stats = calculateCompletionStats([first, second, first], [
    session("done", [attempt("q1", true, 5), attempt("outside"), { ...attempt("q2"), selectedAnswer: "" as Attempt["selectedAnswer"] }]),
    unfinished
  ]);
  assert.equal(stats.overall.totalQuestionsInBank, 2);
  assert.equal(stats.overall.attemptedQuestions, 1);
  assert.equal(stats.overall.completionRate, 50);
  assert.equal(stats.overall.correctRate, 100);
  assert.equal(stats.sections[0].totalQuestionsInBank, 2);
});

test("an empty bank cannot create anatomy chapters, completion or low-progress suggestions", () => {
  const stats = calculateCompletionStats([], [{ attempts: [attempt("outside")] }]);
  assert.deepEqual(stats.sections, []);
  assert.deepEqual(stats.chapters, []);
  assert.equal(stats.overall.attemptedQuestions, 0);
  assert.equal(stats.overall.masteryScore, 0);
  assert.deepEqual(getLowCompletionSections(stats.sections), []);
});

test("recommendations use the complete current-subject bank and both prompts share its denominator", () => {
  const currentQuestions = [question("micro-1", "微生物免疫學", "細菌學－測試分類"), question("pharm-1", "藥理學"), question("path-1", "病理學")];
  const bank = [...currentQuestions, question("micro-2", "微生物免疫學", "細菌學－測試分類"), question("pharm-2", "藥理學"), question("path-2", "病理學"), question("anatomy", "解剖學", "肩胛區")];
  const current = session("current", currentQuestions.map((item) => attempt(item.id)));
  const history = [session("old-anatomy", [attempt("anatomy")])];
  const before = JSON.stringify({ current, history, bank });
  const result = recommendations(currentQuestions, bank, current, history);
  assert.equal(result.completionStats.overall.totalQuestionsInBank, 6);
  assert.equal(result.completionStats.overall.attemptedQuestions, 3);
  assert.equal(result.completionStats.overall.completionRate, 50);
  for (const prompt of Object.values(result.promptTexts)) {
    assert.doesNotMatch(prompt, /anatomy|肩胛|前臂|解剖學/);
    assert.match(prompt, /6 題/);
    assert.match(prompt, /已作答 3 題/);
    for (const subject of ["微生物免疫學", "藥理學", "病理學"]) assert.ok(prompt.includes(subject));
    for (const item of result.lowCompletion) assert.ok(prompt.includes(item.section));
  }
  assert.equal(JSON.stringify({ current, history, bank }), before);
});

test("correct confident answers create neither weak points nor incomplete topics when the scope is completed", () => {
  const questions = [question("stable-1", "生理學"), question("stable-2", "生理學")];
  const result = recommendations(questions, questions, session("current", questions.map((item) => attempt(item.id, true, 5))));
  assert.deepEqual(result.topWeakSections, []);
  assert.deepEqual(result.lowCompletion, []);
  assert.deepEqual(result.unstableSections, []);
  for (const prompt of Object.values(result.promptTexts)) assert.match(prompt, /本次沒有答錯或低信心題，不需建立弱項/);
  assert.deepEqual(getTopWeakSections(calculateSectionStats([attempt(questions[0].id, true, 5)], questions)), []);
});

test("confidence 3 remains a review signal, but disabled simulation tracking does not manufacture weak points", () => {
  const questions = [question("uncertain", "病理學")];
  const result = recommendations(questions, questions, session("current", [attempt("uncertain", true, 3)]));
  assert.equal(result.topWeakSections.length, 1);
  assert.equal(result.topWeakSections[0].lowConfidence, 1);
  assert.match(result.promptTexts.concise, /答對但沒信心/);
  const disabled = session("disabled", [attempt("uncertain", true, 3)], { mode: "simulation", questionCount: 1, enableConfidenceCalibration: false });
  const disabledResult = recommendations(questions, questions, disabled);
  assert.deepEqual(disabledResult.topWeakSections, []);
  for (const prompt of Object.values(disabledResult.promptTexts)) {
    assert.match(prompt, /平均信心：未記錄/);
    assert.match(prompt, /本次沒有答錯或低信心題，不需建立弱項/);
    assert.doesNotMatch(prompt, /答對但沒信心（3）/);
  }
  const wrongDisabled = recommendations(questions, questions, session("disabled-wrong", [attempt("uncertain")], disabled.settings));
  assert.equal(wrongDisabled.topWeakSections[0].wrong, 1);
  assert.equal(wrongDisabled.topWeakSections[0].lowConfidence, 0);
  assert.match(wrongDisabled.promptTexts.detailed, /未記錄信心，不推論信心高低/);
});

test("reliable year and track selections narrow the full pool, stale settings cannot hide actual questions", () => {
  const bacterial = question("bacteria", "微生物免疫學", "細菌學－測試分類");
  const bank = [bacterial, question("bacteria-unseen", "微生物免疫學", "細菌學－測試分類"), { ...bacterial, id: "older", sourceYear: 2025 }, question("virus", "微生物免疫學", "病毒學－測試分類")];
  const settings: NonNullable<QuizSession["settings"]> = { mode: "random", questionCount: 1, yearFrom: 2026, yearTo: 2026, subjectTracks: { 微生物免疫學: ["bacteria"] } };
  const result = recommendations([bacterial], bank, session("current", [attempt(bacterial.id)], settings));
  assert.equal(result.completionStats.overall.totalQuestionsInBank, 2);
  assert.match(result.scopeLabel, /所選科目分類/);
  const stale = recommendations([bacterial], bank, session("current", [attempt(bacterial.id)], { ...settings, yearFrom: 2025, yearTo: 2025, subjectTracks: { 微生物免疫學: ["virus"] } }));
  assert.equal(stale.completionStats.overall.totalQuestionsInBank, 4);
  assert.match(stale.scopeLabel, /完整既有題庫/);
});

test("known paper and explicit custom-pool selections describe their real denominator", () => {
  const first = { ...question("paper-1", "生理學"), paperCode: "1101" };
  const second = { ...first, id: "paper-2" };
  const other = { ...first, id: "other-paper", paperCode: "1301" };
  const bank = [first, second, other];
  const paper = recommendations([first], bank, session("paper", [attempt(first.id)], { mode: "simulation", questionCount: 1, selectedPaperKey: "2026-1-1101" }));
  assert.equal(paper.completionStats.overall.totalQuestionsInBank, 2);
  assert.match(paper.scopeLabel, /所選考卷/);
  const custom = recommendations([first], bank, session("custom", [attempt(first.id)], { mode: "review", questionCount: 1, strictCustomQuestionPool: true, customQuestionIds: [first.id, second.id] }));
  assert.equal(custom.completionStats.overall.totalQuestionsInBank, 2);
  assert.match(custom.scopeLabel, /指定題庫/);
});

test("a classification override updates weak points, progress and both prompts together", () => {
  const oldQuestion = question("override-fixture", "解剖學", "肩胛區");
  const bank = [oldQuestion, question("path-unseen", "病理學", "病理學－細胞傷害"), question("unrelated-anatomy", "解剖學", "前臂")];
  const current = session("current", [attempt(oldQuestion.id)]);
  const result = buildResultRecommendations({ session: current, questions: [oldQuestion], questionBank: bank, completedSessions: [], classificationOverrides: {
    [oldQuestion.id]: { questionId: oldQuestion.id, subject: "病理學", chapter: "病理學", section: "細胞傷害", updatedAt: "2026-09-20T00:00:00Z" }
  } });
  assert.equal(result.topWeakSections[0].section, "病理學－細胞傷害");
  assert.equal(result.completionStats.overall.totalQuestionsInBank, 2);
  for (const prompt of Object.values(result.promptTexts)) {
    assert.match(prompt, /病理學－細胞傷害/);
    assert.doesNotMatch(prompt, /肩胛|前臂|解剖學/);
  }
});

test("subject-only and confirmed taxonomy gaps stay explicitly unsplit", () => {
  const generic = question("generic-path", "病理學", "病理學");
  const result = recommendations([generic], [generic]);
  assert.equal(formatResultRecommendationLabel(result.topWeakSections[0]), "病理學（科目整體，尚未細分）");
  for (const prompt of Object.values(result.promptTexts)) assert.match(prompt, /科目整體，尚未細分/);
  const gap = question("missing-2012-1-101030-1101-q023", "生理學", "不可信舊小節");
  const gapResult = recommendations([gap], [gap]);
  assert.equal(gapResult.topWeakSections[0].chapter, "解剖學");
  assert.equal(gapResult.topWeakSections[0].section, "解剖學");
  assert.doesNotMatch(gapResult.promptTexts.detailed, /不可信舊小節/);
});

test("weakness practice still respects native non-anatomy chapter and section filters", () => {
  const weak = question("weak", "病理學", "細胞傷害");
  const stable = question("stable", "病理學", "腫瘤");
  const order = createQuestionOrder([stable, weak], [{ attempts: [attempt(weak.id), attempt(stable.id, true, 5)] }], { mode: "weakness", questionCount: 1, subjectFilter: "病理學", chapter: weak.chapter, section: weak.section, excludePreviouslyAnswered: false });
  assert.deepEqual(order, [weak.id]);
});

test("equal-priority and equal-progress suggestions follow canonical subject order regardless of input ordering", () => {
  const questions = [question("tie-path", "病理學"), question("tie-micro", "微生物免疫學"), question("tie-pharm", "藥理學"), question("tie-physiology", "生理學"), question("tie-biochemistry", "生物化學")];
  const bank = questions.flatMap((item) => [item, { ...item, id: `${item.id}-unseen` }]);
  const first = recommendations(questions, bank);
  const reversed = recommendations([...questions].reverse(), [...bank].reverse());
  const expected = ["生理學", "生物化學", "微生物免疫學", "藥理學", "病理學"];
  for (const result of [first, reversed]) {
    assert.deepEqual(result.topWeakSections.map((item) => item.chapter), expected.slice(0, 3));
    assert.deepEqual(result.lowCompletion.map((item) => item.chapter), expected);
    assert.deepEqual(result.completionStats.chapters.map((item) => item.chapter), expected);
    for (const prompt of Object.values(result.promptTexts)) {
      const weakScope = prompt.split("依信心程度建議的補強範圍：")[1];
      const positions = expected.slice(0, 3).map((subject) => weakScope.indexOf(`${subject}－測試分類`));
      assert.ok(positions.every((position) => position >= 0));
      assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
      for (const item of questions) assert.ok(prompt.includes(item.id), "all five target questions remain covered");
    }
    const detailedWeakPoints = result.promptTexts.detailed.split("以下是本次需要補強的科目／分類：")[1].split("\n\n")[0];
    for (const subject of expected.slice(0, 3)) assert.ok(detailedWeakPoints.includes(`${subject}－測試分類`));
    for (const subject of expected.slice(3)) assert.ok(!detailedWeakPoints.includes(`${subject}－測試分類`));
  }
});
