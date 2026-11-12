import type { Metadata } from "next";
import { SponsorshipSupportForm } from "@/components/SponsorshipSupportForm";
import "../sponsorship.css";
import "../donor-preview.css";
export const metadata: Metadata = {
  title: "填寫贊助｜一階醫師國考刷題測驗",
  description: "自願支持網站維護與營運。付款尚未開放。",
  robots: { index: false, follow: false }
};
export default function Page() { return <SponsorshipSupportForm />; }
