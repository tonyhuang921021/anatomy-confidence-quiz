import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

type SubmitAttemptBody = {
  action: "submit_attempt";
  accessToken?: string | null;
  visitorId?: string | null;
  paperCode?: string;
  session?: QuizSession;
};

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

  const buildTiers = (questions: Question[]) => {
    if (difficulty === "hard") {
      return [
        questions.filter((question) => {
          const stat = getStat(question.id);
          return (
            (stat.total_attempts > 3 && stat.correct_attempts === 0) ||
            (stat.total_attempts > 5 && stat.correct_rate < 30)
          );
        }),
        questions.filter((question) => {
          const stat = getStat(question.id);
          return stat.total_attempts > 3 && stat.correct_rate < 45;
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
    const body = (await request.json().catch(() => null)) as GenerateBody | SubmitAttemptBody | null;
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
          { ok: false, message: "目前符合條件的題目不足 10 題，請多選一些科目再試。" },
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
