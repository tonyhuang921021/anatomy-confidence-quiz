import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchClient } from "@/components/laozhao/player/WatchClient";
import {
  getLaozhaoContentRepository,
  withLaozhaoPreviewContent
} from "@/components/laozhao/player/content-contract";
import { getLaoZhaoPreviewVideo } from "@/lib/laozhao/preview/repository";

type WatchPageProps = {
  params: {
    videoId: string;
  };
};

export const dynamicParams = false;
export const revalidate = false;

function getVideo(videoId: string) {
  return getLaozhaoContentRepository().getVideo(videoId);
}

export function generateStaticParams() {
  return getLaozhaoContentRepository()
    .listVideos()
    .map((video) => ({ videoId: video.id }));
}

export function generateMetadata({ params }: WatchPageProps): Metadata {
  const video = getVideo(params.videoId);
  return {
    title: video ? `${video.title}｜老趙解剖學` : "影片播放｜老趙解剖學",
    description: video?.description || "老趙解剖學影片播放與章節整理。"
  };
}

export default function LaoZhaoWatchPage({ params }: WatchPageProps) {
  const repository = getLaozhaoContentRepository();
  const video = repository.getVideo(params.videoId);
  if (!video) notFound();
  const preview = getLaoZhaoPreviewVideo(video.id);

  return (
    <WatchClient
      video={withLaozhaoPreviewContent(video, preview)}
      playlist={repository.listVideos()}
    />
  );
}
