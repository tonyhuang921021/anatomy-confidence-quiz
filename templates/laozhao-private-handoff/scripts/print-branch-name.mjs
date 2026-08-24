import { loadHandoffJob, parseArgs } from "./handoff-runtime.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { job } = await loadHandoffJob(args["job-dir"]);
  console.log(`name=chat/${job.videoId}-${job.sourceFingerprint.slice(0, 12)}`);
  console.log(`title=Chat 分章：${job.videoId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
