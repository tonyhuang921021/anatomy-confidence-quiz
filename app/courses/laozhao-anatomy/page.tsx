import type { Metadata } from "next";
import { LaoZhaoLibrary } from "@/components/laozhao/library/LaoZhaoLibrary";
import { getPublicCourseView } from "@/lib/laozhao/content/repository";

export const metadata: Metadata = {
  title: "老趙解剖學影片｜一階醫師國考刷題測驗",
  description: "老趙解剖學影片課程目錄。"
};

export const dynamic = "force-static";

export default function LaoZhaoAnatomyPage() {
  return <LaoZhaoLibrary course={getPublicCourseView()} />;
}
