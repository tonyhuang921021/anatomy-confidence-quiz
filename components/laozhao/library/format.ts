import type { PublicCourseVideo } from "@/lib/laozhao/types";

export function getThumbnailUrl(video: PublicCourseVideo) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(video.youtubeId)}/mqdefault.jpg`;
}

export function formatDuration(durationSec: number | null) {
  if (durationSec === null) return "時間待同步";
  const totalSeconds = Math.max(0, Math.round(durationSec));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours} 小時 ${String(minutes).padStart(2, "0")} 分`;
  return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
}

export function formatRelativeProgress(positionSec: number, durationSec: number) {
  if (durationSec <= 0) return "已記錄觀看位置";
  const percentage = Math.min(100, Math.max(0, Math.round((positionSec / durationSec) * 100)));
  return `已看 ${percentage}%`;
}
