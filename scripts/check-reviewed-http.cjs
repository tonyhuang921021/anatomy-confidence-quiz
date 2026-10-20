// Compare actual HTTP delivery with the committed release bytes, including every image.
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const base = process.argv[2];
const report = process.argv[3];
if (!base || !report) throw new Error("Usage: node scripts/check-reviewed-http.cjs BASE_URL REPORT_PATH");
const index = JSON.parse(fs.readFileSync("data/reviewedExplanationIndex.json", "utf8"));
const paths = new Set();
for (const id of Object.keys(index)) {
  const pathname = `/reviewed-explanations/${id}.json`;
  paths.add(pathname);
  const reader = JSON.parse(fs.readFileSync(path.join("public", pathname), "utf8"));
  for (const match of (reader.html + reader.shortHtml).matchAll(/src="(\/reviewed-explanations\/assets\/[^"]+)"/g)) paths.add(match[1]);
}
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const queue = [...paths];
const results = [];
async function worker() {
  while (queue.length) {
    const pathname = queue.shift();
    const expected = hash(fs.readFileSync(path.join("public", pathname)));
    let result;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const start = Date.now();
      try {
        const response = await fetch(base + pathname, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (hash(bytes) !== expected) throw new Error("Payload SHA-256 mismatch");
        result = { pathname, ok: true, bytes: bytes.length, milliseconds: Date.now() - start, attempts: attempt };
        break;
      } catch (error) {
        result = { pathname, ok: false, attempts: attempt, error: error.message };
      }
    }
    results.push(result);
    if (results.length % 100 === 0) console.log(`${results.length}/${paths.size} checked`);
  }
}
(async () => {
  await Promise.all([worker(), worker(), worker(), worker()]);
  const failures = results.filter(r => !r.ok);
  const summary = { base, readers: Object.keys(index).length, assets: paths.size - Object.keys(index).length,
    checked: results.length, failures: failures.length, retries: results.filter(r => r.attempts > 1).length, results };
  fs.writeFileSync(report, JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({ ...summary, results: undefined }));
  process.exitCode = failures.length ? 1 : 0;
})();
