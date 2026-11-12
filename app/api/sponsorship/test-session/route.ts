import { SPONSORSHIP_REVIEW_ONLY, sponsorshipReviewResponse } from "@/lib/sponsorship/review-only.mjs";
import { handleSandboxTestAuth } from "@/lib/sponsorship/sandbox-test-auth.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;
export async function POST(request: Request) {
  if (SPONSORSHIP_REVIEW_ONLY) return sponsorshipReviewResponse();
  return handleSandboxTestAuth("session", request);
}
