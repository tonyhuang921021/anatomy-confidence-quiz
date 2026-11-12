import type { Metadata } from "next";
import { SponsorshipPaymentUnavailable } from "@/components/SponsorshipPaymentUnavailable";
import "../sponsorship/sponsorship.css";
export const metadata: Metadata = { title: "付款尚未開放｜贊助與支出", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <SponsorshipPaymentUnavailable />; }
