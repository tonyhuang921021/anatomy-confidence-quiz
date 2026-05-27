import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import { getActiveAIAccountBan } from "@/lib/aiAccountBan";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import type {
  OptionKey,
  PeakChallengeLeaderboardEntry,
  Question,
  QuestionClassificationOverride,
  QuizSession,
  SubjectName
} from "@/types/quiz";

type PeakChallengeRunRow = {
  session_id: string;
  user_id?: string | null;
  user_email?: string | null;
  participant_label: string;
  score: number;
  total_answered: number;
  question_ids?: string[] | null;
  source_breakdown?: { pastExam?: number; aiGenerated?: number } | null;
  completed_at: string;
  created_at?: string | null;
};

type PeakCandidateSummary = {
  questionId: string;
  subject: SubjectName;
  chapter: string;
  section: string;
  stem: string;
  testedConcept?: string;
  riskScore?: number;
  wrongCount?: number;
  lowConfidenceCount?: number;
  sourceType?: string;
};

type QuestionAccuracyRow = {
  question_id: string;
  total_attempts: number;
  correct_attempts?: number;
  correct_rate: number;
};

type SharedAIQuestionRow = {
  id: string;
  feature: string;
  subject: SubjectName;
  chapter: string;
  section: string;
  tested_concept?: string | null;
  question_payload: Question;
  source_model?: string | null;
  usage_count?: number | null;
  last_used_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GeneratePeakBody = {
  action: "generate";
  accessToken?: string | null;
  visitorId?: string | null;
  wrongPoolCandidates?: PeakCandidateSummary[];
  doneQuestionIds?: string[];
  desiredCount?: number;
  existingSourceBreakdown?: { pastExam?: number; aiGenerated?: number };
  practicedSubjects?: SubjectName[];
  nextQuestionIndex?: number;
  consumeAttempt?: boolean;
};

type SubmitPeakBody = {
  action: "submit";
  accessToken?: string | null;
  visitorId?: string | null;
  session?: QuizSession;
};

type StartGateBody = {
  action: "start_gate";
  accessToken?: string | null;
  visitorId?: string | null;
};

type VerifiedUser = {
  id: string;
  email?: string | null;
  label: string;
};

type ImportedAIQuestionRaw = {
  subject?: string;
  chapter?: string;
  section?: string;
  question?: string;
  stem?: string;
  options?: Record<string, string>;
  answer?: string;
  accepted_answers?: string[];
  acceptedAnswers?: string[];
  answer_credit_type?: string;
  answerCreditType?: string;
  tested_concept?: string;
  testedConcept?: string;
  explanation?: string;
  option_analysis?: Record<string, string>;
  optionAnalysis?: Record<string, string>;
  memory_tip?: string;
  memoryTip?: string;
};

const TARGET_QUESTION_COUNT = 10;
const PAST_EXAM_TARGET_COUNT = 5;
const AI_USAGE_PREFIX = "PEAK_CHALLENGE:";
const DAILY_PEAK_CHALLENGE_LIMIT = 3;
const OWNER_EMAIL = "tonyhuang921021@gmail.com";
const ALLOWED_SUBJECTS = new Set<SubjectName>([
  "解剖學",
  "生理學",
  "生物化學",
  "藥理學",
  "病理學",
  "微生物免疫學",
  "胚胎學",
  "組織學",
  "寄生蟲學",
  "公共衛生學",
  "細胞生物學",
  "分子生物學",
  "其他醫學一"
]);

function getServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function stripJsonCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeJsonLikeInput(raw: string) {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function formatPeakChallengeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "巔峰賽操作失敗";
  if (
    message.includes("peak_challenge_runs") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  ) {
    return "Supabase 還沒建立 peak_challenge_runs 資料表，請先跑巔峰賽那段 SQL。";
  }
  if (
    message.includes("peak_challenge_attempt_logs") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  ) {
    return "Supabase 還沒建立 peak_challenge_attempt_logs 資料表，請先跑我補的巔峰賽每日次數 SQL。";
  }
  return message;
}

function isPeakChallengeOwner(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

function getTaipeiDayBounds(date = new Date()) {
  const offsetMs = 8 * 60 * 60 * 1000;
  const taipei = new Date(date.getTime() + offsetMs);
  const year = taipei.getUTCFullYear();
  const month = taipei.getUTCMonth();
  const day = taipei.getUTCDate();
  const startUtcMs = Date.UTC(year, month, day, -8, 0, 0, 0);
  const endUtcMs = Date.UTC(year, month, day + 1, -8, 0, 0, 0);
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString()
  };
}

async function getPeakChallengeDailyAttemptCount(supabase: any, email: string) {
  const { startIso, endIso } = getTaipeiDayBounds();
  const { count, error } = await supabase
    .from("peak_challenge_attempt_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_email", email.trim().toLowerCase())
    .gte("started_at", startIso)
    .lt("started_at", endIso);

  if (error) throw error;
  return count ?? 0;
}

async function consumePeakChallengeAttemptOrThrow(supabase: any, actor: VerifiedUser, visitorId?: string | null) {
  const normalizedEmail = actor.email?.trim().toLowerCase();
  if (!normalizedEmail || isPeakChallengeOwner(normalizedEmail)) {
    return { remainingAttempts: null as number | null };
  }

  const usedAttempts = await getPeakChallengeDailyAttemptCount(supabase, normalizedEmail);
  if (usedAttempts >= DAILY_PEAK_CHALLENGE_LIMIT) {
    const error = new Error(`今日巔峰賽挑戰次數已用完（每天最多 ${DAILY_PEAK_CHALLENGE_LIMIT} 次）。`);
    (error).name = "PeakChallengeLimitError";
    throw error;
  }

  const { error } = await supabase.from("peak_challenge_attempt_logs").insert({
    user_id: actor.id,
    user_email: normalizedEmail,
    visitor_id: visitorId ?? null
  });
  if (error) throw error;

  return {
    remainingAttempts: Math.max(DAILY_PEAK_CHALLENGE_LIMIT - usedAttempts - 1, 0)
  };
}

async function getPeakChallengeAttemptStatus(supabase: any, actor: VerifiedUser) {
  const normalizedEmail = actor.email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return {
      dailyLimit: DAILY_PEAK_CHALLENGE_LIMIT,
      usedAttempts: 0,
      remainingAttempts: DAILY_PEAK_CHALLENGE_LIMIT,
      isOwnerBypass: false
    };
  }
  if (isPeakChallengeOwner(normalizedEmail)) {
    return {
      dailyLimit: DAILY_PEAK_CHALLENGE_LIMIT,
      usedAttempts: 0,
      remainingAttempts: null as number | null,
      isOwnerBypass: true
    };
  }
  const usedAttempts = await getPeakChallengeDailyAttemptCount(supabase, normalizedEmail);
  return {
    dailyLimit: DAILY_PEAK_CHALLENGE_LIMIT,
    usedAttempts,
    remainingAttempts: Math.max(DAILY_PEAK_CHALLENGE_LIMIT - usedAttempts, 0),
    isOwnerBypass: false
  };
}

