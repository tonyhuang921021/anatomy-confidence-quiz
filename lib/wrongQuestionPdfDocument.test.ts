import assert from "node:assert/strict";
import fontkit from "@pdf-lib/fontkit";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PageSizes, decodePDFRawStream } from "pdf-lib";
import { createWrongQuestionPdfDocument, type WrongQuestionPdfDocumentOptions } from "./wrongQuestionPdfDocument";
import type { WrongQuestionPdfItem } from "./wrongQuestionPdf";

const fallbackFontBytes = readFile(path.resolve("public/fonts/pdf/NotoSerifCJKtc-Regular.otf"));
const fontBytes = readFile(path.resolve("public/fonts/pdf/NotoSerifTC-Regular.otf"));
const pngBytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64"));
function item(index: number, stem = `題目文字 ${index}`): WrongQuestionPdfItem {
  return { chapter: "既有章節", answeredAt: "2026-09-20T01:00:00Z", question: {
    id: `PRIVATE_QUESTION_ID_${index}`, subject: "解剖學", chapter: "既有章節", section: "既有分類", stem,
    options: { A: "第一個選項", B: "第二個選項", C: "第三個選項", D: "第四個選項" },
    answer: "B", explanation: "ANSWER_EXPLANATION_SECRET", testedConcept: "CONCEPT_SECRET",
    sourceYear: 2026, sourceRound: 2, originalQuestionNumber: index
  } };
}
async function create(items: WrongQuestionPdfItem[], options: Partial<WrongQuestionPdfDocumentOptions> = {}) {
  return createWrongQuestionPdfDocument({ items, spacingCm: 2, scopeLabel: "本次作答錯題", dateLabel: "全部作答日期", fontBytes: await fontBytes, loadImage: async () => ({ bytes: pngBytes, type: "png" }), ...options });
}

function decodeStream(stream: PDFRawStream) {
  return Buffer.from(decodePDFRawStream(stream).decode()).toString("utf8");
}
function readPdfPage(document: PDFDocument, index: number) {
  const page = document.getPage(index);
  const resources = page.node.Resources()!;
  const fontResources = resources.lookup(PDFName.of("Font"), PDFDict);
  const font = document.context.lookup(fontResources.entries()[0][1], PDFDict);
  const cmap = decodeStream(font.lookup(PDFName.of("ToUnicode")) as PDFRawStream);
  const glyphs = new Map<string, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const match of block[1].matchAll(/<([a-f\d]+)>\s*<([a-f\d]+)>/gi)) {
      const codeUnits = match[2].match(/.{4}/g)!.map((code) => parseInt(code, 16));
      glyphs.set(match[1].toUpperCase(), String.fromCharCode(...codeUnits));
    }
  }
  const contents = page.node.Contents()!;
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => document.context.lookup(ref) as PDFRawStream)
    : [contents as PDFRawStream];
  const commands = streams.map(decodeStream).join("\n");
  const text = Array.from(commands.matchAll(/<([a-f\d]+)>\s*Tj/gi)).map((match) =>
    match[1].match(/.{4}/g)!.map((glyph) => glyphs.get(glyph.toUpperCase()) ?? "�").join("")
  ).join("");
  return { page, text, commands, glyphs };
}

