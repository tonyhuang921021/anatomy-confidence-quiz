import type { Metadata } from "next";
import Link from "next/link";
import { SponsorshipInformation } from "@/components/SponsorshipInformation";
import "../sponsorship.css";
export const metadata: Metadata = { title: "贊助條款｜一階醫師國考刷題測驗" };
export default function Page() { return <main id="main-content" className="shell sponsorship-page"><Link className="back" href="/sponsorship/support">← 返回填寫贊助</Link><h1>贊助條款</h1><SponsorshipInformation expanded /></main>; }
