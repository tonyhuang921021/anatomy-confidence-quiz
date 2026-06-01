const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const promptScript = path.join(__dirname, "generate-neuro-chatgpt-batch-prompt.js");

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readQuestionLine(stdout) {
  const match = stdout.match(/Questions:\s*(.+)$/m);
  return match ? match[1].trim() : "";
}

function main() {
  const batchStart = toPositiveInt(process.argv[2], 1);
  const batchCount = toPositiveInt(process.argv[3], 5);
  const batchSize = toPositiveInt(process.argv[4], 5);
  const candidateLimit = toPositiveInt(process.argv[5], 8);

  const outputDir = path.join(projectRoot, "reports", "exports");
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = [];

  for (let offset = 0; offset < batchCount; offset += 1) {
    const batchIndex = batchStart + offset;
    const stdout = execFileSync(
      process.execPath,
      [promptScript, String(batchIndex), String(batchSize), String(candidateLimit)],
      {
        cwd: projectRoot,
        encoding: "utf8"
      }
    );

    const questionLine = readQuestionLine(stdout);
    manifest.push({
      batchIndex,
      file: `neuro_chatgpt_batch_${String(batchIndex).padStart(2, "0")}.txt`,
      questionIds: questionLine ? questionLine.split(/\s*,\s*/) : []
    });
  }

  const manifestPath = path.join(
    outputDir,
    `neuro_chatgpt_batch_manifest_${String(batchStart).padStart(2, "0")}_${String(
      batchStart + batchCount - 1
    ).padStart(2, "0")}.json`
  );

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        batchStart,
        batchCount,
        batchSize,
        candidateLimit,
        manifest
      },
      null,
      2
    )
  );

  console.log(`Saved ${manifest.length} batch prompts.`);
  console.log(`Manifest: ${manifestPath}`);
}

main();
