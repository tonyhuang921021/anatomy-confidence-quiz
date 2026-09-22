import fontkit from "@pdf-lib/fontkit";
import { PDFArray, PDFContentStream, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, PageSizes, decodePDFRawStream, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { tokenizeWrongQuestionPdfText } from "./wrongQuestionPdfText";
import { prepareWrongQuestionPdfQuestion } from "./wrongQuestionPdfSourceText";
import type { WrongQuestionPdfItem } from "./wrongQuestionPdf";
import type { OptionKey } from "../types/quiz";

export type WrongQuestionPdfImage = { bytes: Uint8Array; type: "png" | "jpg" };
export type WrongQuestionPdfDocumentOptions = {
  items: readonly WrongQuestionPdfItem[];
  spacingCm: number;
  scopeLabel: string;
  dateLabel: string;
  fontBytes: Uint8Array;
  loadFallbackFont?: () => Promise<Uint8Array>;
  loadImage: (src: string) => Promise<WrongQuestionPdfImage>;
  onProgress?: (done: number, total: number) => void | Promise<void>;
};

type Run = { text: string; size: number; rise: number; width: number };
type Unit = { runs: Run[]; width: number; newline?: boolean };
type Line = { runs: Run[]; width: number };
type Fragment =
  | { kind: "text"; line: Line; offset: number; size: number; height: number; gray: number; label?: string; labelOffset?: number }
  | { kind: "image"; image: PDFImage; offset: number; width: number; height: number }
  | { kind: "space"; height: number; rule?: boolean };

const MM = 72 / 25.4;
const MARGIN_X = 16 * MM;
const MARGIN_Y = 15 * MM;
const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const PAGE_CAPACITY = PAGE_HEIGHT - MARGIN_Y * 2;
const BODY_SIZE = 11;
const BODY_LINE_HEIGHT = 18;
const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];
const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function unsupportedCharacterError(character: string) {
  return new Error(`PDF 字型不支援字元「${character}」（U+${character.codePointAt(0)!.toString(16).toUpperCase()}），請回報此題，避免匯出缺字。`);
}

function sourceLabel(question: WrongQuestionPdfItem["question"]) {
  return question.sourceYear
    ? `${question.sourceYear >= 1912 ? question.sourceYear - 1911 : question.sourceYear} 年${question.sourceRound ? `第 ${question.sourceRound} 次` : ""}${question.originalQuestionNumber ? ` · 原第 ${question.originalQuestionNumber} 題` : ""}`
    : question.sourceType === "AI_GENERATED" ? "自訂練習題" : "練習題";
}

/** A CID-keyed CFF charset maps glyph indices to CIDs. They are not generally
 * interchangeable (the smaller Noto TC font retains sparse original CIDs).
 * Emit actual CIDs with Identity-H, including in ToUnicode. Apple readers can
 * select wrong/missing glyphs through a custom GID-to-CID Encoding CMap.
 * Embed the original CFF table unchanged: readers disagree about the OpenType
 * wrapper's CID selection, whereas CIDFontType0C has one unambiguous mapping.
 */
