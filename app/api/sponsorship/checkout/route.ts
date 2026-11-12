import { SPONSORSHIP_REVIEW_ONLY, sponsorshipReviewResponse } from "@/lib/sponsorship/review-only.mjs";
import { NextResponse } from "next/server";
import { sandboxRoutesEnabled } from "@/lib/sponsorship/sandbox-runtime.mjs";
import { handleConfiguredSandboxRequest } from "@/lib/sponsorship/edge-proxy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Default remains disabled. Secure configuration alone cannot activate checkout.
export async function POST(request: Request) {
  if (SPONSORSHIP_REVIEW_ONLY) return sponsorshipReviewResponse();
  if (!sandboxRoutesEnabled()) {
    return NextResponse.json(
      { code: "PREVIEW_CHECKOUT_DISABLED", message: "此預覽未啟用付款，不會建立訂單或扣款。" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return handleConfiguredSandboxRequest("checkout", request);
}