test("download bytes reopen as A4 with selectable Chinese text, supplied order and no private answers", async () => {
  const progress: number[] = [];
  const bytes = await create([item(20, "先出現的題目 H2O 與 PaCO2"), item(2, "接著出現的題目")], { onProgress: async (done) => { progress.push(done); } });
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), "%PDF");
  const document = await PDFDocument.load(bytes);
  for (const page of document.getPages()) assert.deepEqual([page.getWidth(), page.getHeight()], PageSizes.A4);
  const text = document.getPages().map((_, index) => readPdfPage(document, index).text).join("");
  assert.match(text, /錯題練習單/);
  assert.match(text, /原第 20 題/);
  assert.match(text, /原第 2 題/);
  assert.ok(text.indexOf("先出現的題目") < text.indexOf("接著出現的題目"));
  assert.match(text, /H2O 與 PaCO2/);
  assert.doesNotMatch(text, /PRIVATE_QUESTION_ID|ANSWER_EXPLANATION_SECRET|CONCEPT_SECRET|正確答案|�/);
  assert.deepEqual(progress, [0, 1, 2]);
  const descendants = document.context.lookup(document.getPage(0).node.Resources()!.lookup(PDFName.of("Font"), PDFDict).entries()[0][1], PDFDict).lookup(PDFName.of("DescendantFonts"), PDFArray);
  const descendant = descendants.lookup(0, PDFDict);
  const descriptor = descendant.lookup(PDFName.of("FontDescriptor"), PDFDict);
  assert.equal(String(descendant.get(PDFName.of("Subtype"))), "/CIDFontType0");
  assert.equal(descriptor.get(PDFName.of("FontFile2")), undefined);
  const fontStream = descriptor.lookup(PDFName.of("FontFile3")) as PDFRawStream;
  assert.equal(String(fontStream.dict.get(PDFName.of("Subtype"))), "/CIDFontType0C");
  const source = await fontBytes;
  const originalFont = fontkit.create(source) as unknown as { directory: { tables: Record<string, { offset: number; length: number }> } };
  const cffTable = originalFont.directory.tables["CFF "];
  assert.equal(Buffer.compare(Buffer.from(decodePDFRawStream(fontStream).decode()), source.subarray(cffTable.offset, cffTable.offset + cffTable.length)), 0, "the original CFF program is embedded without rewriting its bytes");
  assert.ok(bytes.byteLength < (await fontBytes).byteLength * 1.25, "the embedded font should not be duplicated per page");
});

test("large note spacing moves complete ordinary questions and increases page count", async () => {
  const items = Array.from({ length: 6 }, (_, index) => item(index + 1, `QUESTIONMARK${index + 1}`));
  const compact = await PDFDocument.load(await create(items, { spacingCm: 0 }));
  const spacious = await PDFDocument.load(await create(items, { spacingCm: 6 }));
  assert.ok(spacious.getPageCount() > compact.getPageCount());
  for (let index = 0; index < spacious.getPageCount(); index += 1) {
    const { text } = readPdfPage(spacious, index);
    const questionCount = (text.match(/QUESTIONMARK\d/g) ?? []).length;
    assert.equal((text.match(/第四個選項/g) ?? []).length, questionCount, "an ordinary question was split from its final option");
    assert.match(text, new RegExp(`${index + 1} / ${spacious.getPageCount()}$`));
  }
});

test("very long Chinese and English text wraps across pages without dropping or clipping content", async () => {
  const stem = `${"長題測試 ".repeat(800)}${"UNBREAKABLE".repeat(35)} END_MARKER`;
  const document = await PDFDocument.load(await create([item(1, stem)], { spacingCm: 6 }));
  assert.ok(document.getPageCount() > 2);
  const pages = document.getPages().map((_, index) => readPdfPage(document, index));
  const text = pages.map((page, index) => page.text.replace(new RegExp(`${index + 1} / ${pages.length}$`), "")).join("");
  assert.equal((text.match(/長題測試/g) ?? []).length, 800);
  assert.equal((text.match(/UNBREAKABLE/g) ?? []).length, 35);
  assert.match(text, /END_MARKER/);
  assert.equal((text.match(/第四個選項/g) ?? []).length, 1);
  for (const { commands } of pages) {
    for (const position of commands.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)) {
      assert.ok(Number(position[1]) >= 16 * 72 / 25.4 - 0.1);
      assert.ok(Number(position[2]) >= 15 && Number(position[2]) < PageSizes.A4[1] - 15 * 72 / 25.4);
    }
    assert.ok((commands.match(/ Tj/g) ?? []).length < 160, "text should be emitted per line/run, not one command per character");
  }
});

