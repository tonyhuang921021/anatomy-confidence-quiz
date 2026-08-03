import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockLaoZhaoPreviewRequest } from "./lib/laozhao/preview/accessGate";

export function middleware(request: NextRequest) {
  if (shouldBlockLaoZhaoPreviewRequest({
    pathname: request.nextUrl.pathname,
    host: request.headers.get("host")
  })) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow"
      }
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/courses/laozhao-anatomy/:path*",
    "/laozhao-preview/:path*"
  ]
};
