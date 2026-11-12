import type { Metadata } from "next";
import { SponsorshipPage } from "@/components/SponsorshipPage";
import "./sponsorship.css";
import "./donor-preview.css";

export const metadata: Metadata = {
  title: "贊助與支出｜一階醫師國考刷題測驗",
  description: "查看網站平台歷史支出金額。自願、無償支持網站維護與營運。",
  robots: { index: false, follow: false }
};

export default function Page() {
  return <SponsorshipPage />;
}
