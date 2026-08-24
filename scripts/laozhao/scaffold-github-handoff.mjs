import { cp, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./review-package-core.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const privateRoot = resolve(repoRoot, "data/laozhao/staging");
const templateRoot = resolve(repoRoot, "templates/laozhao-private-handoff");
const defaultDestination = resolve(privateRoot, "private-handoff-repo");

function isWithin(parent, pathname) {
  const child = relative(parent, pathname);
  return child === "" || (!child.startsWith("..") && resolve(parent, child) === pathname);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const destination = resolve(
    typeof args.destination === "string" ? args.destination : defaultDestination
  );
  if (destination === repoRoot || (isWithin(repoRoot, destination) && !isWithin(privateRoot, destination))) {
    throw new Error("私有接力 repo 不可建立在網站的可追蹤目錄內。");
  }

  await mkdir(destination, { recursive: true });
  const existing = await readdir(destination);
  const allowed = new Set([".git"]);
  const unexpected = existing.filter((name) => !allowed.has(name));
  if (unexpected.length > 0) {
    const marker = resolve(destination, ".laozhao-private-handoff.json");
    try {
      const parsed = JSON.parse(await readFile(marker, "utf8"));
      if (parsed.privateRepositoryRequired === true) {
        console.log(`私有接力 repo 已建立：${destination}`);
        return;
      }
    } catch {
      // Fall through to the explicit refusal below.
    }
    throw new Error(`目的地不是空資料夾，停止避免覆蓋：${destination}`);
  }

  for (const entry of await readdir(templateRoot, { withFileTypes: true })) {
    await cp(resolve(templateRoot, entry.name), resolve(destination, entry.name), {
      recursive: true,
      errorOnExist: true,
      force: false
    });
  }
  console.log(`已建立私有接力 repo 骨架：${destination}`);
  console.log("下一步請先在 GitHub 建立 Private repository，再把這個資料夾連上該 remote。");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
