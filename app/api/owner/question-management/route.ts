import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCanonicalQuestionBank } from "@/data/med1QuestionBank";
import {
  buildNeuroCandidateQuestions,
  buildNeuroSuggestionPrompt,
  getNeuroAnatomyQuestionBank,
  parseNeuroSuggestionResponse,
  type QuestionManagementRelationSuggestion,
  type QuestionManagementSuggestionBundle,
  type QuestionManagementTagSuggestion
} from "@/lib/questionManagement";
import { createOpenAIText, isOpenAIConfigured } from "@/lib/openai";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import type { Question, QuestionClassificationOverride } from "@/types/quiz";

type QuestionManagementAction =
  | "search_questions"
  | "inspect_question"
  | "generate_neuro_suggestions"
  | "apply_suggestion"
  | "reject_suggestion";

type QuestionSearchResult = {
  id: string;
  subject: string;
  chapter: string;
  section: string;
  stem: string;
  testedConcept: string;
  sourceYear?: number;
  examCode?: string;
  questionNumber?: number;
};

type QuestionSuggestionRow = {
  id: string | number;
  question_id: string;
  suggestion_type: string;
  payload: Record<string, unknown>;
  model?: string | null;
  status: string;
  confidence?: number | null;
  created_at: string;
};

type RequestBody = {
  accessToken?: string;
  action?: QuestionManagementAction;
  query?: string;
  page?: number;
  pageSize?: number;
  questionId?: string;
  suggestionId?: string;
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

function getAllowedEmails() {
  return (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedEmail(email?: string | null) {
  if (!email) return false;
  return getAllowedEmails().includes(email.trim().toLowerCase());
}

async function requireAdminAccess(supabase: any, accessToken?: string) {
  if (!accessToken) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 }) };
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 })
    };
  }

  if (!isAllowedEmail(data.user.email)) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, message: "你沒有題庫管理權限。" }, { status: 403 })
    };
  }

  return {
    ok: true as const,
    user: {
      id: data.user.id,
      email: data.user.email
    }
  };
}

async function loadClassificationOverrides(supabase: any) {
  const { data, error } = await supabase
    .from("question_classification_overrides")
    .select("question_id, subject, chapter, section, source_report_id, updated_at");

  if (error) throw error;

  return ((data ?? []) as Array<{
    question_id: string;
    subject: string;
    chapter: string;
    section: string;
    source_report_id?: string | number | null;
    updated_at?: string | null;
  }>).reduce<Record<string, QuestionClassificationOverride>>((accumulator, row) => {
    accumulator[row.question_id] = {
      questionId: row.question_id,
      subject: row.subject as QuestionClassificationOverride["subject"],
      chapter: row.chapter,
      section: row.section,
      sourceReportId: row.source_report_id ? String(row.source_report_id) : undefined,
      updatedAt: row.updated_at ?? new Date(0).toISOString()
    };
    return accumulator;
  }, {});
}

function formatQuestionSummary(question: Question): QuestionSearchResult {
  return {
    id: question.id,
    subject: question.subject,
    chapter: question.chapter,
    section: question.section,
    stem: question.stem,
    testedConcept: question.testedConcept,
    sourceYear: question.sourceYear,
    examCode: question.examCode,
    questionNumber: question.originalQuestionNumber
  };
}

