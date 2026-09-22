import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createWrongQuestionPdfDocument } from "./wrongQuestionPdfDocument";
import type { WrongQuestionPdfItem } from "./wrongQuestionPdf";

test("Apple PDFKit/Quartz preserves punctuation and renders the TC subset exactly like full CJK", async (context) => {
  if (process.platform !== "darwin" || spawnSync("/usr/bin/python3", ["-c", "import fitz"]).status !== 0) {
    context.skip("Native Apple PDF regression runs on macOS with PyMuPDF for image comparison");
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "pdf-apple-regression-"));
  try {
    const executable = path.join(directory, "render-apple");
    const compiled = spawnSync("/usr/bin/clang", [
      "-fobjc-arc", "-framework", "Foundation", "-framework", "AppKit", "-framework", "PDFKit",
      "-framework", "CoreGraphics", "-framework", "ImageIO", "scripts/render-pdf-apple.m", "-o", executable
    ], { encoding: "utf8", timeout: 60000 });
    assert.equal(compiled.status, 0, compiled.stderr);
    const item: WrongQuestionPdfItem = { chapter: "類型與濃度", answeredAt: "", question: {
      id: "apple-display-fixture", subject: "生理學", chapter: "類型與濃度", section: "字元檢查",
      stem: "相容漢字：降、類；數量（濃度）。",
      options: {
        A: "標點，。：「」（）＋−；",
        B: "O₂、10⁸、Aᶜ、Bˢ；HCO₃⁻ NH₄⁺ Kₘ m² 10⁻⁶",
        C: "1α,25-二羥基維生素 D3（1α,25-dihydroxyvitamin D3）",
        D: "第二行\n保留換行與筆記空白"
      },
      answer: "A", explanation: "不匯出", testedConcept: ""
    } };
    for (const [name, file] of [["primary", "NotoSerifTC-Regular.otf"], ["full", "NotoSerifCJKtc-Regular.otf"]]) {
      const bytes = await createWrongQuestionPdfDocument({
        items: [item], spacingCm: 2, scopeLabel: "本次錯題", dateLabel: "全部日期",
        fontBytes: await readFile(path.resolve("public/fonts/pdf", file)),
        loadImage: async () => { throw new Error("no images expected"); }
      });
      const pdf = path.join(directory, name + ".pdf");
      await writeFile(pdf, bytes);
      const result = spawnSync(executable, [pdf, path.join(directory, name)], { encoding: "utf8", timeout: 45000 });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stderr, "");
      const report = JSON.parse(result.stdout) as { pages: number; text: string };
      assert.equal(report.pages, 1);
      assert.match(report.text, /相容漢字：降、類；數量（濃度）。/);
      assert.match(report.text, /標點，。：「」（）＋−；/);
    }
    // Full CJK uses identity CIDs; its outlines and advances for these characters
    // match TC, making it an independent image reference. The old custom CMap
    // loses punctuation despite passing other PDF readers.
    const comparison = spawnSync("/usr/bin/python3", ["-c", [
      "import fitz, json, sys",
      "results = {}",
      "for engine in ['pdfkit','quartz']:",
      "    a=fitz.Pixmap(sys.argv[1]+'/primary-'+engine+'.png')",
      "    b=fitz.Pixmap(sys.argv[1]+'/full-'+engine+'.png')",
      "    assert (a.width,a.height,a.n)==(b.width,b.height,b.n)",
      "    aa,bb=a.samples,b.samples",
      "    union=different=0",
      "    for i in range(0,len(aa),a.n):",
      "        da,db=min(aa[i:i+3])<160,min(bb[i:i+3])<160",
      "        union+=da or db",
      "        different+=da!=db",
      "    assert union>5000",
      "    results[engine]=different/max(union,1)",
      "print(json.dumps(results))"
    ].join("\n"), directory], { encoding: "utf8", timeout: 30000 });
    assert.equal(comparison.status, 0, comparison.stderr);
    for (const [engine, difference] of Object.entries(JSON.parse(comparison.stdout) as Record<string, number>)) {
      assert.ok(difference < 0.01, engine + ": sparse-CID font differs from full-font reference (" + difference + ")");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
