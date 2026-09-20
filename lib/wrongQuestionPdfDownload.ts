import type { WrongQuestionPdfItem } from "./wrongQuestionPdf";

const FONT_URL = "/fonts/pdf/NotoSerifTC-Regular.otf";
let cachedFont: Uint8Array | undefined;

async function fetchAsset(url: string, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 60000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: new URL(url, window.location.origin).origin === window.location.origin ? "same-origin" : "omit"
    });
    if (!response.ok) throw new Error("檔案載入失敗，請稍後重試。");
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}

async function loadPdfImage(source: string, signal: AbortSignal): Promise<{ bytes: Uint8Array; type: "png" | "jpg" }> {
  const url = new URL(source, window.location.origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("題目附圖格式無法使用，請重新整理後再試。");
  let bytes: Uint8Array;
  try { bytes = await fetchAsset(url.href, signal); }
  catch { throw new Error("有題目附圖未能載入，PDF 尚未下載。請確認網路後重試。"); }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, type: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, type: "jpg" };
  // Browser-supported formats such as WebP are converted without sending content to a server.
  const blobUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer]));
  try {
    const image = new Image();
    image.src = blobUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40000000) throw new Error("image-size");
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("image-conversion")), "image/png"));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: "png" };
  } catch {
    throw new Error("有題目附圖無法轉入 PDF，尚未下載。請重新整理後再試。");
  } finally { URL.revokeObjectURL(blobUrl); }
}

export async function downloadWrongQuestionPdf({ items, spacingCm, scopeLabel, dateLabel, filename, signal, onProgress }: {
  items: readonly WrongQuestionPdfItem[];
  spacingCm: number;
  scopeLabel: string;
  dateLabel: string;
  filename: string;
  signal: AbortSignal;
  onProgress: (message: string) => void;
}) {
  const checkCancelled = () => { if (signal.aborted) throw new DOMException("Export cancelled", "AbortError"); };
  onProgress("正在準備 PDF…");
  const { createWrongQuestionPdfDocument } = await import("./wrongQuestionPdfDocument");
  checkCancelled();
  if (!cachedFont) {
    onProgress("正在載入中文字型…");
    try { cachedFont = await fetchAsset(FONT_URL, signal); }
    catch { checkCancelled(); throw new Error("中文字型未能載入，請確認網路後重試。"); }
  }
  checkCancelled();
  const bytes = await createWrongQuestionPdfDocument({
    items, spacingCm, scopeLabel, dateLabel, fontBytes: cachedFont,
    loadImage: (source) => { checkCancelled(); return loadPdfImage(source, signal); },
    onProgress: (completed, total) => { checkCancelled(); onProgress(`正在整理題目 ${completed}／${total}…`); }
  });
  checkCancelled();
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the URL alive long enough for Safari to finish handing off the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
