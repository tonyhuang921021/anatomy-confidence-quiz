import previewManifestJson from "@/data/laozhao/previewContent.generated.json";
import { isLaoZhaoPreviewEnabled, parseLaoZhaoPreviewManifest } from "./validator";
import type { LaoZhaoPreviewVideoContent } from "./types";

let parsedManifest: ReturnType<typeof parseLaoZhaoPreviewManifest> | null = null;

function getManifest() {
  if (!parsedManifest) parsedManifest = parseLaoZhaoPreviewManifest(previewManifestJson);
  return parsedManifest;
}

export function getLaoZhaoPreviewVideo(
  videoId: string,
  env: Record<string, string | undefined> = process.env
): LaoZhaoPreviewVideoContent | null {
  if (!isLaoZhaoPreviewEnabled(env)) return null;
  return getManifest().videos.find((video) => video.videoId === videoId) ?? null;
}
