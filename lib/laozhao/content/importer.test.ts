import assert from "node:assert/strict";
import test from "node:test";
import {
  importPrivateExternalContent,
  normalizeSlideIndexCsv,
  normalizeWhisperJson
} from "./importer";

test("slide index CSV 會正規化時間與來源路徑", () => {
  const cues = normalizeSlideIndexCsv(
    'timestamp,file\n"00:01:02.500","slides/001.png"\n90,"slides/002.png"\ninvalid,"slides/003.png"\n',
    { videoId: "ATFBb25QRNw" }
  );
  assert.deepEqual(cues, [
    { videoId: "ATFBb25QRNw", startSec: 62.5, sourcePath: "slides/001.png" },
    { videoId: "ATFBb25QRNw", startSec: 90, sourcePath: "slides/002.png" }
  ]);
});

test("Whisper JSON 支援 segments 並排除無效時間段", () => {
  const cues = normalizeWhisperJson(
    {
      segments: [
        { start: 0, end: 2.5, text: " 第一段 " },
        { start: 5, end: 4, text: "時間錯誤" },
        { start: "00:00:06", end: "00:00:08", text: "第二段" }
      ]
    },
    { videoId: "ATFBb25QRNw" }
  );
  assert.deepEqual(cues, [
    { videoId: "ATFBb25QRNw", startSec: 0, endSec: 2.5, text: "第一段" },
    { videoId: "ATFBb25QRNw", startSec: 6, endSec: 8, text: "第二段" }
  ]);
});

test("importer 輸出固定標記為 private_only，不會成為公開內容", () => {
  const imported = importPrivateExternalContent({
    videoId: "ATFBb25QRNw",
    slideIndexCsv: "time,path\n12,slides/001.png\n",
    whisperJson: { results: [{ start: 12, end: 15, text: "私人逐字稿" }] }
  });
  assert.equal(imported.publishable, false);
  assert.equal(imported.rightsStatus, "private_only");
  assert.equal(imported.transcript[0]?.rightsStatus, "private_only");
});
