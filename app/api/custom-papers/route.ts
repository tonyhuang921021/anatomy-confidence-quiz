import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import {
  getCanonicalQuestionBank
} from "@/data/med1QuestionBank";
import { MED1_SUBJECTS, MED2_SUBJECTS } from "@/data/subjectRegistry";
import type {
  CustomPaperDetail,
  CustomPaperDifficulty,
  CustomPaperParticipant,
  CustomPaperSummary,
  Question,
  QuestionClassificationOverride,
  QuizSession,
  SubjectName
} from "@/types/quiz";

const PAPER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAPER_CODE_LENGTH = 5;
const PUBLIC_PAPER_LIMIT = 30;
const ALLOWED_SUBJECTS = new Set<SubjectName>([...MED1_SUBJECTS, ...MED2_SUBJECTS]);

type CustomPaperRow = {
  paper_code: string;
  name?: string | null;
  question_ids: string[];
  subject_filters?: string[] | null;
  difficulty: CustomPaperDifficulty;
  is_public: boolean;
  created_by_user_id?: string | null;
  created_by_email?: string | null;
  created_by_label?: string | null;
  visitor_id?: string | null;
  created_at: string;
};

type CustomPaperAttemptRow = {
  paper_code: string;
  session_id: string;
  user_id?: string | null;
  user_email?: string | null;
  participant_label: string;
  visitor_id?: string | null;
  correct_count: number;
  total_count: number;
  accuracy_rate: number;
  completed_at: string;
  created_at?: string | null;
};

type QuestionAccuracyStatRow = {
  question_id: string;
  total_attempts: number;
  correct_attempts: number;
  correct_rate: number;
};

type GenerateBody = {
  action: "generate";
  accessToken?: string | null;
  visitorId?: string | null;
  selectedSubjects?: string[];
  difficulty?: CustomPaperDifficulty;
  name?: string;
  isPublic?: boolean;
  doneQuestionIds?: string[];
};

type GenerateAISearchBody = {
  action: "generate_ai_search";
  accessToken?: string | null;
  visitorId?: string | null;
  selectedSubjects?: string[];
  query?: string;
  name?: string;
  isPublic?: boolean;
  yearFrom?: number;
  yearTo?: number;
};

type SubmitAttemptBody = {
  action: "submit_attempt";
  accessToken?: string | null;
  visitorId?: string | null;
  paperCode?: string;
  session?: QuizSession;
};

type UpdateMetadataBody = {
  action: "update_metadata";
  accessToken?: string | null;
  visitorId?: string | null;
  paperCode?: string;
  name?: string;
  isPublic?: boolean;
};

type AISearchPlan = {
  title?: string;
  searchTerms?: string[];
  relatedConcepts?: string[];
};

type AIUsageLogRow = {
  rate_key: string;
  visitor_id?: string | null;
  user_email?: string | null;
  question_id: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  used_at: string;
};

const AI_SEARCH_USAGE_PREFIX = "AI_SEARCH:";

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

async function insertAIUsageLog(supabase: any, row: AIUsageLogRow) {
  const usageTable = supabase.from("ai_explanation_usage_logs") as any;
  const { error } = await usageTable.insert(row);
  if (!error) {
    return;
  }

  const fallbackRow = {
    rate_key: row.rate_key,
    visitor_id: row.visitor_id ?? null,
    user_email: row.user_email ?? null,
    question_id: row.question_id,
    model: row.model,
    used_at: row.used_at
  };
  const { error: fallbackError } = await usageTable.insert(fallbackRow);
  if (fallbackError) {
    console.error("AI search usage log skipped:", fallbackError);
  }
}

function formatCustomPaperErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "自訂卷操作失敗";

  if (
    message.includes("custom_papers") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  ) {
    return "Supabase 還沒建立 custom_papers 資料表，請先跑自訂卷模式那段 SQL。";
  }

  if (
    message.includes("custom_paper_attempts") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  ) {
    return "Supabase 還沒建立 custom_paper_attempts 資料表，請先跑自訂卷模式那段 SQL。";
  }

  if (
    message.includes("question_accuracy_stats") &&
    (message.includes("does not exist") || message.includes("Could not find"))
  ) {
    return "Supabase 缺少 question_accuracy_stats，先把統計相關 SQL 跑完再用自訂卷模式。";
  }

  return message;
}

