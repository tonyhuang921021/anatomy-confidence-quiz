import { SPONSORSHIP_REVIEW_ONLY, sponsorshipReviewResponse } from "@/lib/sponsorship/review-only.mjs";
import { handleSandboxTestAuth } from "@/lib/sponsorship/sandbox-test-auth.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (SPONSORSHIP_REVIEW_ONLY) return sponsorshipReviewResponse();
  return handleSandboxTestAuth("config", request);
}
