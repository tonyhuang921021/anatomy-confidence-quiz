import type { Metadata } from "next";
import { SponsorshipTestPanel } from "@/components/SponsorshipTestPanel";
import { parseSandboxOrderId } from "@/lib/sponsorship/sandbox-ui.mjs";
import "../sponsorship/test/sandbox.css";
import "../sponsorship/donor-preview.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "測試付款核對｜贊助與支出", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page({ searchParams }: { searchParams: { order?: string | string[] } }) {
  return <SponsorshipTestPanel mode="return" initialOrderId={parseSandboxOrderId(searchParams.order)} />;
}