function getAllowedSubjectList(subjects: string[] = []) {
  return Array.from(
    new Set(
      subjects.filter((subject): subject is SubjectName =>
        ALLOWED_SUBJECTS.has(subject as SubjectName)
      )
    )
  );
}

function stripJsonCodeFence(value: string) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function normalizeSearchText(text: string) {
  return text.toLowerCase().trim();
}

function compactSearchText(text: string) {
  return text.toLowerCase().replace(/[\s\-_/，。、；：（）()]+/g, "");
}

function sample<T>(items: T[], count: number) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, count);
}

function pickByPriority(
  tiers: Question[][],
  count: number
) {
  const result: Question[] = [];
  const seen = new Set<string>();

  for (const tier of tiers) {
    if (result.length >= count) break;
    for (const question of sample(tier, tier.length)) {
      if (seen.has(question.id)) continue;
      seen.add(question.id);
      result.push(question);
      if (result.length >= count) break;
    }
  }

  return result.slice(0, count);
}

function getQuestionBankWithOverrides(
  overrides: Record<string, QuestionClassificationOverride>
) {
  return getCanonicalQuestionBank(overrides);
}

function buildAISearchExpansionPrompt(query: string, selectedSubjects: SubjectName[]) {
  const subjectText =
    selectedSubjects.length > 0 ? selectedSubjects.join("、") : "不限科目（醫學一與醫學二各科都可）";

  return [
    "你是台灣醫學系國考題庫檢索助手。",
    "使用者剛學完一個區塊，想把相關題目整批找出來做成一份卷。",
    "請根據使用者輸入，整理出最有助於檢索考題的主題詞。",
    "請只輸出 JSON，不要輸出 markdown 或 code block。",
    "",
    "JSON 格式：",
    "{",
    '  "title": "這份卷最適合的短標題",',
    '  "searchTerms": ["關鍵詞1", "關鍵詞2", "關鍵詞3"],',
    '  "relatedConcepts": ["延伸概念1", "延伸概念2"]',
    "}",
    "",
    `使用者輸入：${query}`,
    `科目限制：${subjectText}`
  ].join("\n");
}

function parseAISearchPlan(raw: string): AISearchPlan {
  const cleaned = stripJsonCodeFence(raw);
  const parsed = JSON.parse(cleaned) as AISearchPlan;
  return {
    title: parsed.title?.trim(),
    searchTerms: (parsed.searchTerms ?? []).map((item) => item.trim()).filter(Boolean),
    relatedConcepts: (parsed.relatedConcepts ?? []).map((item) => item.trim()).filter(Boolean)
  };
}

function buildQuestionSearchCorpus(question: Question) {
  return [
    question.subject,
    question.chapter,
    question.section,
    question.testedConcept,
    question.stem,
    question.explanation,
    question.memoryTip,
    ...Object.values(question.options ?? {}),
    ...Object.values(question.optionAnalysis ?? {})
  ]
    .filter(Boolean)
    .join("\n");
}

function scoreQuestionAgainstSearchTerms(question: Question, terms: string[]) {
  const normalizedCorpus = normalizeSearchText(buildQuestionSearchCorpus(question));
  const compactCorpus = compactSearchText(normalizedCorpus);
  let score = 0;

  for (const rawTerm of terms) {
    const term = normalizeSearchText(rawTerm);
    if (!term) continue;
    const compactTerm = compactSearchText(term);

    if (question.subject.toLowerCase().includes(term)) score += 8;
    if ((question.chapter ?? "").toLowerCase().includes(term)) score += 7;
    if ((question.section ?? "").toLowerCase().includes(term)) score += 7;
    if ((question.testedConcept ?? "").toLowerCase().includes(term)) score += 7;
    if (normalizeSearchText(question.stem).includes(term)) score += 6;
    if (normalizeSearchText(question.explanation ?? "").includes(term)) score += 4;
    if (compactTerm && compactCorpus.includes(compactTerm)) score += 3;
  }

  return score;
}

function summarizeQuestionForAISearch(question: Question) {
  return [
    `id=${question.id}`,
    `subject=${question.subject}`,
    `chapter=${question.chapter ?? ""}`,
    `section=${question.section ?? ""}`,
    `concept=${question.testedConcept ?? ""}`,
    `stem=${question.stem.replace(/\s+/g, " ").slice(0, 140)}`
  ].join(" | ");
}

