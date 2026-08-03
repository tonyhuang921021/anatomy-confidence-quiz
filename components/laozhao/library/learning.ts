import { getLaoZhaoLocalRepository } from "@/lib/laozhao/local";
import type { LaoZhaoProgressRecord } from "@/lib/laozhao/local";

export type LaoZhaoLearningSnapshot = {
  progress: Record<string, LaoZhaoProgressRecord>;
  bookmarkedVideoIds: Set<string>;
};

export async function readLaozhaoLearningSnapshot(): Promise<LaoZhaoLearningSnapshot> {
  const repository = getLaoZhaoLocalRepository();
  const [progressRows, bookmarkRows] = await Promise.all([
    repository.listProgress(),
    repository.listBookmarks()
  ]);
  const progress: Record<string, LaoZhaoProgressRecord> = {};

  progressRows.forEach((row) => {
    progress[row.videoId] = row;
  });

  return {
    progress,
    bookmarkedVideoIds: new Set(bookmarkRows.map((bookmark) => bookmark.videoId))
  };
}
