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

type SupabaseQueryClient = {
  from: (table: string) => any;
};

type SupabaseQueryResult = {
  data: unknown;
  error: unknown;
};

const YANGMING_EXPLANATION_BUCKET =
  process.env.YANGMING_EXPLANATION_BUCKET || "yangming-explanations";
const ACTIVE_VERSION_CACHE_TTL_MS = 5 * 60 * 1000;

let activeYangmingVersionCache: {
  versionId: string | null;
  expiresAt: number;
} | null = null;

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

function getQuestionIdLookupCandidates(questionId: string) {
  const trimmed = questionId.trim();
  const normalized = trimmed.replace(/^MOEX-(\d+)[_-](\d+)-Q/i, "MOEX-$1-$2-Q");
  return Array.from(new Set([trimmed, normalized]));
}

function flattenUnknownStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => flattenUnknownStrings(item));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenUnknownStrings(item));
  }
  return [];
}

function detectAssetQuestionNumber(record: { rows?: unknown; alt?: unknown; src?: unknown }) {
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
  if (inlineMatch) return Number(inlineMatch[1]);

  const hints = [record.alt, record.src]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const labelMatch =
    hints.match(/第\s*0*(\d{1,3})\s*題/) ??
    hints.match(/(?:^|[-_/])q0*(\d{1,3})(?:[-_.]|$)/i);
  return labelMatch ? Number(labelMatch[1]) : null;
}

function detectAssetQuestionNumberFromHints(record: { alt?: unknown; src?: unknown }) {
  const hints = [record.alt, record.src]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  const labelMatch =
    hints.match(/第\s*0*(\d{1,3})\s*題/) ??
    hints.match(/(?:^|[-_/])q0*(\d{1,3})(?:[-_.]|$)/i);
  return labelMatch ? Number(labelMatch[1]) : null;
}

function shouldDropAssetForQuestion(
  record: { rows?: unknown; alt?: unknown; src?: unknown; kind?: unknown; fallback?: unknown },
  expectedQuestionNo: number | null
) {
  const kind = typeof record.kind === "string" ? record.kind.trim().toLowerCase() : "";
  const isFallback =
    record.fallback === true ||
    (typeof record.fallback === "string" && record.fallback.trim().toLowerCase() === "true");
  if (isFallback || kind === "page_snapshot" || kind === "full_page") {
    return true;
  }
  if (
    kind === "question_snapshot" &&
    !(
      typeof record.src === "string" &&
      (() => {
        const src = record.src.trim().replace(/^\/+/, "");
        return src.startsWith("per_file/") || src.includes("/per_file/");
      })()
    )
  ) {
    return true;
  }
  if (kind !== "question_snapshot") {
    return true;
  }

  if (!expectedQuestionNo) return false;

  const hintQuestionNo = detectAssetQuestionNumberFromHints(record);
  if (hintQuestionNo === expectedQuestionNo) return false;

  if (kind === "question_snapshot") {
    return false;
  }

  const assetQuestionNo = detectAssetQuestionNumber(record);
  return Boolean(assetQuestionNo && assetQuestionNo !== expectedQuestionNo);
}

function isMissingTableError(error: unknown, tableName: string) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  return message.includes(tableName) && (message.includes("does not exist") || message.includes("Could not find"));
}

async function getActiveYangmingVersion(supabase: SupabaseQueryClient) {
  const now = Date.now();
  if (activeYangmingVersionCache && activeYangmingVersionCache.expiresAt > now) {
    return activeYangmingVersionCache.versionId;
  }

  try {
    const { data, error } = (await withServerTimeout(
      supabase
        .from("yangming_explanation_releases")
        .select("version_id")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      2500,
      "陽明詳解版本讀取逾時"
    )) as SupabaseQueryResult;
    if (error) {
      if (isMissingTableError(error, "yangming_explanation_releases")) return null;
      return activeYangmingVersionCache?.versionId ?? null;
    }
    const release = data as { version_id?: unknown } | null;
    const versionId =
      typeof release?.version_id === "string" && release.version_id.trim()
        ? release.version_id.trim()
        : null;
    activeYangmingVersionCache = {
      versionId,
      expiresAt: now + ACTIVE_VERSION_CACHE_TTL_MS
    };
    return versionId;
  } catch {
    return activeYangmingVersionCache?.versionId ?? null;
  }
}

async function fetchYangmingRows(
  supabase: SupabaseQueryClient,
  questionIdCandidates: string[],
  versionId?: string | null
) {
  const columns =
    "question_id, body, author, reviewer, source_label, source_file, source_page_start, source_page_end, question_stem_snapshot, answer_snapshot, sections, assets, match_status, match_score";
  const query = versionId
    ? supabase
        .from("yangming_question_explanations_versioned")
        .select(columns)
        .eq("version_id", versionId)
        .in("question_id", questionIdCandidates)
        .limit(questionIdCandidates.length)
    : supabase
        .from("yangming_question_explanations")
        .select(columns)
        .in("question_id", questionIdCandidates)
        .limit(questionIdCandidates.length);
  return withServerTimeout(query, versionId ? 1600 : 2200, "陽明詳解讀取逾時") as Promise<SupabaseQueryResult>;
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
        kind: record.kind.trim().toLowerCase(),
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
    if (shouldDropAssetForQuestion(record, expectedQuestionNo)) {
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
      kind: typeof record.kind === "string" ? record.kind.trim().toLowerCase() : undefined,
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

    const questionIdCandidates = getQuestionIdLookupCandidates(questionId);
    const activeVersionId = await getActiveYangmingVersion(supabase);
    let { data: explanationRows, error: explanationError } = activeVersionId
      ? await fetchYangmingRows(supabase, questionIdCandidates, activeVersionId)
      : await fetchYangmingRows(supabase, questionIdCandidates);

    if (explanationError) {
      if (
        activeVersionId &&
        isMissingTableError(explanationError, "yangming_question_explanations_versioned")
      ) {
        const legacyResult = await fetchYangmingRows(supabase, questionIdCandidates);
        explanationRows = legacyResult.data;
        explanationError = legacyResult.error;
      }
      if (explanationError) {
        if (isMissingTableError(explanationError, "yangming_question_explanations")) {
          return NextResponse.json({ ok: true, explanation: null });
        }
        throw explanationError;
      }
    }

    let rows = (Array.isArray(explanationRows) ? explanationRows : []) as YangmingExplanationRow[];
    if (activeVersionId && rows.length === 0) {
      const legacyResult = await fetchYangmingRows(supabase, questionIdCandidates);
      if (!legacyResult.error && Array.isArray(legacyResult.data)) {
        rows = legacyResult.data as YangmingExplanationRow[];
      }
    }
    const row =
      rows.find((candidate) => candidate.question_id === questionId) ??
      rows.find((candidate) => candidate.question_id === questionIdCandidates[1]) ??
      null;
    if (!row) {
      return NextResponse.json({ ok: true, explanation: null });
    }

    const expectedQuestionNo = getQuestionNumberFromId(row.question_id);
    const normalizedAssetBundle = normalizeAssets(supabase, row.assets, expectedQuestionNo);
    if (normalizedAssetBundle.assets.length === 0) {
      return NextResponse.json({ ok: true, explanation: null });
    }
    const normalizedSections = normalizeSections(row.sections, normalizedAssetBundle.assetIndexMap)
      .filter((section) => section && section.kind === "image");
    return NextResponse.json({
      ok: true,
      activeVersionId,
      explanation: {
        body: "",
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
