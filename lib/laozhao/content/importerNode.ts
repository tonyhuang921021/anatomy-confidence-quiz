import { readFile } from "node:fs/promises";
import { importPrivateExternalContent } from "./importer";
import type { PrivateImportedContent } from "../types";

export async function loadPrivateExternalContentFiles(input: {
  videoId: string;
  slideIndexCsvPath?: string;
  transcriptJsonPath?: string;
}): Promise<PrivateImportedContent> {
  const slideIndexCsv = input.slideIndexCsvPath
    ? await readFile(input.slideIndexCsvPath, "utf8")
    : undefined;

  let whisperJson: unknown;
  if (input.transcriptJsonPath) {
    const source = await readFile(input.transcriptJsonPath, "utf8");
    try {
      whisperJson = JSON.parse(source);
    } catch {
      throw new Error(`無法解析時間戳 JSON：${input.transcriptJsonPath}`);
    }
  }

  return importPrivateExternalContent({
    videoId: input.videoId,
    slideIndexCsv,
    whisperJson
  });
}
