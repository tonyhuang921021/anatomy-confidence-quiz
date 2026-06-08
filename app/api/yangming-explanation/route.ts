import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type YangmingExplanationRequestBody = {
  accessToken?: string | null;
  questionId?: string | null;
};

type YangmingExplanationRow = {
  question_id: string;
  body: string;
  author?: string | null;
  reviewer?: string | null;
  source_label?: string | null;
  source_file?: string | null;
  source_page_start?: number | null;
  source_page_end?: number | null;
  question_stem_snapshot?: string | null;
  answer_snapshot?: string | null;
  sections?: unknown;
  assets?: unknown;
};

const YANGMING_EXPLANATION_BUCKET =
  process.env.YANGMING_EXPLANATION_BUCKET || "yangming-explanations";

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

function normalizeSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as {
        kind?: unknown;
        label?: unknown;
        text?: unknown;
        runs?: unknown;
        assetIndex?: unknown;
        page?: unknown;
        fallback?: unknown;
      };
      if (typeof record.kind !== "string" || !record.kind.trim()) return null;
      return {
        kind: record.kind.trim(),
        label: typeof record.label === "string" ? record.label : undefined,
        text: typeof record.text === "string" ? record.text : undefined,
        runs: Array.isArray(record.runs)
          ? record.runs
              .map((run) => {
                if (!run || typeof run !== "object") return null;
                const runRecord = run as { text?: unknown; script?: unknown };
                if (typeof runRecord.text !== "string" || !runRecord.text) return null;
                return {
                  text: runRecord.text,
                  script:
                    runRecord.script === "super" || runRecord.script === "sub"
                      ? runRecord.script
                      : undefined
                };
              })
              .filter(Boolean)
          : undefined,
        assetIndex: typeof record.assetIndex === "number" ? record.assetIndex : undefined,
        page: typeof record.page === "number" ? record.page : undefined,
        fallback: record.fallback === true
      };
    })
    .filter(Boolean);
}

function normalizeAssets(
  supabase: {
    storage: {
      from: (bucket: string) => {
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  value: unknown
): {
  src: string;
  storagePath?: string;
  alt?: string;
  width?: number;
  height?: number;
  page?: number;
  kind?: string;
  fallback?: boolean;
}[] {
  if (!Array.isArray(value)) return [];
  const assets: {
    src: string;
    storagePath?: string;
    alt?: string;
    width?: number;
    height?: number;
    page?: number;
    kind?: string;
    fallback?: boolean;
  }[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      src?: unknown;
      alt?: unknown;
      width?: unknown;
      height?: unknown;
      page?: unknown;
      kind?: unknown;
      fallback?: unknown;
    };
    if (typeof record.src !== "string" || !record.src.trim()) continue;
    const storagePath = record.src.trim();
    const publicUrl =
      storagePath.startsWith("http://") || storagePath.startsWith("https://")
        ? storagePath
        : supabase.storage.from(YANGMING_EXPLANATION_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    assets.push({
      src: publicUrl,
      storagePath,
      alt: typeof record.alt === "string" ? record.alt : undefined,
      width: typeof record.width === "number" ? record.width : undefined,
      height: typeof record.height === "number" ? record.height : undefined,
      page: typeof record.page === "number" ? record.page : undefined,
      kind: typeof record.kind === "string" ? record.kind : undefined,
      fallback: record.fallback === true
    });
  }

  return assets;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as YangmingExplanationRequestBody;
    const questionId = body.questionId?.trim();
    if (!body.accessToken) {
      return NextResponse.json({ ok: false, message: "請先登入。" }, { status: 401 });
    }
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }

    const { data, error: authError } = await supabase.auth.getUser(body.accessToken);
    if (authError || !data.user) {
      return NextResponse.json({ ok: false, message: "登入驗證失敗。" }, { status: 401 });
    }

    const activationFilter = data.user.email
      ? `user_id.eq.${data.user.id},user_email.eq.${data.user.email}`
      : `user_id.eq.${data.user.id}`;
    const { data: activationRows, error: activationError } = await supabase
      .from("yangming_mode_activations")
      .select("id")
      .or(activationFilter)
      .limit(1);

    if (activationError) {
      throw activationError;
    }

    if (!activationRows?.length) {
      return NextResponse.json({ ok: false, message: "尚未啟用。" }, { status: 403 });
    }

    const { data: explanationRow, error: explanationError } = await supabase
      .from("yangming_question_explanations")
      .select("question_id, body, author, reviewer, source_label, source_file, source_page_start, source_page_end, question_stem_snapshot, answer_snapshot, sections, assets")
      .eq("question_id", questionId)
      .maybeSingle();

    if (explanationError) {
      const message = String(explanationError.message ?? "");
      if (message.includes("yangming_question_explanations") && (message.includes("does not exist") || message.includes("Could not find"))) {
        return NextResponse.json({ ok: true, explanation: null });
      }
      throw explanationError;
    }

    const row = explanationRow as YangmingExplanationRow | null;
    if (!row?.body) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    return NextResponse.json({
      ok: true,
      explanation: {
        body: row.body,
        author: row.author ?? undefined,
        reviewer: row.reviewer ?? undefined,
        sourceLabel: row.source_label ?? undefined,
        sourceFile: row.source_file ?? undefined,
        sourcePageStart: row.source_page_start ?? undefined,
        sourcePageEnd: row.source_page_end ?? undefined,
        questionStemSnapshot: row.question_stem_snapshot ?? undefined,
        answerSnapshot: row.answer_snapshot ?? undefined,
        sections: normalizeSections(row.sections),
        assets: normalizeAssets(supabase, row.assets)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "詳解載入失敗";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
