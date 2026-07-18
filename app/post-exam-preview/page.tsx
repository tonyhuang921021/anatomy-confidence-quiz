import type { Metadata } from "next";
import { PostExamReflectionPreview } from "@/components/PostExamReflectionPreview";

export const metadata: Metadata = {
  title: "考後回顧與經驗傳承｜預覽",
  description: "2026 一階醫師國考題庫考後回顧與經驗傳承問卷預覽。",
  robots: {
    index: false,
    follow: false
  }
};

export default function PostExamPreviewPage() {
  return <PostExamReflectionPreview />;
}