function embedOriginalCidCff(document: PDFDocument, font: PDFFont, fontBytes: Uint8Array) {
  type CffFont = {
    numGlyphs: number;
    directory: { tables: Record<string, { offset: number; length: number }> };
    "CFF ": {
      isCIDFont: boolean;
      topDict: { ROS: [number, number, number]; charset: {
        version: number; glyphs?: number[]; ranges?: { first: number; nLeft: number }[];
      } };
      string: (sid: number) => string;
    };
  };
  const parsed = fontkit.create(fontBytes) as unknown as CffFont;
  const cff = parsed["CFF "];
  const table = parsed.directory.tables["CFF "];
  if (!cff?.isCIDFont || !table || table.offset < 0 || table.length <= 0 || table.offset + table.length > fontBytes.length) {
    throw new Error("PDF 字型格式不支援，未產生檔案。");
  }
  const glyphToCid = [0];
  const charset = cff.topDict.charset;
  if (charset.version === 0 && charset.glyphs) glyphToCid.push(...charset.glyphs);
  else if ([1, 2].includes(charset.version) && charset.ranges) {
    for (const range of charset.ranges) for (let offset = 0; offset <= range.nLeft; offset += 1) glyphToCid.push(range.first + offset);
  }
  if (glyphToCid.length !== parsed.numGlyphs || new Set(glyphToCid).size !== glyphToCid.length ||
      glyphToCid.some((cid) => !Number.isInteger(cid) || cid < 0 || cid > 0xffff)) {
    throw new Error("PDF 字型字碼對應不完整，未產生檔案。");
  }
  const [registryId, orderingId, supplement] = cff.topDict.ROS;
  const registry = PDFString.of(cff.string(registryId));
  const ordering = PDFString.of(cff.string(orderingId));
  const systemInfo = { Registry: registry, Ordering: ordering, Supplement: supplement };
  const cidHex = (code: string) => {
    const cid = glyphToCid[parseInt(code, 16)];
    if (code.length !== 4 || cid === undefined) throw new Error("PDF 字型字碼對應不完整，未產生檔案。");
    return cid.toString(16).padStart(4, "0").toUpperCase();
  };
  // This renderer uses one font and emits hex Tj text operators. Convert those
  // codes after the final draw/flush, without modifying embedded image streams.
  for (const page of document.getPages()) {
    const contents = page.node.Contents();
    const references = contents instanceof PDFArray ? contents.asArray() : [contents];
    for (const reference of references) {
      if (!(reference instanceof PDFRef)) throw new Error("PDF 文字編碼失敗，未產生檔案。");
      const stream = document.context.lookup(reference);
      const content = stream instanceof PDFContentStream ? stream.getContentsString()
        : stream instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(stream).decode()) : undefined;
      if (content === undefined) throw new Error("PDF 文字編碼失敗，未產生檔案。");
      const rewritten = content.replace(/<([a-f\d]+)>\s*Tj/gi, (_, codes: string) => {
        if (codes.length % 4 !== 0) throw new Error("PDF 文字編碼失敗，未產生檔案。");
        return `<${codes.match(/.{4}/g)!.map(cidHex).join("")}> Tj`;
      });
      document.context.assign(reference, document.context.flateStream(rewritten));
    }
  }
  const fontDictionary = document.context.lookup(font.ref, PDFDict);
  const unicodeReference = fontDictionary.get(PDFName.of("ToUnicode"));
  if (!(unicodeReference instanceof PDFRef)) throw new Error("PDF 文字編碼失敗，未產生檔案。");
  const unicodeStream = document.context.lookup(unicodeReference);
  if (!(unicodeStream instanceof PDFRawStream)) throw new Error("PDF 文字編碼失敗，未產生檔案。");
  const unicode = new TextDecoder().decode(decodePDFRawStream(unicodeStream).decode());
  const rewrittenUnicode = unicode.replace(/beginbfchar([\s\S]*?)endbfchar/g, (_, block: string) =>
    `beginbfchar${block.replace(/<([a-f\d]+)>\s*<([a-f\d]+)>/gi, (_, code: string, target: string) => `<${cidHex(code)}> <${target}>`)}endbfchar`);
  document.context.assign(unicodeReference, document.context.flateStream(rewrittenUnicode));
  fontDictionary.set(PDFName.of("Encoding"), PDFName.of("Identity-H"));
  const descendant = fontDictionary.lookup(PDFName.of("DescendantFonts"), PDFArray).lookup(0, PDFDict);
  const oldWidths = descendant.lookup(PDFName.of("W"), PDFArray).asArray();
  const widths: (number | number[])[] = [];
  for (let index = 0; index < oldWidths.length; index += 2) {
    const first = (oldWidths[index] as PDFNumber).asNumber();
    const values = (oldWidths[index + 1] as PDFArray).asArray();
    values.forEach((value, offset) => widths.push(glyphToCid[first + offset], [(value as PDFNumber).asNumber()]));
  }
  descendant.set(PDFName.of("W"), document.context.obj(widths));
  descendant.set(PDFName.of("CIDSystemInfo"), document.context.obj(systemInfo));
  descendant.set(PDFName.of("Subtype"), PDFName.of("CIDFontType0"));
  descendant.delete(PDFName.of("CIDToGIDMap"));
  const descriptor = descendant.lookup(PDFName.of("FontDescriptor"), PDFDict);
  const fontFile = descriptor.get(PDFName.of("FontFile3")) ?? descriptor.get(PDFName.of("FontFile2"));
  if (!(fontFile instanceof PDFRef)) throw new Error("PDF 字型嵌入失敗，請重新嘗試下載。");
  // Replace the wrapper stream, so unused OpenType bytes are not also saved.
  document.context.assign(fontFile, document.context.flateStream(fontBytes.subarray(table.offset, table.offset + table.length), { Subtype: "CIDFontType0C" }));
  descriptor.delete(PDFName.of("FontFile2"));
  descriptor.set(PDFName.of("FontFile3"), fontFile);
}

