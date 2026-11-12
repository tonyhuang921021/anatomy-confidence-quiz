import type { Metadata } from "next";
import { SponsorshipTestPanel } from "@/components/SponsorshipTestPanel";
import "../sponsorship/test/sandbox.css";
import "../sponsorship/donor-preview.css";
export const metadata: Metadata = { title: "測試付款流程未完成｜贊助與支出", robots: { index: false, follow: false }, referrer: "no-referrer" };
// Provider payment_error and other return parameters are intentionally not rendered or trusted.
export default function Page() { return <SponsorshipTestPanel mode="failure" />; }
