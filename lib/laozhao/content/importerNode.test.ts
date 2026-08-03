import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadPrivateExternalContentFiles } from "./importerNode";

test("唯讀 adapter 會載入既有 index.csv 與逐字稿 JSON，且維持 private_only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "laozhao-importer-"));
  const slidePath = join(directory, "index.csv");
  const transcriptPath = join(directory, "transcript.json");

  try {
    await writeFile(slidePath, "timestamp,path\n00:05,slide-001.png\n", "utf8");
    await writeFile(
      transcriptPath,
      JSON.stringify({ segments: [{ start: 5, end: 9, text: "測試逐字稿" }] }),
      "utf8"
    );

    const imported = await loadPrivateExternalContentFiles({
      videoId: "ATFBb25QRNw",
      slideIndexCsvPath: slidePath,
      transcriptJsonPath: transcriptPath
    });

    assert.equal(imported.publishable, false);
    assert.equal(imported.rightsStatus, "private_only");
    assert.deepEqual(imported.slides, [
      { videoId: "ATFBb25QRNw", startSec: 5, sourcePath: "slide-001.png" }
    ]);
    assert.equal(imported.transcript[0]?.rightsStatus, "private_only");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
