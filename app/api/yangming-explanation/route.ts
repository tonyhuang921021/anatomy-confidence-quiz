import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseRecoveryMode } from "@/lib/supabase/recoveryMode";
import { withServerTimeout } from "@/lib/serverTimeout";

type YangmingExplanationRequestBody = {
  accessToken?: string | null;
  questionId?: string | null;
};

type YangmingExplanationRow = {
  question_id: string;
  body?: string | null;
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
  match_status?: string | null;
  match_score?: number | string | null;
};

type NormalizedYangmingAsset = {
  src: string;
  storagePath?: string;
  alt?: string;
  width?: number;
  height?: number;
  page?: number;
  kind?: string;
  fallback?: boolean;
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

function getQuestionNumberFromId(questionId: string | undefined) {
  const match = questionId?.match(/-Q0*(\d{1,3})$/);
  return match ? Number(match[1]) : null;
}

function flattenUnknownStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => flattenUnknownStrings(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenUnknownStrings(item));
  }
  return [];
}

function detectAssetQuestionNumber(record: { rows?: unknown }) {
  const rows = Array.isArray(record.rows) ? record.rows : [];
  for (const row of rows) {
    const cells = Array.isArray(row) ? row.map((cell) => (typeof cell === "string" ? cell : "")) : [];
    const questionLabelIndex = cells.findIndex((cell) => /題\s*號|題號/.test(cell));
    if (questionLabelIndex === -1) continue;
    const nearbyCells = cells.slice(questionLabelIndex + 1, questionLabelIndex + 8);
    for (const cell of nearbyCells) {
      const match = cell.match(/\b0*(\d{1,3})\b/);
      if (match) return Number(match[1]);
    }
  }

  const combinedRows = flattenUnknownStrings(record.rows).join(" ");
  const inlineMatch = combinedRows.match(/題\s*號\s*0*(\d{1,3})/);
  return inlineMatch ? Number(inlineMatch[1]) : null;
}

function isMeaningfulYangmingText(text: string | null | undefined) {
  if (!text) return false;
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 4) return false;

  const informativeText = compact.replace(
    /[、，,.:：;；`'"「」『』()（）\[\]{}<>《》|\\/_\-—~。．·•]/g,
    ""
  );
  return informativeText.length >= 2;
}

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}

function normalizeSections(value: unknown, assetIndexMap?: Map<number, number>) {
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
      const rawAssetIndex = typeof record.assetIndex === "number" ? record.assetIndex : undefined;
      const mappedAssetIndex =
        typeof rawAssetIndex === "number" && assetIndexMap
          ? assetIndexMap.get(rawAssetIndex)
          : rawAssetIndex;
      if (
        record.kind.trim() === "image" &&
        typeof rawAssetIndex === "number" &&
        typeof mappedAssetIndex !== "number"
      ) {
        return null;
      }
      const normalizedRuns = Array.isArray(record.runs)
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
            .filter(isNonNullable)
        : undefined;
      const normalizedText = typeof record.text === "string" ? record.text : undefined;
      const runText = normalizedRuns?.map((run) => run?.text ?? "").join("");
      if (
        record.kind.trim() !== "image" &&
        !isMeaningfulYangmingText(normalizedText || runText)
      ) {
        return null;
      }
      return {
        kind: record.kind.trim(),
        label: typeof record.label === "string" ? record.label : undefined,
        text: normalizedText,
        runs: normalizedRuns,
        assetIndex: mappedAssetIndex,
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
  value: unknown,
  expectedQuestionNo: number | null
): { assets: NormalizedYangmingAsset[]; assetIndexMap: Map<number, number> } {
  if (!Array.isArray(value)) return { assets: [], assetIndexMap: new Map() };
  const assets: NormalizedYangmingAsset[] = [];
  const assetIndexMap = new Map<number, number>();

  value.forEach((item, originalIndex) => {
    if (!item || typeof item !== "object") return;
    const record = item as {
      src?: unknown;
      alt?: unknown;
      width?: unknown;
      height?: unknown;
      page?: unknown;
      kind?: unknown;
      fallback?: unknown;
      rows?: unknown;
    };
    if (typeof record.src !== "string" || !record.src.trim()) return;
    const assetQuestionNo = detectAssetQuestionNumber(record);
    if (expectedQuestionNo && assetQuestionNo && assetQuestionNo !== expectedQuestionNo) {
      return;
    }
    const storagePath = record.src.trim();
    const publicUrl =
      storagePath.startsWith("http://") || storagePath.startsWith("https://")
        ? storagePath
        : supabase.storage.from(YANGMING_EXPLANATION_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    assetIndexMap.set(originalIndex, assets.length);
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
  });

  return { assets, assetIndexMap };
}

export async function POST(request: NextRequest) {
  if (isSupabaseRecoveryMode()) {
    return NextResponse.json({ ok: true, explanation: null, deferred: true });
  }

  const supabase = getServiceSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "Supabase 尚未設定。" }, { status: 503 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as YangmingExplanationRequestBody;
    const questionId = body.questionId?.trim();
    if (!questionId) {
      return NextResponse.json({ ok: false, message: "缺少題號。" }, { status: 400 });
    }

    const { data: explanationRow, error: explanationError } = await withServerTimeout(
      supabase
        .from("yangming_question_explanations")
        .select("question_id, body, author, reviewer, source_label, source_file, source_page_start, source_page_end, question_stem_snapshot, answer_snapshot, sections, assets, match_status, match_score")
        .eq("question_id", questionId)
        .maybeSingle(),
      2500,
      "陽明詳解讀取逾時"
    );

    if (explanationError) {
      const message = String(explanationError.message ?? "");
      if (message.includes("yangming_question_explanations") && (message.includes("does not exist") || message.includes("Could not find"))) {
        return NextResponse.json({ ok: true, explanation: null });
      }
      throw explanationError;
    }

    const row = explanationRow as YangmingExplanationRow | null;
    if (!row) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    const matchScore =
      typeof row.match_score === "number"
        ? row.match_score
        : typeof row.match_score === "string"
          ? Number(row.match_score)
          : null;
    if (row.match_status === "low_confidence" || (matchScore !== null && matchScore < 0.5)) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    const expectedQuestionNo = getQuestionNumberFromId(row.question_id);
    const normalizedAssetBundle = normalizeAssets(supabase, row.assets, expectedQuestionNo);
    const normalizedSections = normalizeSections(row.sections, normalizedAssetBundle.assetIndexMap);
    const normalizedBody =
      typeof row.body === "string" && isMeaningfulYangmingText(row.body) ? row.body : "";
    if (!normalizedBody && normalizedSections.length === 0 && normalizedAssetBundle.assets.length === 0) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    return NextResponse.json({
      ok: true,
      explanation: {
        body: normalizedBody,
        author: row.author ?? undefined,
        reviewer: row.reviewer ?? undefined,
        sourceLabel: row.source_label ?? undefined,
        sourceFile: row.source_file ?? undefined,
        sourcePageStart: row.source_page_start ?? undefined,
        sourcePageEnd: row.source_page_end ?? undefined,
        questionStemSnapshot: row.question_stem_snapshot ?? undefined,
        answerSnapshot: row.answer_snapshot ?? undefined,
        sections: normalizedSections,
        assets: normalizedAssetBundle.assets
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "詳解載入失敗";
    return NextResponse.json(
      { ok: true, explanation: null, degraded: true, message },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
        }
      }
    );
  }
}