function buildAIRerankPrompt(query: string, plan: AISearchPlan, candidates: Question[]) {
  const candidateLines = candidates
    .map((question, index) => `${index + 1}. ${summarizeQuestionForAISearch(question)}`)
    .join("\n");

  return [
    "你是台灣醫學系國考題庫檢索助手。",
    "請從候選題目中挑出真正和使用者想練習的區塊相關的題目。",
    "寧可保守，不要把明顯不相關的題目加進來。",
    "如果是同一區塊的題目，就盡量都保留。",
    "請只輸出 JSON，不要輸出 markdown 或 code block。",
    "",
    "JSON 格式：",
    "{",
    '  "relevantIds": ["MOEX-...","MOEX-..."],',
    '  "reason": "一句簡短說明這批題目主要圍繞什麼主題"',
    "}",
    "",
    `使用者輸入：${query}`,
    `AI 整理標題：${plan.title ?? ""}`,
    `AI 整理關鍵詞：${(plan.searchTerms ?? []).join("、")}`,
    `AI 延伸概念：${(plan.relatedConcepts ?? []).join("、")}`,
    "",
    "候選題目：",
    candidateLines
  ].join("\n");
}

function parseRelevantIds(raw: string) {
  const cleaned = stripJsonCodeFence(raw);
  const parsed = JSON.parse(cleaned) as { relevantIds?: string[]; reason?: string };
  return {
    relevantIds: (parsed.relevantIds ?? []).map((item) => item.trim()).filter(Boolean),
    reason: parsed.reason?.trim()
  };
}

function selectQuestionsByDifficulty(
  questionBank: Question[],
  accuracyStatsMap: Map<string, QuestionAccuracyStatRow>,
  selectedSubjects: SubjectName[],
  difficulty: CustomPaperDifficulty,
  doneQuestionIds: Set<string>
) {
  const scoped = questionBank.filter((question) => selectedSubjects.includes(question.subject));
  const unseen = scoped.filter((question) => !doneQuestionIds.has(question.id));

  const getStat = (questionId: string) =>
    accuracyStatsMap.get(questionId) ?? {
      question_id: questionId,
      total_attempts: 0,
      correct_attempts: 0,
      correct_rate: 0
    };

  const byHardness = (questions: Question[]) =>
    [...questions].sort((left, right) => {
      const leftStat = getStat(left.id);
      const rightStat = getStat(right.id);
      if (leftStat.correct_rate !== rightStat.correct_rate) {
        return leftStat.correct_rate - rightStat.correct_rate;
      }
      return rightStat.total_attempts - leftStat.total_attempts;
    });

  const byEase = (questions: Question[]) =>
    [...questions].sort((left, right) => {
      const leftStat = getStat(left.id);
      const rightStat = getStat(right.id);
      if (leftStat.correct_rate !== rightStat.correct_rate) {
        return rightStat.correct_rate - leftStat.correct_rate;
      }
      return rightStat.total_attempts - leftStat.total_attempts;
    });

  const isStrictHardQuestion = (question: Question) => {
    const stat = getStat(question.id);
    return stat.total_attempts > 0 && stat.correct_rate <= 33.3;
  };

  const buildTiers = (questions: Question[]) => {
    if (difficulty === "hard") {
      return [
        questions.filter(isStrictHardQuestion),
        questions.filter((question) => {
          const stat = getStat(question.id);
          return stat.total_attempts > 0 && stat.correct_rate <= 45;
        }),
        byHardness(questions)
      ];
    }

    if (difficulty === "easy") {
      return [
        questions.filter((question) => {
          const stat = getStat(question.id);
          return stat.total_attempts > 5 && stat.correct_rate >= 75;
        }),
        questions.filter((question) => {
          const stat = getStat(question.id);
          return stat.total_attempts > 2 && stat.correct_rate >= 60;
        }),
        byEase(questions)
      ];
    }

    return [
      questions.filter((question) => {
        const stat = getStat(question.id);
        return stat.total_attempts > 5 && stat.correct_rate >= 30 && stat.correct_rate <= 70;
      }),
      questions.filter((question) => {
        const stat = getStat(question.id);
        return stat.total_attempts > 2 && stat.correct_rate >= 20 && stat.correct_rate <= 80;
      }),
      [...questions].sort((left, right) => {
        const leftDelta = Math.abs(getStat(left.id).correct_rate - 50);
        const rightDelta = Math.abs(getStat(right.id).correct_rate - 50);
        return leftDelta - rightDelta;
      })
    ];
  };

  const unseenSelection = pickByPriority(buildTiers(unseen), 10);
  if (difficulty === "hard") {
    const strictHardQuestions = unseen.filter(isStrictHardQuestion);
    const orderedStrictHardQuestions = byHardness(strictHardQuestions);

    if (orderedStrictHardQuestions.length >= 10) {
      return orderedStrictHardQuestions.slice(0, 10);
    }

    return orderedStrictHardQuestions;
  }

  if (unseenSelection.length >= 10) {
    return unseenSelection;
  }

  const mixedSelection = pickByPriority(buildTiers(scoped), 10);
  return mixedSelection;
}

