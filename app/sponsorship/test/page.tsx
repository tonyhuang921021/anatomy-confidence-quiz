import type { Metadata } from "next";
import { SponsorshipTestPanel } from "@/components/SponsorshipTestPanel";
import "./sandbox.css";
import "../donor-preview.css";
export const metadata: Metadata = { title: "OEN TEST 測試區｜贊助與支出", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <SponsorshipTestPanel />; }
