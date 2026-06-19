"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getOrCreateVisitorId } from "@/lib/visitor";
import type { YangmingExplanationContent } from "@/types/quiz";

type Props = {
  questionId: string;
  className?: string;
  buttonClassName?: string;
  compact?: boolean;
};

type YangmingExplanationResponse = {
  ok?: boolean;
  explanation?: YangmingExplanationContent | null;
  message?: string;
  degraded?: boolean;
};

const yangmingExplanationCache = new Map<string, YangmingExplanationContent | null>();
const yangmingExplanationPromiseCache = new Map<string, Promise<YangmingExplanationContent | null>>();

const YANGMING_REPORT_REASON_PRESETS = [
  "圖片被切掉",
  "詳解少一頁",
  "詳解對錯題",
  "表格被截斷",
  "圖片貼到下一題",
  "圖片不對",
  "缺少陽明詳解"
];

type YangmingTextRun = {
  text: string;
  script?: "super" | "sub";
};

const YANGMING_BLOCK_LABELS = [
  "答案",
  "簡答",
  "簡解",
  "詳解",
  "詳寫",
  "參考詳解",
  "答題要訣",
  "參考資料",
  "資料出處",
  "補充",
  "Key",
  "key"
];

const YANGMING_AUTO_SPLIT_LABELS = [
  "答案",
  "簡答",
  "簡解",
  "詳解",
  "詳寫",
  "參考詳解",
  "答題要訣",
  "參考資料",
  "資料出處"
];

function normalizeYangmingLabel(label: string | undefined) {
  if (!label) return "";
  const compactLabel = label.replace(/\s+/g, "");
  if (compactLabel === "詳寫") return "詳解";
  if (compactLabel === "資料出處") return "參考資料";
  return label.trim();
}

function normalizeYangmingPlainText(text: string) {
  const labelPattern = YANGMING_AUTO_SPLIT_LABELS.join("|");
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/```[a-zA-Z]*\s*/g, "")
    .replace(/```/g, "")
    .replace(/^\s*`\s*$/gm, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(new RegExp(`([^\\n])\\s*(${labelPattern})\\s*([：:])`, "g"), "$1\n\n$2$3")
    .replace(/詳寫\s*[：:]/g, "詳解：")
    .replace(/([^\n])\s*([（(][A-D][)）])/g, "$1\n$2")
    .replace(/([^\nA-Za-z0-9])\s*([A-D])\s*([.．、：:])(?=\s*[\u4e00-\u9fffA-Za-z0-9])/g, "$1\n$2$3")
    .replace(/([。！？；;])\s*(\([A-D]\)|[A-D][.．、：:])(?=\s*[\u4e00-\u9fffA-Za-z0-9])/g, "$1\n$2")
    .replace(/([^\n])\s+(\([A-D]\)|[A-D][.．、：:])(?=\s*[\u4e00-\u9fffA-Za-z0-9])/g, "$1\n$2")
    .replace(/([。！？；;])\s*(\d+[.．、])(?=\s*[\u4e00-\u9fffA-Za-z0-9])/g, "$1\n$2")
    .replace(/\n\s*[、，,]\s*\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitYangmingParagraphs(text: string) {
  const normalized = normalizeYangmingPlainText(text);
  if (!normalized) return [];
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isStandaloneLabel(text: string) {
  const compactText = text.replace(/\s+/g, "").replace(/[：:]/g, "");
  return YANGMING_BLOCK_LABELS.some((label) => compactText === label);
}

function compactYangmingText(text: string) {
  return normalizeYangmingPlainText(text)
    .replace(/\s+/g, "")
    .replace(/[、，,.:：;；`'"「」『』()（）\[\]{}<>《》|\\/_\-—~。．·•]/g, "");
}

function hasMeaningfulCorrectionText(text: string | null | undefined) {
  return normalizeYangmingPlainText(text ?? "").length >= 10;
}

function getSectionPlainText(sections: NonNullable<YangmingExplanationContent["sections"]>) {
  return sections
    .map((section) => {
      if (section.kind === "image") return "";
      return section.text || section.runs?.map((run) => run.text).join("") || "";
    })
    .join("\n");
}

function shouldRenderBodyBackup(content: YangmingExplanationContent) {
  const sections = content.sections ?? [];
  if (!sections.length || !content.body) return false;

  const bodyText = compactYangmingText(content.body);
  const sectionText = compactYangmingText(getSectionPlainText(sections));
  if (bodyText.length < 80) return false;
  if (sectionText.length < 20) return true;
  if (bodyText.length > sectionText.length + 180 && sectionText.length / bodyText.length < 0.82) return true;

  const bodyMiddleStart = Math.floor(bodyText.length * 0.35);
  const bodyMiddle = bodyText.slice(bodyMiddleStart, bodyMiddleStart + 120);
  return bodyMiddle.length >= 80 && !sectionText.includes(bodyMiddle);
}

function renderFormattedPlainText(text: string, keyPrefix: string) {
  const paragraphs = splitYangmingParagraphs(text);
  if (!paragraphs.length) return null;

  return (
    <div className="max-w-full space-y-2.5 break-words [overflow-wrap:anywhere]">
      {paragraphs.map((paragraph, paragraphIndex) => {
        const labelMatch = paragraph.match(/^([^：:\n]{1,8})[：:]\s*([\s\S]*)$/);
        const rawLabel = labelMatch ? normalizeYangmingLabel(labelMatch[1]) : "";
        const body = labelMatch ? labelMatch[2].trim() : paragraph;
        const isLabelBlock = rawLabel && YANGMING_BLOCK_LABELS.includes(rawLabel);
        if (isLabelBlock) {
          return (
            <div key={`${keyPrefix}-paragraph-${paragraphIndex}`} className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                {rawLabel}
              </p>
              {body ? (
                <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-800">{body}</p>
              ) : null}
            </div>
          );
        }

        return (
          <p
            key={`${keyPrefix}-paragraph-${paragraphIndex}`}
            className="whitespace-pre-wrap text-[15px] leading-8 text-slate-800"
          >
            {paragraph}
          </p>
        );
      })}
    </div>
  );
}

function renderRunSpan(run: YangmingTextRun, key: string) {
  return (
    <span
      key={key}
      className={
        run.script === "super"
          ? "align-super text-[0.72em]"
          : run.script === "sub"
            ? "align-sub text-[0.72em]"
            : undefined
      }
    >
      {run.text}
    </span>
  );
}

function renderFormattedRuns(runs: YangmingTextRun[], keyPrefix: string) {
  const hasScriptRuns = runs.some((run) => run.script);
  if (!hasScriptRuns) {
    return renderFormattedPlainText(runs.map((run) => run.text).join(""), keyPrefix);
  }

  return (
    <div className="max-w-full whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-800 [overflow-wrap:anywhere]">
      {runs.map((run, runIndex) => renderRunSpan(run, `${keyPrefix}-run-${runIndex}`))}
    </div>
  );
}

function YangmingAssetImage({
  asset,
  imageMaxHeight,
  imageWidth
}: {
  asset: NonNullable<YangmingExplanationContent["assets"]>[number];
  imageMaxHeight: string;
  imageWidth: number | undefined;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900 ring-1 ring-amber-100">
        <p>這張原頁截圖暫時讀不到，可能是圖片還沒同步到雲端。</p>
        {asset.storagePath || asset.src ? (
          <p className="mt-1 break-words text-xs font-medium text-amber-800/75 [overflow-wrap:anywhere]">
            圖片路徑：{asset.storagePath || asset.src}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-32 max-w-full items-center justify-center overflow-hidden rounded-xl bg-slate-50/60">
      {!loaded ? (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-semibold text-slate-400">
          原頁截圖載入中...
        </div>
      ) : null}
      <img
        src={asset.src}
        alt={asset.alt ?? ""}
        loading="lazy"
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
            setFailed(true);
            return;
          }
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
        className={`relative z-10 h-auto ${imageMaxHeight} max-w-full object-contain transition-opacity ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: imageWidth ? "100%" : undefined, maxWidth: imageWidth }}
      />
    </div>
  );
}

function renderRawTextBackup(text: string) {
  if (!text.trim()) return null;
  return (
    <details className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200">
      <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-[0.18em] text-slate-600">
        原始完整文字
      </summary>
      <div className="mt-3 max-h-[520px] max-w-full overflow-auto rounded-xl bg-white/80 p-3 text-[13px] leading-7 text-slate-700 ring-1 ring-slate-100">
        <pre className="whitespace-pre-wrap break-words font-sans [overflow-wrap:anywhere]">
          {text}
        </pre>
      </div>
    </details>
  );
}

function renderAssetFigure(
  asset: NonNullable<YangmingExplanationContent["assets"]>[number] | undefined,
  fallbackKey: string,
  sectionFallback = false
) {
  if (!asset?.src) return null;
  const isPrimarySnapshot = asset.kind === "question_snapshot";
  if (!isPrimarySnapshot && (asset.kind === "image" || asset.kind === "table")) {
    return null;
  }
  const isFallback = !isPrimarySnapshot && (sectionFallback || asset.fallback || asset.kind === "page_snapshot");
  const isAuthoritativeAsset = isPrimarySnapshot;
  const imageMaxHeight = isAuthoritativeAsset ? "max-h-[920px]" : isFallback ? "max-h-[760px]" : "max-h-[520px]";
  const imageWidth = asset.width ? Math.min(asset.width, isAuthoritativeAsset ? 980 : isFallback ? 920 : 760) : undefined;

  return (
    <figure
      key={fallbackKey}
      className={`my-3 min-w-0 max-w-full overflow-hidden rounded-2xl bg-white/80 p-2 ring-1 ${
        isFallback ? "ring-amber-100" : "ring-slate-200"
      }`}
    >
      <div className="max-w-full overflow-x-auto">
        <YangmingAssetImage asset={asset} imageMaxHeight={imageMaxHeight} imageWidth={imageWidth} />
      </div>
    </figure>
  );
}

function isAuthoritativeYangmingAsset(asset: NonNullable<YangmingExplanationContent["assets"]>[number] | undefined) {
  return asset?.kind === "question_snapshot";
}

function YangmingExplanationContentBlock({
  content,
  onReport,
  onCorrect
}: {
  content: YangmingExplanationContent;
  onReport: () => void;
  onCorrect: () => void;
}) {
  const sections = content.sections ?? [];
  const assets = content.assets ?? [];
  const hasStructuredSections = sections.length > 0;
  const renderBodyBackup = shouldRenderBodyBackup(content);
  const primarySnapshotAssets = assets
    .map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => isAuthoritativeYangmingAsset(asset));
  const hasPrimarySnapshots = primarySnapshotAssets.length > 0;
  const shouldRenderStructuredSections = hasStructuredSections && !hasPrimarySnapshots;
  const shouldRenderLooseAssets = !hasStructuredSections && !hasPrimarySnapshots && assets.length > 0;
  const primarySnapshotIndexes = new Set(primarySnapshotAssets.map(({ index }) => index));
  const referencedAssetIndexes = new Set(
    sections
      .map((section) => section.assetIndex)
      .filter((assetIndex): assetIndex is number => typeof assetIndex === "number")
  );
  const unreferencedFallbackAssets = hasStructuredSections
    ? assets
        .map((asset, index) => ({ asset, index }))
        .filter(
          ({ asset, index }) =>
            !referencedAssetIndexes.has(index) && (asset.fallback || asset.kind === "page_snapshot")
        )
    : [];

  function renderAsset(assetIndex: number | undefined, fallbackKey: string, sectionFallback = false) {
    if (typeof assetIndex !== "number") return null;
    return renderAssetFigure(assets[assetIndex], fallbackKey, sectionFallback);
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-3xl bg-white/70 p-3 text-sm leading-7 text-slate-800 ring-1 ring-white/70 [overflow-wrap:anywhere] sm:p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onCorrect}
            className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800 ring-1 ring-teal-100 transition hover:bg-teal-100"
          >
            修正詳解
          </button>
          <button
            type="button"
            onClick={onReport}
            className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 transition hover:bg-amber-100"
          >
            回報陽明詳解
          </button>
        </div>
        {content.author || content.reviewer ? (
          <p className="min-w-0 break-words text-left text-[11px] font-semibold leading-5 text-slate-500 [overflow-wrap:anywhere] sm:text-right">
            {content.author ? `撰寫：${content.author}` : ""}
            {content.author && content.reviewer ? "　" : ""}
            {content.reviewer ? `審稿：${content.reviewer}` : ""}
          </p>
        ) : null}
      </div>
      {primarySnapshotAssets.length ? (
        <section className="mb-4 min-w-0 max-w-full overflow-hidden">
          <div className="grid min-w-0 max-w-full gap-3 overflow-hidden">
            {primarySnapshotAssets.map(({ asset, index }) =>
              renderAssetFigure(asset, `yangming-primary-snapshot-${index}`, true)
            )}
          </div>
        </section>
      ) : null}
      {shouldRenderStructuredSections ? (
        <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
          {sections.map((section, index) => {
            if (section.kind === "image") {
              if (
                typeof section.assetIndex === "number" &&
                primarySnapshotIndexes.has(section.assetIndex)
              ) {
                return null;
              }
              return renderAsset(section.assetIndex, `yangming-section-image-${index}`, section.fallback);
            }

            return (
              <section key={`yangming-section-${index}`} className="min-w-0 max-w-full overflow-hidden">
                {section.label && !isStandaloneLabel(section.text ?? "") ? (
                  <p className="mb-1 break-words text-xs font-black uppercase tracking-[0.18em] text-teal-700 [overflow-wrap:anywhere]">
                    {normalizeYangmingLabel(section.label)}
                  </p>
                ) : null}
                {section.runs?.length ? (
                  renderFormattedRuns(section.runs, `yangming-section-${index}`)
                ) : section.text ? (
                  renderFormattedPlainText(section.text, `yangming-section-${index}`)
                ) : null}
              </section>
            );
          })}
          {!hasPrimarySnapshots && renderBodyBackup ? (
            <section className="min-w-0 max-w-full overflow-hidden rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-800">
                完整文字
              </p>
              <p className="mb-2 text-xs font-semibold leading-5 text-amber-800/75">
                結構化詳解可能有漏段，這裡自動補上原始完整文字。
              </p>
              {renderFormattedPlainText(content.body, "yangming-body-backup")}
            </section>
          ) : null}
        </div>
      ) : !hasPrimarySnapshots ? (
        renderFormattedPlainText(content.body, "yangming-body")
      ) : null}
      {!hasPrimarySnapshots ? renderRawTextBackup(content.body) : null}
      {!hasPrimarySnapshots && unreferencedFallbackAssets.length ? (
        <details
          className="mt-4 min-w-0 max-w-full overflow-hidden rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-100"
          open={renderBodyBackup || undefined}
        >
          <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-[0.18em] text-amber-800">
            補充圖片
          </summary>
          <div className="mt-3 grid min-w-0 max-w-full gap-3 overflow-hidden">
            {unreferencedFallbackAssets.map(({ asset, index }) =>
              renderAssetFigure(asset, `yangming-unreferenced-fallback-${index}`, true)
            )}
          </div>
        </details>
      ) : null}
      {shouldRenderLooseAssets ? (
        <div className="mt-4 grid min-w-0 max-w-full gap-3 overflow-hidden">
          {assets.map((asset, index) =>
            primarySnapshotIndexes.has(index) ? null : renderAssetFigure(asset, asset.src)
          )}
        </div>
      ) : null}
      {content.sourceLabel || content.sourceFile ? (
        <p className="mt-4 break-words text-[11px] font-medium leading-5 text-slate-400 [overflow-wrap:anywhere]">
          資料來源：{content.sourceLabel ?? content.sourceFile}
          {content.sourcePageStart
            ? `，第 ${content.sourcePageStart}${content.sourcePageEnd && content.sourcePageEnd !== content.sourcePageStart ? `-${content.sourcePageEnd}` : ""} 頁`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

export function YangmingExplanationPanel({
  questionId,
  className = "",
  buttonClassName = "",
  compact = false
}: Props) {
  const { session } = useAuth();
  const activeQuestionIdRef = useRef(questionId);
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<YangmingExplanationContent | null>(null);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMode, setReportMode] = useState<"report" | "correction">("report");
  const [reportReason, setReportReason] = useState("");
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [keptAssetIndexes, setKeptAssetIndexes] = useState<number[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    activeQuestionIdRef.current = questionId;
    setExpanded(false);
    setChecked(false);
    setLoading(false);
    setContent(null);
    setError("");
    setReportOpen(false);
    setReportMessage("");
  }, [questionId]);

  async function loadYangmingExplanation() {
    if (loading) return;
    if (expanded && checked) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (checked) return;

    setLoading(true);
    setError("");
    try {
      if (yangmingExplanationCache.has(questionId)) {
        if (activeQuestionIdRef.current !== questionId) return;
        setContent(yangmingExplanationCache.get(questionId) ?? null);
        setChecked(true);
        return;
      }

      let pendingRequest = yangmingExplanationPromiseCache.get(questionId);
      if (!pendingRequest) {
        pendingRequest = fetch("/api/yangming-explanation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ questionId })
        })
          .then(async (response) => {
            const payload = (await response.json().catch(() => null)) as YangmingExplanationResponse | null;
            if (!response.ok || !payload?.ok) {
              throw new Error(payload?.message || "陽明詳解載入失敗。");
            }
            if (payload.degraded && !payload.explanation) {
              throw new Error(payload.message || "陽明詳解暫時讀不到，晚點再試一次。");
            }
            return payload.explanation ?? null;
          })
          .then((nextContent) => {
            yangmingExplanationCache.set(questionId, nextContent);
            return nextContent;
          })
          .finally(() => {
            yangmingExplanationPromiseCache.delete(questionId);
          });
        yangmingExplanationPromiseCache.set(questionId, pendingRequest);
      }
      const nextContent = await pendingRequest;
      if (activeQuestionIdRef.current !== questionId) return;
      setContent(nextContent);
      setChecked(true);
    } catch (requestError) {
      if (activeQuestionIdRef.current !== questionId) return;
      setError(requestError instanceof Error ? requestError.message : "無法連線到陽明詳解 API。");
      setContent(null);
      setChecked(true);
    } finally {
      if (activeQuestionIdRef.current === questionId) {
        setLoading(false);
      }
    }
  }

  function openReportDialog() {
    setReportMode("report");
    setReportReason("");
    setCorrectionDraft("");
    setKeptAssetIndexes([]);
    setReportMessage("");
    setReportOpen(true);
  }

  function openCorrectionDialog() {
    if (!content) return;
    setReportMode("correction");
    setReportReason("修正陽明詳解內容");
    setCorrectionDraft(content.body ?? "");
    setKeptAssetIndexes((content.assets ?? []).map((_, index) => index));
    setReportMessage("");
    setReportOpen(true);
  }

  function toggleCorrectionAsset(index: number) {
    setKeptAssetIndexes((current) =>
      current.includes(index)
        ? current.filter((assetIndex) => assetIndex !== index)
        : [...current, index].sort((a, b) => a - b)
    );
  }

  async function submitReport() {
    if (reportMode === "correction" && !content) return;
    if (!session?.access_token) {
      setReportMessage("請先登入帳號，才能回報或修正陽明詳解。");
      return;
    }
    if (reportReason.trim().length < 2) {
      setReportMessage("請簡單填一下回報原因。");
      return;
    }
    const hasCorrectionText =
      reportMode === "correction" &&
      (hasMeaningfulCorrectionText(correctionDraft) || hasMeaningfulCorrectionText(content?.body));
    const hasKeptAssets = reportMode === "correction" && keptAssetIndexes.length > 0;
    if (reportMode === "correction" && !hasCorrectionText && !hasKeptAssets) {
      setReportMessage("請至少保留一張詳解圖片，或填入主要詳解文字。");
      return;
    }

    setReportLoading(true);
    setReportMessage("");
    try {
      const response = await fetch("/api/yangming-explanation-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          accessToken: session.access_token,
          visitorId: getOrCreateVisitorId(),
          questionId,
          reason: reportReason,
          reportType: reportMode,
          proposedBody:
            reportMode === "correction"
              ? hasMeaningfulCorrectionText(correctionDraft)
                ? correctionDraft
                : content?.body ?? ""
              : undefined,
          keptAssetIndexes: reportMode === "correction" ? keptAssetIndexes : undefined,
          sourceLabel: content?.sourceLabel,
          sourceFile: content?.sourceFile
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !payload?.ok) {
        setReportMessage(payload?.message || "回報失敗，請再試一次。");
        return;
      }
      if (reportMode === "correction" && content) {
        const correctedContent = {
          ...content,
          body: hasMeaningfulCorrectionText(correctionDraft)
            ? correctionDraft.trim()
            : content.body ?? "",
          sections: [],
          assets: (content.assets ?? []).filter((_, index) => keptAssetIndexes.includes(index))
        };
        setContent(correctedContent);
        yangmingExplanationCache.set(questionId, correctedContent);
      }
      setReportMessage(reportMode === "correction" ? "已採用修正版，謝謝你幫大家補洞。" : "已收到回報。");
      window.setTimeout(() => setReportOpen(false), 900);
    } catch {
      setReportMessage("無法連線到回報 API，請再試一次。");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className={`min-w-0 max-w-full overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => void loadYangmingExplanation()}
        disabled={loading}
        className={
          buttonClassName ||
          "min-h-10 rounded-2xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-100 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
        }
      >
        {loading ? "陽明詳解載入中..." : expanded ? "收合陽明詳解" : "顯示陽明詳解"}
      </button>

      {expanded ? (
        <div className={`min-w-0 max-w-full overflow-hidden ${compact ? "mt-3" : "mt-4"}`}>
          {error ? (
            <div className="rounded-3xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100 [overflow-wrap:anywhere]">
              {error}
            </div>
          ) : content ? (
            <YangmingExplanationContentBlock
              content={content}
              onReport={openReportDialog}
              onCorrect={openCorrectionDialog}
            />
          ) : checked ? (
            <div className="rounded-3xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-600 ring-1 ring-white/70 [overflow-wrap:anywhere]">
              <p>此題沒有陽明詳解。</p>
              <button
                type="button"
                onClick={openReportDialog}
                className="mt-3 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-100 transition hover:bg-amber-100"
              >
                回報陽明詳解
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {reportOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-3 py-6 backdrop-blur-sm"
          onClick={() => {
            if (!reportLoading) setReportOpen(false);
          }}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:max-w-lg sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
                  Yangming Report
                </p>
                <h2 className="mt-2 break-words text-xl font-black text-ink [overflow-wrap:anywhere]">
                  {reportMode === "correction" ? "修正陽明詳解" : "回報陽明詳解"}
                </h2>
                <p className="mt-2 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
                  {reportMode === "correction"
                    ? "修正版會立刻套用到這題詳解，同時保留原文與修訂紀錄。"
                    : "可以寫「圖片不對」「表格漏掉」「詳解對錯題」這種原因。"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportLoading}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
              >
                關閉
              </button>
            </div>

            {reportMode === "correction" ? (
              <div className="mt-4">
                <label className="text-sm font-bold text-slate-800" htmlFor="yangming-correction">
                  修正版詳解
                </label>
                <textarea
                  id="yangming-correction"
                  value={correctionDraft}
                  onChange={(event) => setCorrectionDraft(event.target.value)}
                  className="mt-2 h-52 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-teal-300 focus:bg-white"
                  maxLength={30000}
                  placeholder="直接修改這題陽明詳解文字..."
                />
                <p className="mt-1 text-right text-xs text-slate-400">{correctionDraft.length}/30000</p>

                {content?.assets?.length ? (
                  <div className="mt-4 rounded-3xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-amber-900">保留圖片 / 表格</p>
                      <p className="text-xs font-semibold text-amber-800">
                        已保留 {keptAssetIndexes.length} / {content.assets.length}
                      </p>
                    </div>
                    <div className="mt-3 grid max-h-64 gap-3 overflow-y-auto pr-1">
                      {content.assets.map((asset, index) => {
                        const isKept = keptAssetIndexes.includes(index);
                        return (
                          <label
                            key={`${asset.src}-${index}`}
                            className={`flex min-w-0 cursor-pointer gap-3 overflow-hidden rounded-2xl bg-white p-2 ring-1 transition ${
                              isKept ? "ring-teal-200" : "opacity-55 ring-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isKept}
                              onChange={() => toggleCorrectionAsset(index)}
                              className="mt-2"
                            />
                            <img
                              src={asset.src}
                              alt={asset.alt ?? ""}
                              loading="lazy"
                              className="h-20 w-24 shrink-0 rounded-xl object-contain ring-1 ring-slate-100"
                            />
                            <span className="min-w-0 flex-1 break-words text-xs font-semibold leading-5 text-slate-600 [overflow-wrap:anywhere]">
                              {asset.alt || asset.storagePath || `圖片 ${index + 1}`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-amber-800">
                      取消勾選只會移除這題詳解裡的圖片引用，不會刪掉原始檔。
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <label className="text-sm font-bold text-slate-800" htmlFor="yangming-report-reason">
                {reportMode === "correction" ? "修正原因" : "回報原因"}
              </label>
              {reportMode === "report" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {YANGMING_REPORT_REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReportReason(preset)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${
                        reportReason.trim() === preset
                          ? "bg-amber-600 text-white ring-amber-600"
                          : "bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              ) : null}
              <textarea
                id="yangming-report-reason"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="mt-2 h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-amber-300 focus:bg-white"
                maxLength={1200}
                placeholder="例如：這題詳解貼到下一題、表格被截斷、圖片不對..."
              />
              <p className="mt-1 text-right text-xs text-slate-400">{reportReason.length}/1200</p>
            </div>

            {reportMessage ? (
              <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {reportMessage}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                disabled={reportLoading}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={reportLoading}
                className="rounded-2xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
              >
                {reportLoading ? "送出中..." : reportMode === "correction" ? "套用修正版" : "送出回報"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