async function getVerifiedUser(supabase: any, accessToken?: string | null): Promise<VerifiedUser | null> {
  if (!accessToken) return null;
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.id) return null;

  const displayName =
    typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name.trim().slice(0, 24)
      : "";

  return {
    id: data.user.id,
    email: data.user.email,
    label: displayName || data.user.email?.split("@")[0] || "已登入使用者"
  };
}

function requestAccessTokenFromHeadersOrNull(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

async function loadClassificationOverrides(supabase: any) {
  const { data, error } = await supabase
    .from("question_classification_overrides")
    .select("question_id, subject, chapter, section, source_report_id, updated_at");

  if (error) {
    return {} as Record<string, QuestionClassificationOverride>;
  }

  return Object.fromEntries(
    ((data ?? []) as Record<string, string>[]).map((row) => [
      row.question_id,
      {
        questionId: row.question_id,
        subject: row.subject as SubjectName,
        chapter: row.chapter,
        section: row.section,
        sourceReportId: row.source_report_id ? String(row.source_report_id) : undefined,
        updatedAt: row.updated_at ?? new Date().toISOString()
      }
    ])
  );
}

function buildPastExamSelectionPrompt(candidates: PeakCandidateSummary[], count: number) {
  const lines = candidates.map((candidate, index) =>
    `${index + 1}. ${candidate.questionId}｜${candidate.subject}｜${candidate.chapter} / ${candidate.section}｜risk ${candidate.riskScore ?? 0}\n考點：${candidate.testedConcept ?? ""}`
  );

  return [
    "你是台灣醫學系國考刷題教練。",
    "現在要替一位錯題很多的挑戰者，從『尚未做過、但和他弱點高度相關』的候選考古題中挑出最可能再次失手的題目。",
    `請只挑 ${Math.min(count, candidates.length)} 題，寧可保守，不要挑太簡單或已經太直白的題。`,
    "優先考慮：",
    "1. 題目來自挑戰者弱點章節，但不是他做過的原題",
    "2. 題幹概念容易混淆",
    "3. 選項之間辨識度低、容易被誘答",
    "4. 真的像國考會出的高鑑別度題",
    "請只輸出 JSON，不要輸出 markdown。",
    "{",
    '  "selectedIds": ["MOEX-...","MOEX-..."],',
    '  "reason": "一句話說明這批考古題主要在卡什麼弱點"',
    "}",
    "",
    "候選題：",
    ...lines
  ].join("\n");
}

function parseSelectedIds(raw: string) {
  const cleaned = normalizeJsonLikeInput(stripJsonCodeFence(raw));

  try {
    const parsed = JSON.parse(cleaned) as { selectedIds?: string[]; reason?: string };
    return {
      selectedIds: (parsed.selectedIds ?? []).map((item) => item.trim()).filter(Boolean),
      reason: parsed.reason?.trim() ?? ""
    };
  } catch {
    const idMatches = Array.from(new Set(cleaned.match(/MOEX-[A-Z0-9-]+-Q\d{3}/g) ?? []));
    return {
      selectedIds: idMatches,
      reason: ""
    };
  }
}

function buildHardPastCandidateSummaries(
  questions: Question[],
  statsRows: QuestionAccuracyRow[],
  doneQuestionIds: Set<string>
) {
  const statsMap = new Map(statsRows.map((row) => [row.question_id, row] as const));

  return questions
    .filter((question) => !doneQuestionIds.has(question.id))
    .map((question) => {
      const stats = statsMap.get(question.id);
      return {
        questionId: question.id,
        subject: question.subject,
        chapter: question.chapter,
        section: question.section,
        stem: question.stem,
        testedConcept: question.testedConcept,
        riskScore:
          stats && stats.total_attempts > 0
            ? (100 - Number(stats.correct_rate ?? 0)) + Math.min(stats.total_attempts, 20)
            : 0,
        wrongCount: stats ? Math.max(stats.total_attempts - Number(stats.correct_attempts ?? 0), 0) : 0,
        lowConfidenceCount: 0,
        sourceType: question.sourceType
      } satisfies PeakCandidateSummary;
    })
    .sort(
      (left, right) =>
        (right.riskScore ?? 0) - (left.riskScore ?? 0) ||
        (right.wrongCount ?? 0) - (left.wrongCount ?? 0) ||
        left.questionId.localeCompare(right.questionId)
    );
}

function buildWeaknessPastCandidateSummaries(
  questions: Question[],
  weaknessPool: PeakCandidateSummary[],
  doneQuestionIds: Set<string>
) {
  const excludedIds = new Set(weaknessPool.map((candidate) => candidate.questionId));
  const weaknessByChapter = new Map<string, number>();
  const weaknessBySection = new Map<string, number>();

  for (const candidate of weaknessPool) {
    const chapterKey = `${candidate.subject}__${candidate.chapter}`;
    const sectionKey = `${candidate.subject}__${candidate.chapter}__${candidate.section}`;
    const weight = (candidate.riskScore ?? 0) + (candidate.wrongCount ?? 0) * 3 + (candidate.lowConfidenceCount ?? 0) * 2;
    weaknessByChapter.set(chapterKey, (weaknessByChapter.get(chapterKey) ?? 0) + weight);
    weaknessBySection.set(sectionKey, (weaknessBySection.get(sectionKey) ?? 0) + weight);
  }

  return questions
    .filter((question) => !doneQuestionIds.has(question.id) && !excludedIds.has(question.id))
    .map((question) => {
      const chapterKey = `${question.subject}__${question.chapter}`;
      const sectionKey = `${question.subject}__${question.chapter}__${question.section}`;
      const chapterWeight = weaknessByChapter.get(chapterKey) ?? 0;
      const sectionWeight = weaknessBySection.get(sectionKey) ?? 0;
      const conceptWeight = weaknessPool.reduce((sum, candidate) => {
        if (!candidate.testedConcept || !question.testedConcept) return sum;
        return question.testedConcept.includes(candidate.testedConcept) ||
          candidate.testedConcept.includes(question.testedConcept)
          ? sum + 6
          : sum;
      }, 0);
      return {
        questionId: question.id,
        subject: question.subject,
        chapter: question.chapter,
        section: question.section,
        stem: question.stem,
        testedConcept: question.testedConcept,
        riskScore: chapterWeight * 1.2 + sectionWeight * 0.6 + conceptWeight,
        wrongCount: 0,
        lowConfidenceCount: 0,
        sourceType: question.sourceType
      } satisfies PeakCandidateSummary;
    })
    .filter((candidate) => (candidate.riskScore ?? 0) > 0)
    .sort(
      (left, right) =>
        (right.riskScore ?? 0) - (left.riskScore ?? 0) ||
        left.questionId.localeCompare(right.questionId)
    );
}

function buildAIGenerationPrompt(input: {
  count: number;
  candidatePool: PeakCandidateSummary[];
  selectedPastQuestions: Question[];
}) {
  const weaknessLines = input.candidatePool.slice(0, 14).map((candidate, index) =>
    `${index + 1}. ${candidate.subject}｜${candidate.chapter} / ${candidate.section}｜risk ${candidate.riskScore ?? 0}\n考點：${candidate.testedConcept ?? ""}`
  );
  const pastLines = input.selectedPastQuestions.map((question, index) =>
    `${index + 1}. ${question.subject}｜${question.chapter} / ${question.section}｜考點：${question.testedConcept}`
  );

  return [
    "你是台灣醫學系國考命題助手，現在要替『巔峰賽模式』出新的難題。",
    `請輸出 ${input.count} 題全新的單選題，主題要集中在挑戰者最容易錯的章節，但不一定要卡在同一個狹窄弱點。`,
    "這些題要符合：",
    "1. 必須像國考考古題會出的難題，不要像隨便延伸的冷知識。",
    "2. 題幹可以有深度，但不要出成單靠刁鑽敘述取勝。",
    "3. 選項一定要有誘答力：錯誤選項要看起來 plausible，不能一眼排除。",
    "4. 錯誤選項最好來自常見混淆點、相鄰概念、相似解剖/生理/病理名詞。",
    "5. 請避免和挑戰者做過或已選進本輪的考古題太像，不要只是換字重寫。",
    "6. 一律輸出 4 選 1 或 5 選 1 的單選題；沒有 E 就留空字串。",
    "7. explanation 與 option_analysis 要完整，並直接說明每個誘答點為什麼容易誤選。",
    "8. 只輸出 JSON 陣列，不要輸出 markdown、不要輸出任何前後說明。",
    "9. 不要重寫我給你的原題題幹；請基於弱點區塊重新設計全新的臨床或概念情境。",
    "10. 優先維持同章節，但可以換不同小節、不同 tested concept，讓題目更有變化。",
    "",
    "[",
    "  {",
    '    "subject": "解剖學",',
    '    "chapter": "章節",',
    '    "section": "小節",',
    '    "question": "題幹全文",',
    '    "options": { "A": "選項 A", "B": "選項 B", "C": "選項 C", "D": "選項 D", "E": "" },',
    '    "answer": "A",',
    '    "accepted_answers": ["A"],',
    '    "answer_credit_type": "standard",',
    '    "tested_concept": "核心考點",',
    '    "explanation": "完整詳解",',
    '    "option_analysis": { "A": "A 解析", "B": "B 解析", "C": "C 解析", "D": "D 解析", "E": "" },',
    '    "memory_tip": "一句記憶法"',
    "  }",
    "]",
    "",
    "挑戰者最近常錯的弱點區塊：",
    ...weaknessLines,
    "",
    "這次已經選進巔峰賽的考古題（請拿來避免重複出太像的題）：",
    ...(pastLines.length > 0 ? pastLines : ["目前沒有選進考古題"])
  ].join("\n");
}

function toValidOptionText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toValidOptionKey(value: unknown): value is OptionKey {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
}

function normalizeImportedAnswerType(raw: ImportedAIQuestionRaw) {
  const value = String(raw.answer_credit_type ?? raw.answerCreditType ?? "standard").trim();
  if (value === "all_credit") return "all_credit" as const;
  if (value === "multiple_accepted" || value === "multiple_answers") {
    return "multiple_accepted" as const;
  }
  return "standard" as const;
}

function normalizeImportedSubject(subject?: string): SubjectName {
  const value = subject?.trim() ?? "";
  if (ALLOWED_SUBJECTS.has(value as SubjectName)) return value as SubjectName;
  if (value.includes("解剖")) return "解剖學";
  if (value.includes("生理")) return "生理學";
  if (value.includes("生化") || value.includes("生物化學")) return "生物化學";
  if (value.includes("藥理")) return "藥理學";
  if (value.includes("病理")) return "病理學";
  if (value.includes("微生物") || value.includes("免疫")) return "微生物免疫學";
  if (value.includes("胚胎")) return "胚胎學";
  if (value.includes("組織")) return "組織學";
  if (value.includes("寄生蟲")) return "寄生蟲學";
  if (value.includes("公衛") || value.includes("公共衛生")) return "公共衛生學";
  if (value.includes("細胞")) return "細胞生物學";
  if (value.includes("分子")) return "分子生物學";
  return "其他醫學一";
}

function normalizeGeneratedPeakQuestions(rawJson: string, paperCode: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizeJsonLikeInput(stripJsonCodeFence(rawJson)));
  } catch {
    throw new Error("AI 新題格式不完整，請再試一次。");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI 沒有成功產出可用的新題。");
  }

  return parsed.map((item, index) => {
    const raw = (item ?? {}) as ImportedAIQuestionRaw;
    const stem = String(raw.question ?? raw.stem ?? "").trim();
    if (!stem) {
      throw new Error(`AI 第 ${index + 1} 題缺少題幹。`);
    }

    const options = raw.options ?? {};
    const normalizedOptions = {
      A: toValidOptionText(options.A),
      B: toValidOptionText(options.B),
      C: toValidOptionText(options.C),
      D: toValidOptionText(options.D),
      E: toValidOptionText(options.E) || undefined
    };
    if (!normalizedOptions.A || !normalizedOptions.B || !normalizedOptions.C || !normalizedOptions.D) {
      throw new Error(`AI 第 ${index + 1} 題缺少完整選項。`);
    }

    const answer = String(raw.answer ?? "").trim().toUpperCase();
    if (!toValidOptionKey(answer)) {
      throw new Error(`AI 第 ${index + 1} 題答案不是合法選項。`);
    }

    const answerCreditType = normalizeImportedAnswerType(raw);
    const acceptedAnswersSource = raw.accepted_answers ?? raw.acceptedAnswers ?? [answer];
    const acceptedAnswers = acceptedAnswersSource
      .map((value) => String(value).trim().toUpperCase())
      .filter((value): value is OptionKey => toValidOptionKey(value));

    const optionAnalysisSource = raw.option_analysis ?? raw.optionAnalysis ?? {};
    const optionAnalysis = Object.fromEntries(
      Object.entries(optionAnalysisSource)
        .filter(([key, value]) => toValidOptionKey(key) && typeof value === "string" && value.trim())
        .map(([key, value]) => [key, value.trim()])
    ) as Partial<Record<OptionKey, string>>;

    return {
      id: `${paperCode}-AIQ${String(index + 1).padStart(3, "0")}`,
      subject: normalizeImportedSubject(raw.subject),
      chapter: raw.chapter?.trim() || "巔峰賽 AI 新題",
      section: raw.section?.trim() || "巔峰賽 AI 新題",
      stem,
      options: normalizedOptions,
      answer,
      acceptedAnswers:
        answerCreditType === "multiple_accepted" && acceptedAnswers.length > 0
          ? acceptedAnswers
          : undefined,
      answerCreditType,
      explanation: raw.explanation?.trim() || "尚未提供詳解。",
      testedConcept: raw.tested_concept?.trim() || raw.testedConcept?.trim() || "巔峰賽 AI 新題",
      optionAnalysis: Object.keys(optionAnalysis).length > 0 ? optionAnalysis : undefined,
      memoryTip: raw.memory_tip?.trim() || raw.memoryTip?.trim() || undefined,
      difficulty: "hard" as const,
      source: "ai-generated" as const,
      sourceType: "AI_GENERATED" as const,
      sourceCitation: `巔峰賽 AI 新題：${paperCode}`
    } satisfies Question;
  });
}

