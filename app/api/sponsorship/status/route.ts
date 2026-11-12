import { SPONSORSHIP_REVIEW_ONLY, sponsorshipReviewResponse } from "@/lib/sponsorship/review-only.mjs";
import { handleConfiguredSandboxRequest } from "@/lib/sponsorship/edge-proxy.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(request: Request) {
  if (SPONSORSHIP_REVIEW_ONLY) return sponsorshipReviewResponse();
  return handleConfiguredSandboxRequest("status", request);
}
