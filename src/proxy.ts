import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Browsers block a website on one origin from calling an API on another
// origin unless the API explicitly allows it. This lets the frontend
// (a separate app, a separate origin) call our /api/* routes.
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3001";

const corsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) {
    return await updateSession(request);
  }

  const origin = request.headers.get("origin") ?? "";
  const isAllowedOrigin = origin === allowedOrigin;

  // Browsers send an OPTIONS request first to check permission before
  // the real request (a "preflight").
  if (request.method === "OPTIONS") {
    return NextResponse.json(
      {},
      {
        headers: {
          ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
          ...corsHeaders,
        },
      },
    );
  }

  const response = NextResponse.next();
  if (isAllowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