async function fetchReusableSharedAIQuestions(
  supabase: any,
  input: {
    practicedSubjects: SubjectName[];
    candidatePool: PeakCandidateSummary[];
    doneQuestionIds: Set<string>;
    limit: number;
  }
) {
  if (input.limit <= 0) return [] as Question[];

  const chapterSet = new Set(input.candidatePool.map((candidate) => `${candidate.subject}__${candidate.chapter}`));
  const sectionSet = new Set(
    input.candidatePool.map((candidate) => `${candidate.subject}__${candidate.chapter}__${candidate.section}`)
  );

  const { data, error } = await supabase
    .from("shared_ai_questions")
    .select("id, feature, subject, chapter, section, tested_concept, question_payload, source_model, usage_count, last_used_at, created_at, updated_at")
    .eq("feature", "peak_challenge")
    .order("usage_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    if (String(error.message ?? "").includes("shared_ai_questions")) {
      return [] as Question[];
    }
    throw error;
  }

  const rows = ((data ?? []) as SharedAIQuestionRow[]).filter((row) => {
    if (input.practicedSubjects.length > 0 && !input.practicedSubjects.includes(row.subject)) return false;
    if (input.doneQuestionIds.has(row.id)) return false;
    const chapterKey = `${row.subject}__${row.chapter}`;
    const sectionKey = `${row.subject}__${row.chapter}__${row.section}`;
    return chapterSet.has(chapterKey) || sectionSet.has(sectionKey);
  });

  return rows.slice(0, input.limit).map((row) => ({
    ...(row.question_payload as Question),
    id: row.id
  }));
}