class TextLayout {
  private readonly characters: Set<number>;
  private readonly characterWidths = new Map<string, number>();
  constructor(private readonly font: PDFFont) {
    this.characters = new Set(font.getCharacterSet());
  }

  width(text: string, size: number) {
    let width = 0;
    for (const character of text) {
      const code = character.codePointAt(0)!;
      if (!this.characters.has(code)) {
        throw unsupportedCharacterError(character);
      }
      let characterWidth = this.characterWidths.get(character);
      if (characterWidth === undefined) {
        characterWidth = this.font.widthOfTextAtSize(character, 1);
        this.characterWidths.set(character, characterWidth);
      }
      width += characterWidth * size;
    }
    return width;
  }

  private run(text: string, size: number, rise = 0): Run {
    return { text, size, rise, width: this.width(text, size) };
  }

  lines(text: string, size: number, maxWidth: number, formatted = false): Line[] {
    const units: Unit[] = [];
    const tokens = tokenizeWrongQuestionPdfText(text, formatted);
    for (const token of tokens) {
      if (token.subscript || token.superscript) {
        const runs = token.text ? [this.run(token.text, size)] : [];
        if (token.subscript) runs.push(this.run(token.subscript, size * 0.68, -size * 0.22));
        if (token.superscript) runs.push(this.run(token.superscript, size * 0.62, size * 0.34));
        const width = runs.reduce((sum, run) => sum + run.width, 0);
        const previous = units.at(-1);
        // Keep a native script with its preceding base while wrapping. Its width
        // advances once, exactly as with a formatted ASCII formula.
        if (!token.text && previous && !previous.newline && !/\s$/u.test(previous.runs.at(-1)?.text ?? "")) {
          previous.runs.push(...runs);
          previous.width += width;
        } else units.push({ runs, width });
      } else {
        const value = token.text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
        for (const segment of value.match(/[A-Za-z0-9]+(?:['’‐‑-][A-Za-z0-9]+)*| +|\n|./gu) ?? []) {
          if (segment === "\n") units.push({ runs: [], width: 0, newline: true });
          else {
            const run = this.run(segment, size);
            if (run.width <= maxWidth) units.push({ runs: [run], width: run.width });
            else for (const character of segment) {
              const piece = this.run(character, size);
              units.push({ runs: [piece], width: piece.width });
            }
          }
        }
      }
    }
    const lines: Line[] = [];
    let current: Line = { runs: [], width: 0 };
    const flush = () => { lines.push(current); current = { runs: [], width: 0 }; };
    for (const unit of units) {
      if (unit.newline) { flush(); continue; }
      if (unit.width > maxWidth) throw new Error("PDF 文字超出可用頁寬，請回報此題。");
      if (current.runs.length && current.width + unit.width > maxWidth + 0.01) flush();
      for (const run of unit.runs) {
        const previous = current.runs.at(-1);
        if (previous && previous.size === run.size && previous.rise === run.rise) {
          previous.text += run.text;
          previous.width += run.width;
        } else current.runs.push({ ...run });
      }
      current.width += unit.width;
    }
    if (current.runs.length || lines.length === 0) flush();
    return lines;
  }
}

/** Builds a downloadable PDF entirely in memory. It performs no network or storage operations. */
export async function createWrongQuestionPdfDocument({ items, spacingCm, scopeLabel, dateLabel, fontBytes, loadFallbackFont, loadImage, onProgress }: WrongQuestionPdfDocumentOptions): Promise<Uint8Array> {
  if (items.length === 0) throw new Error("沒有符合條件的錯題可匯出。");
  if (![0, 2, 4, 6].includes(spacingCm)) throw new Error("請選擇 0、2、4 或 6 公分筆記留白。");
  items = items.map((item) => ({ ...item, question: prepareWrongQuestionPdfQuestion(item.question) }));
  await onProgress?.(0, items.length);
  await yieldToBrowser();
  // Inspect exactly the tokens that can be drawn before embedding. Only the
  // selected font is embedded; ordinary exports do not pay for the full CJK font.
  const required = new Set<string>();
  const requireText = (text: string, formatted = false) => {
    for (const token of tokenizeWrongQuestionPdfText(text, formatted)) {
      for (const character of token.text + (token.subscript ?? "") + (token.superscript ?? "")) {
        if (character !== "\n") required.add(character);
      }
    }
  };
  requireText("錯題練習單國考刷題 · 自主練習共題0123456789. /ABCDE");
  requireText(scopeLabel);
  requireText(dateLabel);
  for (let index = 0; index < items.length; index += 1) {
    const { question, chapter } = items[index];
    requireText(`${question.subject}｜${chapter}`);
    requireText(sourceLabel(question));
    requireText(question.stem, true);
    for (const key of OPTION_KEYS) if (typeof question.options[key] === "string") requireText(question.options[key]!, true);
    if (index % 32 === 31) await yieldToBrowser();
  }
  const missingCharacters = (bytes: Uint8Array) => {
    let characters: Set<number>;
    try { characters = new Set(fontkit.create(bytes).characterSet); }
    catch { throw new Error("PDF 字型無法載入，請重新嘗試下載。"); }
    return Array.from(required).filter((character) => !characters.has(character.codePointAt(0)!));
  };
  let missing = missingCharacters(fontBytes);
  if (missing.length && loadFallbackFont) {
    try { fontBytes = await loadFallbackFont(); }
    catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new Error("PDF 完整中文字型無法載入，請重新嘗試下載。");
    }
    await yieldToBrowser();
    missing = missingCharacters(fontBytes);
  }
  if (missing.length) throw unsupportedCharacterError(missing[0]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const isOpenTypeCff = fontBytes.length >= 4 && String.fromCharCode(...fontBytes.subarray(0, 4)) === "OTTO";
  let font: PDFFont;
  try {
    // fontkit's CFF subset is invalid for Noto Serif TC. Keep the original CFF
    // program; TrueType fonts can still use the smaller, validated subset path.
    // Noto's localized Latin digits use alternate glyphs absent from pdf-lib's
    // full-font width/Unicode tables. Keep the TC font's own cmap glyphs so merged
    // runs and individually measured characters have identical advances.
    font = await document.embedFont(fontBytes, { subset: !isOpenTypeCff, features: { liga: false, kern: false, locl: false } });
  } catch {
    throw new Error("PDF 字型無法載入，請重新嘗試下載。");
  }
  document.setTitle("錯題練習單");
  document.setAuthor("國考刷題");
  document.setSubject("自主練習與筆記訂正");
  document.setCreator("國考刷題");
  const layout = new TextLayout(font);
  const embeddedImages = new Map<string, PDFImage>();
  let page: PDFPage = document.addPage(PageSizes.A4);
  let cursor = PAGE_HEIGHT - MARGIN_Y;
  let pageHasQuestion = false;

  const addPage = () => {
    page = document.addPage(PageSizes.A4);
    cursor = PAGE_HEIGHT - MARGIN_Y;
    pageHasQuestion = false;
  };
  const drawLine = (line: Line, x: number, top: number, size: number, gray = 0) => {
    let position = x;
    for (const run of line.runs) {
      page.drawText(run.text, { x: position, y: top - size + run.rise, size: run.size, font, color: rgb(gray, gray, gray) });
      position += run.width;
    }
  };
  const textFragments = (text: string, options: { offset?: number; size?: number; height?: number; gray?: number; formatted?: boolean; label?: string; labelOffset?: number } = {}): Fragment[] => {
    const { offset = 0, size = BODY_SIZE, height = BODY_LINE_HEIGHT, gray = 0, formatted = false, label, labelOffset } = options;
    return layout.lines(text, size, CONTENT_WIDTH - offset, formatted).map((line, index) => ({
      kind: "text", line, offset, size, height, gray, ...(index === 0 && label ? { label, labelOffset } : {})
    }));
  };
  const drawFragment = (fragment: Fragment) => {
    if (cursor - fragment.height < MARGIN_Y - 0.01) addPage();
    if (fragment.kind === "text") {
      if (fragment.label) {
        drawLine(layout.lines(fragment.label, fragment.size, CONTENT_WIDTH)[0], MARGIN_X + (fragment.labelOffset ?? 0), cursor, fragment.size, fragment.gray);
      }
      drawLine(fragment.line, MARGIN_X + fragment.offset, cursor, fragment.size, fragment.gray);
    } else if (fragment.kind === "image") {
      page.drawImage(fragment.image, { x: MARGIN_X + fragment.offset, y: cursor - fragment.height, width: fragment.width, height: fragment.height });
    } else if (fragment.rule) {
      page.drawLine({ start: { x: MARGIN_X, y: cursor }, end: { x: PAGE_WIDTH - MARGIN_X, y: cursor }, color: rgb(0.83, 0.83, 0.83), thickness: 0.4 });
    }
    cursor -= fragment.height;
  };
  const imageFragments = async (src: string | undefined, offset: number, questionNumber: number): Promise<Fragment[]> => {
    if (!src) return [];
    let image = embeddedImages.get(src);
    if (!image) {
      try {
        const loaded = await loadImage(src);
        if (!loaded.bytes.length || !["png", "jpg"].includes(loaded.type)) throw new Error("Invalid image");
        image = loaded.type === "png" ? await document.embedPng(loaded.bytes) : await document.embedJpg(loaded.bytes);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        throw new Error(`第 ${questionNumber} 題的附圖無法載入，未產生 PDF。請重試，避免遺漏附圖。`);
      }
      embeddedImages.set(src, image);
    }
    if (!(image.width > 0 && image.height > 0)) throw new Error(`第 ${questionNumber} 題的圖片尺寸不正確，未產生 PDF。`);
    const ratio = Math.min(0.75, (CONTENT_WIDTH - offset) / image.width, 85 * MM / image.height);
    return [{ kind: "space", height: 2 * MM }, { kind: "image", image, offset, width: image.width * ratio, height: image.height * ratio }, { kind: "space", height: 2 * MM }];
  };

  const title = layout.lines("錯題練習單", 18, CONTENT_WIDTH)[0];
  drawLine(title, (PAGE_WIDTH - title.width) / 2, cursor, 18);
  cursor -= 28;
  const subtitle = layout.lines("國考刷題 · 自主練習", 9, CONTENT_WIDTH)[0];
  drawLine(subtitle, (PAGE_WIDTH - subtitle.width) / 2, cursor, 9, 0.35);
  cursor -= 24;
  const leftMetadata = `${scopeLabel} · 共 ${items.length} 題`;
  const metadataWidth = (CONTENT_WIDTH - 5 * MM) / 2;
  const leftLines = layout.lines(leftMetadata, 9, metadataWidth);
  const rightLines = layout.lines(dateLabel, 9, metadataWidth);
  for (let index = 0; index < Math.max(leftLines.length, rightLines.length); index += 1) {
    if (leftLines[index]) drawLine(leftLines[index], MARGIN_X, cursor, 9);
    if (rightLines[index]) drawLine(rightLines[index], PAGE_WIDTH - MARGIN_X - rightLines[index].width, cursor, 9);
    cursor -= 14;
  }
  page.drawLine({ start: { x: MARGIN_X, y: cursor - 2 }, end: { x: PAGE_WIDTH - MARGIN_X, y: cursor - 2 }, color: rgb(0.15, 0.15, 0.15), thickness: 0.6 });
  cursor -= 14;
  if (cursor < MARGIN_Y + 50) throw new Error("PDF 範圍說明過長，請縮短後再試。");

  let previousGroup = "";
  for (let index = 0; index < items.length; index += 1) {
    const { question, chapter } = items[index];
    const number = index + 1;
    const group = `${question.subject}｜${chapter}`;
    const heading: Fragment[] = group !== previousGroup
      ? [...textFragments(group, { size: 11, height: 18 }), { kind: "space", height: 3 * MM, rule: true }]
      : [];
    previousGroup = group;
    const source = sourceLabel(question);
    const stemOffset = Math.max(8 * MM, layout.width(`${number}.`, BODY_SIZE) + 2 * MM);
    const fragments: Fragment[] = [
      ...textFragments(source, { size: 8.5, height: 15, gray: 0.4 }),
      ...textFragments(question.stem, { offset: stemOffset, formatted: true, label: `${number}.`, labelOffset: 0 }),
      ...await imageFragments(question.stemImage, stemOffset, number),
      { kind: "space", height: 2 * MM }
    ];
    for (const key of OPTION_KEYS) {
      if (typeof question.options[key] !== "string") {
        if (question.optionImages?.[key]) throw new Error(`第 ${number} 題的選項 ${key} 文字缺漏，未產生 PDF。`);
        continue;
      }
      fragments.push(...textFragments(question.options[key]!, { offset: 15 * MM, formatted: true, label: `${key}.`, labelOffset: 8 * MM }));
      fragments.push(...await imageFragments(question.optionImages?.[key], 15 * MM, number));
      fragments.push({ kind: "space", height: 0.7 * MM });
    }
    if (spacingCm > 0) fragments.push({ kind: "space", height: 3 * MM }, { kind: "space", height: spacingCm * 10 * MM, rule: true });
    fragments.push({ kind: "space", height: 4 * MM });
    const questionHeight = [...heading, ...fragments].reduce((sum, fragment) => sum + fragment.height, 0);
    const remaining = cursor - MARGIN_Y;
    // Avoid a title-only first page for a very long first question.
    if (questionHeight <= PAGE_CAPACITY && questionHeight > remaining && pageHasQuestion) addPage();
    const headingHeight = heading.reduce((sum, fragment) => sum + fragment.height, 0);
    if (headingHeight + 15 + BODY_LINE_HEIGHT > cursor - MARGIN_Y) addPage();
    for (const fragment of heading) drawFragment(fragment);
    const lastContentIndex = fragments.findLastIndex((fragment) => fragment.kind !== "space");
    const finalContentHeight = fragments.slice(lastContentIndex).reduce((sum, fragment) => sum + fragment.height, 0);
    for (let fragmentIndex = 0; fragmentIndex < fragments.length; fragmentIndex += 1) {
      // Keep the last line/image with the requested writing space, even for oversized questions.
      if (fragmentIndex === lastContentIndex && finalContentHeight <= PAGE_CAPACITY && finalContentHeight > cursor - MARGIN_Y) addPage();
      drawFragment(fragments[fragmentIndex]);
      if (fragments[fragmentIndex].kind !== "space") pageHasQuestion = true;
    }
    await onProgress?.(number, items.length);
    await yieldToBrowser();
  }
  const pages = document.getPages();
  for (let index = 0; index < pages.length; index += 1) {
    const label = `${index + 1} / ${pages.length}`;
    pages[index].drawText(label, { x: (PAGE_WIDTH - layout.width(label, 8)) / 2, y: 7.5 * MM, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
  }
  await yieldToBrowser();
  if (isOpenTypeCff) {
    await document.flush();
    embedOriginalCidCff(document, font, fontBytes);
  }
  return document.save();
}
