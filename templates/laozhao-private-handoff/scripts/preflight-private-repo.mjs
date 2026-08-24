import { execFileSync } from "node:child_process";
import { extname } from "node:path";

const forbiddenExtensions = new Set([
  ".aac", ".m4a", ".mkv", ".mov", ".mp3", ".mp4", ".wav", ".webm",
  ".zip", ".pdf", ".png", ".jpg", ".jpeg", ".webp"
]);

function main() {
  if (process.env.PRIVATE_REPOSITORY_CONFIRMED !== "true") {
    throw new Error("這個 GitHub repository 不是 Private，停止所有私人內容處理。");
  }
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  const forbidden = tracked.filter((pathname) => forbiddenExtensions.has(extname(pathname).toLowerCase()));
  if (forbidden.length > 0) {
    throw new Error(`Git 追蹤到禁止上傳的媒體檔：${forbidden.join(", ")}`);
  }
  console.log("Private repository 與禁止媒體檔檢查通過。");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