async function upsertSharedAIQuestions(supabase: any, questions: Question[], model: string) {
  if (questions.length === 0) return;

  const rows = questions.map((question) => ({
    id: question.id,
    feature: "peak_challenge",
    subject: question.subject,
    chapter: question.chapter,
    section: question.section,
    tested_concept: question.testedConcept ?? null,
    question_payload: question,
    source_model: model,
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase.from("shared_ai_questions").upsert(rows, { onConflict: "id" });
  if (error && !String(error.message ?? "").includes("shared_ai_questions")) {
    throw error;
  }
}

async function bumpSharedAIQuestionUsage(supabase: any, questions: Question[]) {
  if (questions.length === 0) return;
  const ids = questions.map((question) => question.id);
  const { data, error } = await supabase
    .from("shared_ai_questions")
    .select("id, usage_count")
    .in("id", ids);

  if (error) {
    if (String(error.message ?? "").includes("shared_ai_questions")) return;
    throw error;
  }

  const rows = ((data ?? []) as { id: string; usage_count?: number | null }[]).map((row) => ({
    id: row.id,
    usage_count: (row.usage_count ?? 0) + 1,
    last_used_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  if (rows.length === 0) return;
  const { error: upsertError } = await supabase.from("shared_ai_questions").upsert(rows, { onConflict: "id" });
  if (upsertError && !String(upsertError.message ?? "").includes("shared_ai_questions")) {
    throw upsertError;
  }
}

function mixPeakQuestions(pastQuestions: Question[], aiQuestions: Question[], limit = TARGET_QUESTION_COUNT) {
  const result: Question[] = [];
  const pastPool = [...pastQuestions];
  const aiPool = [...aiQuestions];

  while (pastPool.length > 0 || aiPool.length > 0) {
    if (pastPool.length > 0) {
      result.push(pastPool.shift() as Question);
    }
    if (aiPool.length > 0) {
      result.push(aiPool.shift() as Question);
    }
  }

  return result.slice(0, limit);
}

function aggregateLeaderboard(rows: PeakChallengeRunRow[]): PeakChallengeLeaderboardEntry[] {
  const grouped = new Map<string, PeakChallengeLeaderboardEntry>();

  for (const row of rows) {
    const key = row.user_email?.trim().toLowerCase() || row.user_id || row.participant_label;
    const current = grouped.get(key);
    const score = Number(row.score ?? 0);
    const latestScore = score;
    const latestCompletedAt = row.completed_at;

    if (!current) {
      grouped.set(key, {
        label: row.participant_label,
        userEmail: row.user_email ?? undefined,
        bestScore: score,
        runCount: 1,
        latestScore,
        latestCompletedAt
      });
      continue;
    }

    const nextRunCount = current.runCount + 1;
    grouped.set(key, {
      ...current,
      bestScore: Math.max(current.bestScore, score),
      runCount: nextRunCount,
      latestScore:
        !current.latestCompletedAt || latestCompletedAt > current.latestCompletedAt
          ? latestScore
          : current.latestScore,
      latestCompletedAt:
        !current.latestCompletedAt || latestCompletedAt > current.latestCompletedAt
          ? latestCompletedAt
          : current.latestCompletedAt
    });
  }

  return [...grouped.values()].sort((left, right) =>
    right.bestScore - left.bestScore ||
    right.runCount - left.runCount ||
    (right.latestCompletedAt ?? "").localeCompare(left.latestCompletedAt ?? "")
  );
}

async function insertAIUsageLog(
  supabase: any,
  row: {
    rate_key: string;
    visitor_id?: string | null;
    user_email?: string | null;
    question_id: string;
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    used_at: string;
  }
) {
  const { error } = await supabase.from("ai_explanation_usage_logs").insert(row);
  if (!error) return;

  const fallbackRow = {
    rate_key: row.rate_key,
    visitor_id: row.visitor_id ?? null,
    user_email: row.user_email ?? null,
    question_id: row.question_id,
    model: row.model,
    used_at: row.used_at
  };
  const { error: fallbackError } = await supabase.from("ai_explanation_usage_logs").insert(fallbackRow);
  if (fallbackError) {
    console.error("Peak challenge AI usage log skipped:", fallbackError);
  }
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法載入巔峰賽榜單。" },
      { status: 503 }
    );
  }

  try {
    const accessToken = requestAccessTokenFromHeadersOrNull(request);
    const { data, error } = await supabase
      .from("peak_challenge_runs")
      .select("session_id, user_id, user_email, participant_label, score, total_answered, question_ids, source_breakdown, completed_at, created_at")
      .order("completed_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const actor = await getVerifiedUser(supabase, accessToken);
    const attemptStatus = actor ? await getPeakChallengeAttemptStatus(supabase, actor) : null;

    return NextResponse.json({
      ok: true,
      leaderboard: aggregateLeaderboard((data ?? []) as PeakChallengeRunRow[]),
      attemptStatus
    });
  } catch (error) {
    const message = formatPeakChallengeErrorMessage(error);
    const status =
      message.includes("今日巔峰賽挑戰次數已用完") || message.includes("AI 功能已被暫停")
        ? 429
        : 500;
    return NextResponse.json(
      { ok: false, message },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法使用巔峰賽。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as GeneratePeakBody | SubmitPeakBody | StartGateBody | null;
    if (!body?.action) {
      return NextResponse.json({ ok: false, message: "缺少操作類型。" }, { status: 400 });
    }

    if (body.action === "start_gate") {
      const actor = await getVerifiedUser(supabase, body.accessToken);
      if (!actor?.id || !actor.email) {
        return NextResponse.json(
          { ok: false, message: "請先登入帳號，才能開始巔峰賽。" },
          { status: 401 }
        );
      }

      const activeBan = await getActiveAIAccountBan(supabase, actor.email);
      if (activeBan) {
        return NextResponse.json(
          {
            ok: false,
            message: `這個帳號的 AI 功能已被暫停到 ${new Date(activeBan.banned_until).toLocaleString("zh-TW")} 。`
          },
          { status: 429 }
        );
      }

      const attemptStatus = await consumePeakChallengeAttemptOrThrow(supabase, actor, body.visitorId);
      return NextResponse.json({ ok: true, remainingAttempts: attemptStatus.remainingAttempts });
    }

    if (body.action === "generate") {
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          { ok: false, message: "OPENAI_API_KEY 尚未設定，暫時無法產生巔峰賽題目。" },
          { status: 500 }
        );
      }

      const actor = await getVerifiedUser(supabase, body.accessToken);
      if (!actor?.id || !actor.email) {
        return NextResponse.json(
          { ok: false, message: "請先登入帳號，才能開始巔峰賽。" },
          { status: 401 }
        );
      }

      const activeBan = await getActiveAIAccountBan(supabase, actor.email);
      if (activeBan) {
        return NextResponse.json(
          {
            ok: false,
            message: `這個帳號的 AI 功能已被暫停到 ${new Date(activeBan.banned_until).toLocaleString("zh-TW")} 。`
          },
          { status: 429 }
        );
      }

      const classificationOverrides = await loadClassificationOverrides(supabase);
      const bank = getCanonicalQuestionBank(classificationOverrides);
      const pastExamBank = bank.filter((question) => question.sourceType === "MOEX_PAST_EXAM");
      const pastExamMap = new Map(pastExamBank.map((question) => [question.id, question] as const));
      const doneQuestionIds = new Set((body.doneQuestionIds ?? []).filter(Boolean));
      const desiredCount = Math.max(1, Math.min(body.desiredCount ?? TARGET_QUESTION_COUNT, TARGET_QUESTION_COUNT));
      const existingSourceBreakdown = body.existingSourceBreakdown ?? {};
      const practicedSubjects =
        (body.practicedSubjects ?? []).filter((subject): subject is SubjectName => ALLOWED_SUBJECTS.has(subject)) ||
        [];
      const nextQuestionIndex = Math.max(0, body.nextQuestionIndex ?? doneQuestionIds.size);
      let remainingAttempts: number | null = null;
      if (body.consumeAttempt && nextQuestionIndex === 0) {
        const attemptStatus = await consumePeakChallengeAttemptOrThrow(supabase, actor, body.visitorId);
        remainingAttempts = attemptStatus.remainingAttempts;
      }
      const rawCandidates = (body.wrongPoolCandidates ?? [])
        .filter((candidate) => candidate && typeof candidate.questionId === "string")
        .sort(
          (left, right) =>
            (right.riskScore ?? 0) - (left.riskScore ?? 0) ||
            (right.wrongCount ?? 0) - (left.wrongCount ?? 0) ||
            (right.lowConfidenceCount ?? 0) - (left.lowConfidenceCount ?? 0)
        );
      const preferPastExamForThisPull =
        desiredCount === 1
          ? (existingSourceBreakdown.pastExam ?? 0) <= (existingSourceBreakdown.aiGenerated ?? 0)
          : true;
      const shouldUseNewHardTrack = nextQuestionIndex % 2 === 0;

      const practicedPastExamQuestions =
        practicedSubjects.length > 0
          ? pastExamBank.filter((question) => practicedSubjects.includes(question.subject))
          : pastExamBank;
      const { data: accuracyData } = await supabase
        .from("question_accuracy_stats")
        .select("question_id, total_attempts, correct_attempts, correct_rate");
      const hardPastCandidateSummaries = buildHardPastCandidateSummaries(
        practicedPastExamQuestions,
        ((accuracyData ?? []) as QuestionAccuracyRow[]).filter((row) => Number(row.total_attempts ?? 0) > 0),
        doneQuestionIds
      ).slice(0, 36);
      const weaknessPastCandidateSummaries = buildWeaknessPastCandidateSummaries(
        pastExamBank,
        rawCandidates,
        doneQuestionIds
      ).slice(0, 36);
      const targetPastExamCount =
        desiredCount === 1
          ? shouldUseNewHardTrack
            ? Math.min(hardPastCandidateSummaries.length > 0 ? 1 : 0, 1)
            : preferPastExamForThisPull
              ? 1
              : 0
          : Math.min(Math.ceil(desiredCount / 2), PAST_EXAM_TARGET_COUNT);

      const pastExamCandidateSummaries = shouldUseNewHardTrack
        ? hardPastCandidateSummaries
        : weaknessPastCandidateSummaries;
      const aiFallbackPastCandidateSummaries = Array.from(
        new Map(
          [...hardPastCandidateSummaries, ...weaknessPastCandidateSummaries].map((candidate) => [
            candidate.questionId,
            candidate
          ])
        ).values()
      ).sort(
        (left, right) =>
          (right.riskScore ?? 0) - (left.riskScore ?? 0) ||
          (right.wrongCount ?? 0) - (left.wrongCount ?? 0) ||
          left.questionId.localeCompare(right.questionId)
      );

      let selectedPastQuestions: Question[] = [];
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalTokens = 0;
      let model = "gpt-5-mini";
      if (targetPastExamCount > 0 && pastExamCandidateSummaries.length > 0) {
        const selection = await createOpenAIText(
          buildPastExamSelectionPrompt(pastExamCandidateSummaries, targetPastExamCount),
          500,
          "gpt-5-mini"
        );
        totalInputTokens += selection.usage.inputTokens;
        totalOutputTokens += selection.usage.outputTokens;
        totalTokens += selection.usage.totalTokens;
        model = selection.model;
        const parsed = parseSelectedIds(selection.text);
        const seen = new Set<string>();
        selectedPastQuestions = parsed.selectedIds
          .map((id) => pastExamMap.get(id))
          .filter((question): question is Question => Boolean(question))
          .filter((question) => {
            if (seen.has(question.id)) return false;
            seen.add(question.id);
            return !doneQuestionIds.has(question.id);
          })
          .slice(0, targetPastExamCount);

        if (selectedPastQuestions.length < targetPastExamCount) {
          for (const candidate of pastExamCandidateSummaries) {
            const fallback = pastExamMap.get(candidate.questionId);
            if (!fallback || seen.has(fallback.id) || doneQuestionIds.has(fallback.id)) continue;
            seen.add(fallback.id);
            selectedPastQuestions.push(fallback);
            if (selectedPastQuestions.length >= targetPastExamCount) break;
          }
        }
      }

      const aiQuestionCount = Math.max(desiredCount - selectedPastQuestions.length, 0);
      const reusableAIQuestions = await fetchReusableSharedAIQuestions(supabase, {
        practicedSubjects,
        candidatePool: (shouldUseNewHardTrack ? hardPastCandidateSummaries : weaknessPastCandidateSummaries).slice(0, 24),
        doneQuestionIds,
        limit: aiQuestionCount
      });
      const remainingAiQuestionCount = Math.max(aiQuestionCount - reusableAIQuestions.length, 0);
      let generatedAIQuestions: Question[] = [];
      let fallbackPastQuestions: Question[] = [];
      if (remainingAiQuestionCount > 0) {
        try {
          const generation = await createOpenAIText(
            buildAIGenerationPrompt({
              count: remainingAiQuestionCount,
              candidatePool: (shouldUseNewHardTrack ? hardPastCandidateSummaries : weaknessPastCandidateSummaries).slice(0, 18),
              selectedPastQuestions
            }),
            Math.max(2600, remainingAiQuestionCount * 1200),
            "gpt-5-mini"
          );
          totalInputTokens += generation.usage.inputTokens;
          totalOutputTokens += generation.usage.outputTokens;
          totalTokens += generation.usage.totalTokens;
          model = generation.model;
          generatedAIQuestions = normalizeGeneratedPeakQuestions(generation.text, `PEAK-${Date.now()}`);
          await upsertSharedAIQuestions(supabase, generatedAIQuestions, model);
        } catch {
          const seenPastIds = new Set(selectedPastQuestions.map((question) => question.id));
          for (const candidate of aiFallbackPastCandidateSummaries) {
            const fallback = pastExamMap.get(candidate.questionId);
            if (!fallback || doneQuestionIds.has(fallback.id) || seenPastIds.has(fallback.id)) continue;
            seenPastIds.add(fallback.id);
            fallbackPastQuestions.push(fallback);
            if (fallbackPastQuestions.length >= remainingAiQuestionCount) break;
          }
        }
      }
      await bumpSharedAIQuestionUsage(supabase, reusableAIQuestions);
      generatedAIQuestions = [...reusableAIQuestions, ...generatedAIQuestions];

      const combinedQuestions = mixPeakQuestions(
        [...selectedPastQuestions, ...fallbackPastQuestions],
        generatedAIQuestions,
        desiredCount
      );
      if (combinedQuestions.length === 0) {
        return NextResponse.json(
          { ok: false, message: "目前還抓不出可用的巔峰賽題目，請先再累積一些錯題後重試。" },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();
      await insertAIUsageLog(supabase, {
        rate_key: `peak-challenge:${actor.email.trim().toLowerCase()}`,
        visitor_id: body.visitorId ?? null,
        user_email: actor.email,
        question_id: `${AI_USAGE_PREFIX}${combinedQuestions[0]?.id ?? "BATCH"}`,
        model,
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        total_tokens: totalTokens,
        used_at: now
      });

      return NextResponse.json({
        ok: true,
        sessionTitle: "巔峰賽",
        questionIds: combinedQuestions.map((question) => question.id),
        questions: combinedQuestions,
        remainingAttempts,
        sourceBreakdown: {
          pastExam: selectedPastQuestions.length + fallbackPastQuestions.length,
          aiGenerated: generatedAIQuestions.length
        }
      });
    }

    if (body.action === "submit") {
      const actor = await getVerifiedUser(supabase, body.accessToken);
      if (!actor?.id || !actor.email) {
        return NextResponse.json(
          { ok: false, message: "請先登入帳號，才能送出巔峰賽成績。" },
          { status: 401 }
        );
      }

      const session = body.session;
      if (!session?.id || !session.attempts?.length) {
        return NextResponse.json({ ok: false, message: "缺少巔峰賽作答紀錄。" }, { status: 400 });
      }

      const score = session.attempts.filter((attempt) => attempt.isCorrect).length;
      const totalAnswered = session.attempts.length;
      const questionIds = (session.questionOrder ?? []).filter(Boolean);
      const sourceBreakdown = {
        pastExam:
          (session.generatedQuestions ?? []).filter((question) => question.sourceType === "MOEX_PAST_EXAM").length,
        aiGenerated:
          (session.generatedQuestions ?? []).filter((question) => question.sourceType === "AI_GENERATED").length
      };
      const completedAt = session.completedAt ?? new Date().toISOString();

      const { error } = await supabase.from("peak_challenge_runs").upsert(
        {
          session_id: session.id,
          user_id: actor.id,
          user_email: actor.email,
          participant_label: actor.label,
          score,
          total_answered: totalAnswered,
          question_ids: questionIds,
          source_breakdown: sourceBreakdown,
          completed_at: completedAt
        },
        { onConflict: "session_id" }
      );

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: "不支援的巔峰賽操作。" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: formatPeakChallengeErrorMessage(error) },
      { status: 500 }
    );
  }
}