async function generateUniquePaperCode(supabase: any) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = Array.from({ length: PAPER_CODE_LENGTH }, () =>
      PAPER_CODE_ALPHABET[Math.floor(Math.random() * PAPER_CODE_ALPHABET.length)]
    ).join("");

    const { data, error } = await supabase
      .from("custom_papers")
      .select("paper_code")
      .eq("paper_code", code)
      .maybeSingle();

    if (error) throw error;
    if (!data) return code;
  }

  throw new Error("暫時無法產生不重複的考卷碼，請稍後再試。");
}

function toPaperSummary(
  row: CustomPaperRow,
  attempts: CustomPaperAttemptRow[]
): CustomPaperSummary {
  const participantCount = attempts.length;
  const averageAccuracyRate =
    participantCount === 0
      ? 0
      : Number(
          (
            attempts.reduce((sum, item) => sum + Number(item.accuracy_rate ?? 0), 0) /
            participantCount
          ).toFixed(1)
        );

  return {
    paperCode: row.paper_code,
    name: row.name ?? undefined,
    subjectLabels: (row.subject_filters ?? []).filter(Boolean),
    difficulty: row.difficulty,
    isPublic: row.is_public,
    questionCount: Array.isArray(row.question_ids) ? row.question_ids.length : 0,
    createdAt: row.created_at,
    createdByLabel: row.created_by_label ?? undefined,
    averageAccuracyRate,
    participantCount
  };
}

function toPaperDetail(
  row: CustomPaperRow,
  attempts: CustomPaperAttemptRow[]
): CustomPaperDetail {
  const summary = toPaperSummary(row, attempts);
  const participants: CustomPaperParticipant[] = attempts
    .map((item) => ({
      sessionId: item.session_id,
      label: item.participant_label,
      userEmail: item.user_email ?? undefined,
      visitorId: item.visitor_id ?? undefined,
      correctCount: item.correct_count,
      totalCount: item.total_count,
      accuracyRate: Number(item.accuracy_rate ?? 0),
      completedAt: item.completed_at
    }))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));

  return {
    ...summary,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids : [],
    participants
  };
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

async function loadPaperAttempts(supabase: any, paperCode: string) {
  const { data, error } = await supabase
    .from("custom_paper_attempts")
    .select("paper_code, session_id, user_id, user_email, participant_label, visitor_id, correct_count, total_count, accuracy_rate, completed_at, created_at")
    .eq("paper_code", paperCode)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CustomPaperAttemptRow[];
}

async function resolveActor(
  supabase: any,
  accessToken?: string | null,
  visitorId?: string | null
) {
  if (!accessToken) {
    return {
      userId: null,
      userEmail: null,
      label: visitorId ? `訪客 ${visitorId.slice(0, 6)}` : "匿名訪客"
    };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      userId: null,
      userEmail: null,
      label: visitorId ? `訪客 ${visitorId.slice(0, 6)}` : "匿名訪客"
    };
  }

  const displayName =
    typeof data.user.user_metadata?.display_name === "string"
      ? data.user.user_metadata.display_name.trim().slice(0, 24)
      : "";

  return {
    userId: data.user.id,
    userEmail: data.user.email ?? null,
    label: displayName || data.user.email?.split("@")[0] || "已登入使用者"
  };
}

