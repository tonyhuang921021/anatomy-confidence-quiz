import type { Metadata } from "next";
import { PharmacologyLibraryClient } from "./PharmacologyLibraryClient";

export const metadata: Metadata = {
  title: "藥理資料｜一階醫師國考刷題測驗",
  description: "搜尋藥物的國考重點、機轉、用途、副作用、口訣與來源。"
};

export default function PharmacologyLibraryPage() {
  return <PharmacologyLibraryClient />;
}