function searchQuestions(bank: Question[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return bank;

  return bank.filter((question) => {
    const haystack = [
      question.id,
      question.subject,
      question.chapter,
      question.section,
      question.testedConcept,
      question.stem,
      question.explanation,
      question.clinicalLink,
      question.memoryTip
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

async function loadSuggestionRows(supabase: any, questionId: string) {
  const { data, error } = await supabase
    .from("question_ai_suggestions")
    .select("id, question_id, suggestion_type, payload, model, status, confidence, created_at")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as QuestionSuggestionRow[];
}

async function insertSuggestionRows(
  supabase: any,
  bundle: QuestionManagementSuggestionBundle,
  model: string
) {
  const insertRows = [
    ...bundle.tags.map((tag) => ({
      question_id: bundle.questionId,
      suggestion_type: "tag",
      payload: {
        tag: tag.tag,
        tag_type: tag.tagType
      },
      model,
      status: "pending",
      confidence: tag.confidence ?? null,
      source: "ai"
    })),
    ...bundle.relations.map((relation) => ({
      question_id: bundle.questionId,
      suggestion_type: "relation",
      payload: {
        target_question_id: relation.targetQuestionId,
        relation_type: relation.relationType,
        reason: relation.reason ?? ""
      },
      model,
      status: "pending",
      confidence: relation.confidence ?? null,
      source: "ai"
    }))
  ];

  if (insertRows.length === 0) return [];

  const { data, error } = await supabase
    .from("question_ai_suggestions")
    .insert(insertRows)
    .select("id, question_id, suggestion_type, payload, model, status, confidence, created_at");

  if (error) throw error;
  return (data ?? []) as QuestionSuggestionRow[];
}

function mapStoredSuggestionRows(rows: QuestionSuggestionRow[]) {
  return rows.map((row) => ({
    id: String(row.id),
    questionId: row.question_id,
    suggestionType: row.suggestion_type,
    payload: row.payload,
    model: row.model ?? undefined,
    status: row.status,
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    createdAt: row.created_at
  }));
}

function coerceTagSuggestion(payload: Record<string, unknown>, confidence?: number | null): QuestionManagementTagSuggestion | null {
  const tag = typeof payload.tag === "string" ? payload.tag.trim() : "";
  const tagType = typeof payload.tag_type === "string" ? payload.tag_type.trim() : "";
  if (!tag || !tagType) return null;
  return {
    tag,
    tagType: tagType as QuestionManagementTagSuggestion["tagType"],
    confidence: typeof confidence === "number" ? confidence : undefined
  };
}

function coerceRelationSuggestion(
  payload: Record<string, unknown>,
  confidence?: number | null
): QuestionManagementRelationSuggestion | null {
  const targetQuestionId =
    typeof payload.target_question_id === "string" ? payload.target_question_id.trim() : "";
  const relationType =
    typeof payload.relation_type === "string" ? payload.relation_type.trim() : "";
  if (!targetQuestionId || !relationType) return null;
  return {
    targetQuestionId,
    relationType: relationType as QuestionManagementRelationSuggestion["relationType"],
    confidence: typeof confidence === "number" ? confidence : undefined,
    reason: typeof payload.reason === "string" ? payload.reason.trim() : undefined
  };
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json(
      { ok: false, message: "Supabase recovery mode 開啟中，題庫管理台暫時停用雲端操作。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY 尚未設定，暫時無法使用題庫管理。" },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as RequestBody | null;
    const action = body?.action;

    const access = await requireAdminAccess(supabase, body?.accessToken);
    if (!access.ok) return access.response;

    const classificationOverrides = await loadClassificationOverrides(supabase);
    const neuroBank = getNeuroAnatomyQuestionBank(classificationOverrides);

    if (action === "search_questions") {
      const page = Math.max(1, Math.trunc(body?.page ?? 1));
      const pageSize = Math.min(50, Math.max(10, Math.trunc(body?.pageSize ?? 20)));
      const filtered = searchQuestions(neuroBank, body?.query ?? "");
      const total = filtered.length;
      const items = filtered.slice((page - 1) * pageSize, page * pageSize).map(formatQuestionSummary);

      return NextResponse.json({
        ok: true,
        total,
        page,
        pageSize,
        items
      });
    }

    if (!body?.questionId?.trim()) {
      return NextResponse.json({ ok: false, message: "缺少題目編號。" }, { status: 400 });
    }

    const question = neuroBank.find((item) => item.id === body.questionId);
    if (!question) {
      return NextResponse.json({ ok: false, message: "找不到這題神經解剖題。" }, { status: 404 });
    }

    if (action === "inspect_question") {
      const candidates = buildNeuroCandidateQuestions(question, neuroBank, 10);
      const suggestions = await loadSuggestionRows(supabase, question.id);

      return NextResponse.json({
        ok: true,
        question: formatQuestionSummary(question),
        questionDetail: question,
        candidates: candidates.map(formatQuestionSummary),
        suggestions: mapStoredSuggestionRows(suggestions)
      });
    }

    if (action === "generate_neuro_suggestions") {
      if (!isOpenAIConfigured()) {
        return NextResponse.json(
          { ok: false, message: "OPENAI_API_KEY 尚未設定，暫時無法生成 AI 題目連結。" },
          { status: 500 }
        );
      }

      const candidates = buildNeuroCandidateQuestions(question, neuroBank, 10);
      if (candidates.length === 0) {
        return NextResponse.json({ ok: false, message: "這題目前找不到合適候選題。" }, { status: 400 });
      }

      const completion = await createOpenAIText(
        buildNeuroSuggestionPrompt(question, candidates),
        1200
      );
      const bundle = parseNeuroSuggestionResponse(completion.text);
      if (!bundle || bundle.questionId !== question.id) {
        return NextResponse.json(
          { ok: false, message: "AI 有回應，但格式無法解析成神經解剖題目連結。" },
          { status: 502 }
        );
      }

      const inserted = await insertSuggestionRows(supabase, bundle, completion.model);

      return NextResponse.json({
        ok: true,
        generated: {
          tags: bundle.tags,
          relations: bundle.relations,
          model: completion.model,
          usage: completion.usage
        },
        suggestions: mapStoredSuggestionRows(inserted)
      });
    }

    if ((action === "apply_suggestion" || action === "reject_suggestion") && !body?.suggestionId?.trim()) {
      return NextResponse.json({ ok: false, message: "缺少建議編號。" }, { status: 400 });
    }

    if (action === "apply_suggestion" || action === "reject_suggestion") {
      const { data: row, error } = await supabase
        .from("question_ai_suggestions")
        .select("id, question_id, suggestion_type, payload, model, status, confidence, created_at")
        .eq("id", body.suggestionId)
        .maybeSingle();

      if (error) throw error;
      if (!row) {
        return NextResponse.json({ ok: false, message: "找不到這筆 AI 建議。" }, { status: 404 });
      }

      if (action === "reject_suggestion") {
        const { error: updateError } = await supabase
          .from("question_ai_suggestions")
          .update({
            status: "rejected",
            reviewed_by_email: access.user.email,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", row.id);

        if (updateError) throw updateError;

        return NextResponse.json({ ok: true, suggestionId: String(row.id), status: "rejected" });
      }

      if (row.suggestion_type === "tag") {
        const tag = coerceTagSuggestion(row.payload, row.confidence);
        if (!tag) {
          return NextResponse.json({ ok: false, message: "這筆 tag 建議格式不完整。" }, { status: 400 });
        }

        const { error: insertError } = await supabase.from("question_tags").upsert(
          {
            question_id: row.question_id,
            tag: tag.tag,
            tag_type: tag.tagType,
            source: "ai_suggested",
            confidence: tag.confidence ?? null,
            is_active: true,
            approved_by_email: access.user.email,
            source_suggestion_id: row.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: "question_id,tag_type,tag,source" }
        );

        if (insertError) throw insertError;
      } else if (row.suggestion_type === "relation") {
        const relation = coerceRelationSuggestion(row.payload, row.confidence);
        if (!relation) {
          return NextResponse.json({ ok: false, message: "這筆 relation 建議格式不完整。" }, { status: 400 });
        }

        const { error: insertError } = await supabase.from("question_relations").upsert(
          {
            source_question_id: row.question_id,
            target_question_id: relation.targetQuestionId,
            relation_type: relation.relationType,
            weight: relation.confidence ?? 0.5,
            confidence: relation.confidence ?? null,
            reason: relation.reason ?? null,
            source: "ai_suggested",
            is_active: true,
            approved_by_email: access.user.email,
            source_suggestion_id: row.id,
            updated_at: new Date().toISOString()
          },
          { onConflict: "source_question_id,target_question_id,relation_type,source" }
        );

        if (insertError) throw insertError;
      } else {
        return NextResponse.json({ ok: false, message: "目前只支援套用 tag / relation 建議。" }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from("question_ai_suggestions")
        .update({
          status: "approved",
          reviewed_by_email: access.user.email,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", row.id);

      if (updateError) throw updateError;

      return NextResponse.json({ ok: true, suggestionId: String(row.id), status: "approved" });
    }

    return NextResponse.json({ ok: false, message: "不支援的題庫管理動作。" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "題庫管理操作失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