function canEditPaper(
  row: CustomPaperRow,
  actor: Awaited<ReturnType<typeof resolveActor>>,
  visitorId?: string | null
) {
  if (actor.userId && row.created_by_user_id === actor.userId) return true;
  if (actor.userEmail && row.created_by_email && actor.userEmail === row.created_by_email) return true;
  if (!actor.userId && visitorId && row.visitor_id && visitorId === row.visitor_id) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法使用自訂卷模式。" },
      { status: 503 }
    );
  }

  try {
    const paperCode = request.nextUrl.searchParams.get("paperCode")?.trim().toUpperCase();

    if (paperCode) {
      const { data, error } = await supabase
        .from("custom_papers")
        .select("paper_code, name, question_ids, subject_filters, difficulty, is_public, created_by_user_id, created_by_email, created_by_label, visitor_id, created_at")
        .eq("paper_code", paperCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json({ ok: false, message: "找不到這份自訂卷。" }, { status: 404 });
      }

      const attempts = await loadPaperAttempts(supabase, paperCode);
      return NextResponse.json({
        ok: true,
        paper: toPaperDetail(data as CustomPaperRow, attempts)
      });
    }

    const { data, error } = await supabase
      .from("custom_papers")
      .select("paper_code, name, question_ids, subject_filters, difficulty, is_public, created_by_user_id, created_by_email, created_by_label, visitor_id, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(PUBLIC_PAPER_LIMIT);

    if (error) throw error;

    const rows = (data ?? []) as CustomPaperRow[];
    const papers = await Promise.all(
      rows.map(async (row) => toPaperSummary(row, await loadPaperAttempts(supabase, row.paper_code)))
    );

    return NextResponse.json({ ok: true, papers });
  } catch (error) {
    const message = formatCustomPaperErrorMessage(error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法使用自訂卷模式。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | GenerateBody
      | GenerateAISearchBody
      | SubmitAttemptBody
      | UpdateMetadataBody
      | null;
    if (!body?.action) {
      return NextResponse.json({ ok: false, message: "缺少操作類型。" }, { status: 400 });
    }

    if (body.action === "generate") {
      const selectedSubjects = getAllowedSubjectList(body.selectedSubjects);
      if (selectedSubjects.length === 0) {
        return NextResponse.json({ ok: false, message: "請先選至少一個科目。" }, { status: 400 });
      }

      const difficulty = body.difficulty ?? "medium";
      const actor = await resolveActor(supabase, body.accessToken, body.visitorId);
      const classificationOverrides = await loadClassificationOverrides(supabase);
      const bank = getQuestionBankWithOverrides(classificationOverrides);
      const { data: accuracyRows, error: accuracyError } = await supabase
        .from("question_accuracy_stats")
        .select("question_id, total_attempts, correct_attempts, correct_rate");

      if (accuracyError) throw accuracyError;

      const accuracyStatsMap = new Map(
        ((accuracyRows ?? []) as QuestionAccuracyStatRow[]).map((row) => [row.question_id, row] as const)
      );
      const selectedQuestions = selectQuestionsByDifficulty(
        bank,
        accuracyStatsMap,
        selectedSubjects,
        difficulty,
        new Set((body.doneQuestionIds ?? []).filter(Boolean))
      );

      if (selectedQuestions.length < 10) {
        return NextResponse.json(
          {
            ok: false,
            message:
              difficulty === "hard"
                ? `目前這些科目裡，符合「至少 1 人做過且答對率不超過三分之一」的難題不足 10 題；目前符合條件 ${selectedQuestions.length} 題，請多選一些科目再試。`
                : `目前符合條件的題目不足 10 題；目前符合條件 ${selectedQuestions.length} 題，請多選一些科目再試。`
          },
          { status: 400 }
        );
      }

      const paperCode = await generateUniquePaperCode(supabase);
      const insertRow = {
        paper_code: paperCode,
        name: body.name?.trim().slice(0, 60) || null,
        question_ids: selectedQuestions.map((question) => question.id),
        subject_filters: selectedSubjects,
        difficulty,
        is_public: Boolean(body.isPublic),
        created_by_user_id: actor.userId,
        created_by_email: actor.userEmail,
        created_by_label: actor.label,
        visitor_id: body.visitorId ?? null
      };

      const { error: insertError } = await supabase.from("custom_papers").insert(insertRow);
      if (insertError) throw insertError;

      return NextResponse.json({
        ok: true,
        paper: {
          paperCode,
          name: insertRow.name ?? undefined,
          subjectLabels: selectedSubjects,
          difficulty,
          isPublic: insertRow.is_public,
          questionCount: selectedQuestions.length,
          createdAt: new Date().toISOString(),
          createdByLabel: actor.label,
          averageAccuracyRate: 0,
          participantCount: 0,
          questionIds: selectedQuestions.map((question) => question.id),
          participants: []
        } satisfies CustomPaperDetail
      });
    }

    if (body.action === "generate_ai_search") {
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          { ok: false, message: "OPENAI_API_KEY 尚未設定，暫時無法使用 AI 智慧檢索。" },
          { status: 500 }
        );
      }

      if (!body.accessToken) {
        return NextResponse.json(
          { ok: false, message: "請先登入帳號，才能使用 AI 智慧檢索。" },
          { status: 401 }
        );
      }

      const query = body.query?.trim() ?? "";
      if (!query) {
        return NextResponse.json({ ok: false, message: "請先輸入想檢索的區塊或關鍵字。" }, { status: 400 });
      }

      const selectedSubjects = getAllowedSubjectList(body.selectedSubjects);
      const effectiveSubjects =
        selectedSubjects.length > 0 ? selectedSubjects : Array.from(ALLOWED_SUBJECTS);
      const normalizedYearFrom = Number.isFinite(body.yearFrom) ? Math.trunc(body.yearFrom as number) : 100;
      const normalizedYearTo = Number.isFinite(body.yearTo) ? Math.trunc(body.yearTo as number) : 115;
      const yearFrom = Math.min(normalizedYearFrom, normalizedYearTo);
      const yearTo = Math.max(normalizedYearFrom, normalizedYearTo);
      const actor = await resolveActor(supabase, body.accessToken, body.visitorId);
      if (!actor.userId || !actor.userEmail) {
        return NextResponse.json(
          { ok: false, message: "請先登入帳號，才能使用 AI 智慧檢索。" },
          { status: 401 }
        );
      }
      const classificationOverrides = await loadClassificationOverrides(supabase);
      const bank = getQuestionBankWithOverrides(classificationOverrides).filter(
        (question) =>
          effectiveSubjects.includes(question.subject) &&
          question.sourceType !== "AI_GENERATED" &&
          typeof question.sourceYear === "number" &&
          question.sourceYear >= yearFrom &&
          question.sourceYear <= yearTo
      );

      if (bank.length === 0) {
        return NextResponse.json(
          { ok: false, message: `目前 ${yearFrom} 到 ${yearTo} 年、你選的科目範圍內沒有可檢索的考古題。` },
          { status: 400 }
        );
      }

      const expansion = await createOpenAIText(
        buildAISearchExpansionPrompt(query, effectiveSubjects),
        500,
        "gpt-5-mini"
      );
      const plan = parseAISearchPlan(expansion.text);
      const searchTerms = Array.from(
        new Set(
          [query, ...(plan.searchTerms ?? []), ...(plan.relatedConcepts ?? [])]
            .map((item) => item.trim())
            .filter(Boolean)
        )
      );

      const scoredCandidates = bank
        .map((question) => ({
          question,
          score: scoreQuestionAgainstSearchTerms(question, searchTerms)
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score || left.question.id.localeCompare(right.question.id));

      const candidateQuestions = scoredCandidates.slice(0, 80).map((item) => item.question);
      if (candidateQuestions.length === 0) {
        return NextResponse.json(
          { ok: false, message: "目前找不到和這個區塊明顯相關的題目，請換更具體的關鍵字試試。" },
          { status: 400 }
        );
      }

      const rerank = await createOpenAIText(
        buildAIRerankPrompt(query, plan, candidateQuestions),
        900,
        "gpt-5-mini"
      );
      const relevant = parseRelevantIds(rerank.text);
      const relevantIdSet = new Set(relevant.relevantIds);
      const orderedRelevantQuestions = candidateQuestions.filter((question) => relevantIdSet.has(question.id));
      const finalQuestions =
        orderedRelevantQuestions.length > 0 ? orderedRelevantQuestions : candidateQuestions.slice(0, 20);

      const paperCode = await generateUniquePaperCode(supabase);
      const insertRow = {
        paper_code: paperCode,
        name: body.name?.trim().slice(0, 60) || plan.title?.slice(0, 60) || `AI 檢索：${query.slice(0, 24)}`,
        question_ids: finalQuestions.map((question) => question.id),
        subject_filters: selectedSubjects,
        difficulty: "ai_search" as CustomPaperDifficulty,
        is_public: Boolean(body.isPublic),
        created_by_user_id: actor.userId,
        created_by_email: actor.userEmail,
        created_by_label: actor.label,
        visitor_id: body.visitorId ?? null
      };

      const { error: insertError } = await supabase.from("custom_papers").insert(insertRow);
      if (insertError) throw insertError;

      await insertAIUsageLog(supabase, {
        rate_key: `ai-search:${actor.userEmail?.trim().toLowerCase() || body.visitorId?.trim() || paperCode}`,
        visitor_id: body.visitorId ?? null,
        user_email: actor.userEmail ?? null,
        question_id: `${AI_SEARCH_USAGE_PREFIX}${paperCode}`,
        model: rerank.model,
        input_tokens: expansion.usage.inputTokens + rerank.usage.inputTokens,
        output_tokens: expansion.usage.outputTokens + rerank.usage.outputTokens,
        total_tokens: expansion.usage.totalTokens + rerank.usage.totalTokens,
        used_at: new Date().toISOString()
      });

      return NextResponse.json({
        ok: true,
        paper: {
          paperCode,
          name: insertRow.name ?? undefined,
          subjectLabels: selectedSubjects,
          difficulty: "ai_search" as CustomPaperDifficulty,
          isPublic: insertRow.is_public,
          questionCount: finalQuestions.length,
          createdAt: new Date().toISOString(),
          createdByLabel: actor.label,
          averageAccuracyRate: 0,
          participantCount: 0,
          questionIds: finalQuestions.map((question) => question.id),
          participants: []
        } satisfies CustomPaperDetail
      });
    }

    if (body.action === "update_metadata") {
      const paperCode = body.paperCode?.trim().toUpperCase();
      if (!paperCode) {
        return NextResponse.json({ ok: false, message: "缺少考卷碼。" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("custom_papers")
        .select("paper_code, name, question_ids, subject_filters, difficulty, is_public, created_by_user_id, created_by_email, created_by_label, visitor_id, created_at")
        .eq("paper_code", paperCode)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json({ ok: false, message: "找不到這份自訂卷。" }, { status: 404 });
      }

      const actor = await resolveActor(supabase, body.accessToken, body.visitorId);
      if (!canEditPaper(data as CustomPaperRow, actor, body.visitorId ?? null)) {
        return NextResponse.json({ ok: false, message: "只有這份卷的建立者才能修改卷名或公開設定。" }, { status: 403 });
      }

      const nextName = body.name?.trim().slice(0, 60) || null;
      const nextIsPublic = Boolean(body.isPublic);

      const { error: updateError } = await supabase
        .from("custom_papers")
        .update({
          name: nextName,
          is_public: nextIsPublic
        })
        .eq("paper_code", paperCode);

      if (updateError) throw updateError;

      const attempts = await loadPaperAttempts(supabase, paperCode);
      return NextResponse.json({
        ok: true,
        paper: toPaperDetail(
          {
            ...(data as CustomPaperRow),
            name: nextName,
            is_public: nextIsPublic
          },
          attempts
        )
      });
    }

    const submitBody = body as SubmitAttemptBody;
    if (!submitBody.paperCode?.trim() || !submitBody.session?.completedAt) {
      return NextResponse.json({ ok: false, message: "缺少自訂卷作答資料。" }, { status: 400 });
    }

    const actor = await resolveActor(supabase, submitBody.accessToken, submitBody.visitorId);
    const correctCount = submitBody.session.attempts.filter((attempt) => attempt.isCorrect).length;
    const totalCount = submitBody.session.attempts.length;
    const accuracyRate = totalCount > 0 ? Number(((correctCount / totalCount) * 100).toFixed(1)) : 0;

    const { error: upsertError } = await supabase.from("custom_paper_attempts").upsert(
      {
        paper_code: submitBody.paperCode.trim().toUpperCase(),
        session_id: submitBody.session.id,
        user_id: actor.userId,
        user_email: actor.userEmail,
        participant_label: actor.label,
        visitor_id: submitBody.visitorId ?? null,
        correct_count: correctCount,
        total_count: totalCount,
        accuracy_rate: accuracyRate,
        completed_at: submitBody.session.completedAt
      },
      { onConflict: "session_id" }
    );

    if (upsertError) throw upsertError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = formatCustomPaperErrorMessage(error);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
