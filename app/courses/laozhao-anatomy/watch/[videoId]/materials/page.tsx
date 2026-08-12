import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, PlayCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { ChapterMaterials } from "@/components/laozhao/materials/ChapterMaterials";
import { formatTime } from "@/components/laozhao/player/ChapterList";
import {
  getLaozhaoContentRepository,
  withLaozhaoPreviewContent
} from "@/components/laozhao/player/content-contract";
import { getLaoZhaoPreviewVideo } from "@/lib/laozhao/preview/repository";

type MaterialsPageProps = {
  params: {
    videoId: string;
  };
};

export const dynamicParams = false;
export const revalidate = false;

export function generateStaticParams() {
  return getLaozhaoContentRepository()
    .listVideos()
    .map((video) => ({ videoId: video.id }));
}

export function generateMetadata({ params }: MaterialsPageProps): Metadata {
  const video = getLaozhaoContentRepository().getVideo(params.videoId);
  return {
    title: video ? `板書與筆記｜${video.title}` : "板書與筆記｜老趙解剖學",
    description: "依影片章節整理老師板書與對照筆記。"
  };
}

export default function LaoZhaoMaterialsPage({ params }: MaterialsPageProps) {
  const repository = getLaozhaoContentRepository();
  const baseVideo = repository.getVideo(params.videoId);
  if (!baseVideo) notFound();
  const preview = getLaoZhaoPreviewVideo(baseVideo.id);
  if (!preview) notFound();
  const video = withLaozhaoPreviewContent(baseVideo, preview);
  const chapters = (video.chapters ?? []).filter((chapter) => (chapter.boardFrames?.length ?? 0) > 0);
  const boardCount = chapters.reduce((total, chapter) => total + (chapter.boardFrames?.length ?? 0), 0);
  const noteCount = new Set(chapters.flatMap((chapter) => (
    (chapter.referenceNotes ?? []).map((note) => note.src)
  ))).size;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--bg-base)] text-[var(--ink-main)]">
      <header className="border-b border-[var(--line-soft)] bg-white/55">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
          <Link
            href={`/courses/laozhao-anatomy/watch/${encodeURIComponent(video.id)}`}
            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--brand-deep)] hover:text-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            回到影片
          </Link>
          <div className="mt-8 max-w-4xl">
            <p className="text-xs font-bold text-[var(--brand-main)]">完整圖像總覽</p>
            <h1 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">板書與對照筆記</h1>
            <p className="mt-3 text-base font-bold">{video.title}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--ink-soft)]">
              {chapters.length} 個章節・{boardCount} 組板書對照・{noteCount} 頁筆記
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        {chapters.map((chapter, index) => (
          <article
            key={chapter.stableId}
            id={chapter.stableId}
            className="scroll-mt-5 border-b border-[var(--line-soft)] py-8 first:pt-4 sm:py-12"
          >
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold tabular-nums text-[var(--brand-main)]">
                  第 {index + 1} 組・{formatTime(chapter.startSec)}
                </p>
                <h2 className="mt-2 text-xl font-black leading-8 sm:text-2xl">{chapter.title}</h2>
                {chapter.summary ? (
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--ink-soft)]">{chapter.summary}</p>
                ) : null}
              </div>
              <Link
                href={`/courses/laozhao-anatomy/watch/${encodeURIComponent(video.id)}?t=${Math.floor(chapter.startSec)}&chapter=${encodeURIComponent(chapter.stableId)}`}
                className="inline-flex min-h-10 w-fit shrink-0 items-center gap-2 rounded-md border border-[var(--line-soft)] bg-white px-3 py-2 text-sm font-bold text-[var(--brand-deep)] hover:border-[var(--brand-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-main)]"
              >
                <PlayCircle aria-hidden="true" size={17} strokeWidth={2} />
                播放這一段
              </Link>
            </div>
            <ChapterMaterials
              chapter={chapter}
              videoId={video.id}
              showHeading={false}
            />
          </article>
        ))}
      </div>
    </main>
  );
}