test("medical numeric runs and subscripts use the same glyph widths as PDF text positioning", async () => {
  const question = item(77, "有關 vitamin D3 代謝和功能，下列敘述何者最適切？");
  question.question.options.A = "1α,25-二羥基維生素 D3（1α,25-dihydroxyvitamin D3）可經由陽光紫外線在皮膚中形成膽鈣化醇（cholecalciferol）";
  question.question.options.B = "1α,25-二羥基維生素 D3（1α,25-dihydroxyvitamin D3）與特定核受體蛋白相互作用來調節基因表現";
  question.question.options.C = "O₂ CO2 HCO₃⁻ NH₄⁺ 10⁻⁶ Kₘ m²";
  const document = await PDFDocument.load(await create([question]));
  const { page, text, commands, glyphs } = readPdfPage(document, 0);
  assert.ok(text.includes(question.question.options.A));
  assert.ok(text.includes(question.question.options.B));
  assert.doesNotMatch(text, /�/);
  const font = document.context.lookup(page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict).entries()[0][1], PDFDict);
  const descendant = font.lookup(PDFName.of("DescendantFonts"), PDFArray).lookup(0, PDFDict);
  const entries = descendant.lookup(PDFName.of("W"), PDFArray).asArray();
  const widths = new Map<number, number>();
  for (let index = 0; index < entries.length; index += 2) {
    const start = (entries[index] as PDFNumber).asNumber();
    (entries[index + 1] as PDFArray).asArray().forEach((width, offset) => widths.set(start + offset, (width as PDFNumber).asNumber()));
  }
  const encoding = decodeStream(font.lookup(PDFName.of("Encoding")) as PDFRawStream);
  const glyphToCid = new Map<number, number>();
  for (const block of encoding.matchAll(/begincidrange([\s\S]*?)endcidrange/g)) {
    for (const match of block[1].matchAll(/<([a-f\d]+)>\s*<([a-f\d]+)>\s+(\d+)/gi)) {
      const first = parseInt(match[1], 16), last = parseInt(match[2], 16), cid = Number(match[3]);
      for (let glyph = first; glyph <= last; glyph += 1) glyphToCid.set(glyph, cid + glyph - first);
    }
  }
  assert.notEqual(glyphToCid.get(16047), 16047, "the TC font's CIDs are not glyph indices");
  const sourceFont = fontkit.create(await fontBytes);
  const charset = (sourceFont as unknown as { "CFF ": { topDict: { charset: { ranges: { offset: number; first: number; nLeft: number }[] } } } })["CFF "].topDict.charset;
  assert.equal(glyphToCid.get(0), 0);
  for (const range of charset.ranges) for (let offset = 0; offset <= range.nLeft; offset += 1) {
    assert.equal(glyphToCid.get(range.offset + offset + 1), range.first + offset, "each PDF character code maps to the original CFF charset CID");
  }
  const runs = Array.from(commands.matchAll(/BT([\s\S]*?)ET/g)).map((block) => {
    const size = Number(block[1].match(/\S+ ([\d.]+) Tf/)![1]);
    const position = block[1].match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/)!;
    const codes = block[1].match(/<([a-f\d]+)>\s*Tj/i)![1].match(/.{4}/g)!;
    const runText = codes.map((code) => glyphs.get(code.toUpperCase()) ?? "�").join("");
    let advance = 0;
    for (const code of codes) {
      const width = widths.get(glyphToCid.get(parseInt(code, 16))!);
      assert.notEqual(width, undefined, "every drawn glyph needs an explicit PDF width; no default-width fallback");
      advance += width! * size / 1000;
    }
    const measured = Array.from(runText).reduce((sum, character) => sum + sourceFont.glyphForCodePoint(character.codePointAt(0)!).advanceWidth * size / sourceFont.unitsPerEm, 0);
    assert.ok(Math.abs(advance - measured) < 0.01, "merged run advances must equal the cached character measurements");
    return { size, x: Number(position[1]), y: Number(position[2]), advance };
  });
  let scriptBoundaries = 0;
  for (let index = 1; index < runs.length; index += 1) {
    const previous = runs[index - 1];
    const current = runs[index];
    if (previous.size !== current.size && current.x > previous.x && Math.abs(current.y - previous.y) < 8) {
      assert.ok(Math.abs(current.x - previous.x - previous.advance) < 0.01, "subscript boundaries must have neither overlap nor added space");
      scriptBoundaries += 1;
    }
  }
  assert.ok(scriptBoundaries >= 8, "both real vitamin D3 options must exercise formatted run boundaries");
});

test("stem and option images are embedded, reused, and missing or malformed images reject the whole export", async () => {
  const withImage = item(1);
  withImage.question.stemImage = "/same-image.png";
  withImage.question.optionImages = { B: "/same-image.png" };
  let requests = 0;
  const document = await PDFDocument.load(await create([withImage], { loadImage: async () => { requests += 1; return { bytes: pngBytes, type: "png" }; } }));
  assert.equal(requests, 1);
  const images = document.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
  assert.ok(images.entries().length > 0);
  await assert.rejects(create([withImage], { loadImage: async () => { throw new Error("PRIVATE_NETWORK_URL"); } }), (error: Error) => /第 1 題的附圖無法載入/.test(error.message) && !error.message.includes("PRIVATE_NETWORK_URL"));
  await assert.rejects(create([withImage], { loadImage: async () => ({ bytes: new Uint8Array([0, 1, 2]), type: "jpg" }) }), /附圖無法載入/);
});

test("unsupported glyphs and invalid fonts fail honestly; cancellation propagates without a partial PDF", async () => {
  await assert.rejects(create([item(1, `unsupported ${String.fromCodePoint(0x10ffff)}`)]), /字型不支援字元/);
  await assert.rejects(create([item(1)], { fontBytes: new Uint8Array([1, 2, 3]) }), /字型無法載入/);
  const abort = new Error("cancelled");
  abort.name = "AbortError";
  await assert.rejects(create([item(1), item(2)], { onProgress: (done) => { if (done === 1) throw abort; } }), (error) => error === abort);
  const withImage = item(1);
  withImage.question.stemImage = "/image.png";
  await assert.rejects(create([withImage], { loadImage: async () => { throw abort; } }), (error) => error === abort);
});


test("Poppler accepts and renders the embedded Noto OpenType font without invalid-font or fallback warnings", async (context) => {
  for (const tool of ["pdffonts", "pdftoppm"]) {
    const available = spawnSync(tool, ["-v"], { encoding: "utf8" });
    if ((available.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      context.skip("Poppler is required for external PDF rendering validation");
      return;
    }
  }
  const directory = await mkdtemp(path.join(tmpdir(), "wrong-question-pdf-font-"));
  try {
    const file = path.join(directory, "validation.pdf");
    await writeFile(file, await create([item(1, "繁體中文與宋體字型測試 H2O／PaCO2"), item(2, "原始字型應可正確顯示") ]));
    const fontCheck = spawnSync("pdffonts", [file], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(fontCheck.status, 0, fontCheck.stderr.slice(0, 1000));
    assert.equal(fontCheck.stderr.trim(), "", fontCheck.stderr.slice(0, 1000));
    assert.match(fontCheck.stdout, /NotoSerifTC-Regular/);
    assert.match(fontCheck.stdout, /CID Type 0C/);
    assert.doesNotMatch(fontCheck.stdout, /\(OT\)/);
    const imagePrefix = path.join(directory, "render");
    const render = spawnSync("pdftoppm", ["-f", "1", "-singlefile", "-r", "72", "-png", file, imagePrefix], { encoding: "utf8", maxBuffer: 1024 * 1024 });
    assert.equal(render.status, 0, render.stderr.slice(0, 1000));
    assert.equal(render.stderr.trim(), "", render.stderr.slice(0, 1000));
    const image = await readFile(`${imagePrefix}.png`);
    assert.equal(image.subarray(1, 4).toString(), "PNG");
    assert.ok(image.byteLength > 5000, "the rendered page should contain visible text");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


test("all PDF text fields normalize canonical characters and keep inputs unchanged", async () => {
  const q = item(9, "降低數值 O₂ CO2 HCO₃⁻ NH₄⁺ m² 10⁸ Kₘ Aᶜ Bˢ\n下一行\u0081文字");
  q.chapter = "降章²";
  q.question.subject = "生理學" as typeof q.question.subject;
  q.question.options.A = "類型與濃度";
  const snapshot = structuredClone(q);
  const document = await PDFDocument.load(await create([q], { scopeLabel: "數值範圍 m²", dateLabel: "降序日期" }));
  const { text, commands } = readPdfPage(document, 0);
  assert.match(text, /生理學｜降章2/);
  assert.match(text, /數值範圍 m2/);
  assert.match(text, /降序日期/);
  assert.match(text, /降低數值 O2 CO2 HCO3− NH4\+ m2 108 Km Ac Bs/);
  assert.match(text, /類型與濃度/);
  assert.doesNotMatch(text, /[降數流類度�]/);
  assert.deepEqual(q, snapshot);
  assert.ok((commands.match(/6\.82 Tf/g) ?? []).length >= 3, "native superscripts use raised smaller glyphs");
});

test("full CJK fallback is lazy, selected once and preserves actual uncommon Han characters", async () => {
  let calls = 0;
  const fallback = async () => { calls += 1; return fallbackFontBytes; };
  await create([item(1, "降低 CO₂ 10⁸")], { loadFallbackFont: fallback });
  assert.equal(calls, 0, "canonical forms and scripts need no larger font");
  const q = item(2, "横肾蝲倂俣细内");
  const bytes = await create([q, item(3, "横")], { loadFallbackFont: fallback });
  assert.equal(calls, 1);
  const document = await PDFDocument.load(bytes);
  assert.match(document.getPages().map((_, i) => readPdfPage(document, i).text).join(""), /横肾蝲倂俣细内/);
  for (const page of document.getPages()) assert.equal(new Set(page.node.Resources()!.lookup(PDFName.of("Font"), PDFDict).entries().map(([, ref]) => String(ref))).size, 1);
  assert.ok(bytes.byteLength < (await fallbackFontBytes).byteLength * 1.1, "the unused primary font must not be embedded");
  await assert.rejects(create([item(4, String.fromCodePoint(0x10ffff))], { loadFallbackFont: fallback }), /字型不支援字元/);
  await assert.rejects(create([q], { loadFallbackFont: async () => { throw new Error("private-network-url"); } }), /完整中文字型無法載入/);
  const abort = new Error("cancelled"); abort.name = "AbortError";
  await assert.rejects(create([q], { loadFallbackFont: async () => { throw abort; } }), (error) => error === abort);
});


test("source-verified PUA fields are prepared before glyph checks and drawing without changing records", async () => {
  const q = item(29, "去氧（deoxyuridylate, dUMP）轉變為胸（thymidylate, dTMP）之反應需要何種輔參與？");
  q.question.id = "MOEX-101030-2101-Q029";
  const option = item(39);
  option.question.id = "MOEX-100030-1101-Q039";
  option.question.options.B = "硬（hard palate）";
  const original = structuredClone([q, option]);
  const document = await PDFDocument.load(await create([q, option]));
  const text = document.getPages().map((_, i) => readPdfPage(document, i).text).join("");
  assert.match(text, /去氧尿苷（deoxyuridylate, dUMP）轉變為胸苷（thymidylate, dTMP）之酶反應需要何種輔酶參與/);
  assert.match(text, /硬腭（hard palate）/);
  assert.doesNotMatch(text, /[\ue000-\uf8ff�]/u);
  assert.deepEqual([q, option], original);
  await assert.rejects(create([{ ...q, question: { ...q.question, id: "unreviewed-copy" } }]), /字型不支援字元/);
  await assert.rejects(create([{ ...q, question: { ...q.question, stem: q.question.stem + " changed" } }]), /字型不支援字元/);
});

test("MuPDF and Poppler render matching glyphs and extract text for both Noto font variants", async (context) => {
  if (spawnSync("/usr/bin/python3", ["-c", "import fitz"], { encoding: "utf8" }).status !== 0 ||
      spawnSync("pdftoppm", ["-v"], { encoding: "utf8" }).error ||
      spawnSync("pdftotext", ["-v"], { encoding: "utf8" }).error) {
    context.skip("MuPDF and Poppler are required for cross-reader validation");
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "wrong-question-pdf-cid-"));
  try {
    for (const useFallback of [false, true]) {
      const file = path.join(directory, useFallback ? "full-cjk.pdf" : "tc.pdf");
      const stem = useFallback ? "横肾蝲倂俣细内" : "降低數值 O₂ Kₘ 10⁸";
      await writeFile(file, await create([item(1, stem)], { loadFallbackFont: async () => fallbackFontBytes }));
      const prefix = `${file}-poppler`;
      const render = spawnSync("pdftoppm", ["-f", "1", "-singlefile", "-r", "144", "-png", file, prefix], { encoding: "utf8", maxBuffer: 1024 * 1024 });
      assert.equal(render.status, 0, render.stderr.slice(0, 1000));
      assert.equal(render.stderr.trim(), "");
      const extracted = spawnSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 1024 * 1024 });
      assert.equal(extracted.status, 0);
      assert.equal(extracted.stderr.trim(), "");
      assert.match(extracted.stdout, /錯題練習單/);
      assert.match(extracted.stdout, useFallback ? /横肾蝲倂俣细内/ : /降低數值/);
      const crossReader = spawnSync("/usr/bin/python3", ["-c", `
import fitz, json, sys
pdf = fitz.open(sys.argv[1])
page = pdf[0]
actual = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
actual.save(sys.argv[1] + '-mupdf.png')
reference = fitz.Pixmap(sys.argv[2])
assert (actual.width, actual.height, actual.n) == (reference.width, reference.height, reference.n)
a, b = actual.samples, reference.samples
union = different = 0
# Compare the real title glyph shapes, not only ToUnicode extraction (which
# remained correct when the old sparse-CID font visually drew wrong Han).
for y in range(70, 160):
    for x in range(440, 750):
        at = y * actual.stride + x * actual.n
        da, db = min(a[at:at+3]) < 160, min(b[at:at+3]) < 160
        union += da or db
        different += da != db
print(json.dumps({'text': page.get_text(), 'ink': union, 'difference': different / max(union, 1), 'warnings': fitz.TOOLS.mupdf_warnings()}, ensure_ascii=False))
`, file, `${prefix}.png`], { encoding: "utf8", maxBuffer: 1024 * 1024 });
      assert.equal(crossReader.status, 0, crossReader.stderr.slice(0, 1000));
      const result = JSON.parse(crossReader.stdout) as { text: string; ink: number; difference: number; warnings: string };
      assert.match(result.text, /錯題練習單/);
      assert.match(result.text, useFallback ? /横肾蝲倂俣细内/ : /降低數值/);
      assert.equal(result.warnings.trim(), "");
      assert.ok(result.ink > 1000);
      // Different rasterizers have different hinting/antialiasing. Correct text
      // differs by about35%; the prior wrong-glyph regression differs by85%.
      assert.ok(result.difference < 0.55, `cross-reader title glyphs differ: ${result.difference}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
