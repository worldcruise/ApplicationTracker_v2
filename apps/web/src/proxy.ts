import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { contentSecurityPolicy } from "@/lib/api/security";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce, getSupabaseEnvironment().url, process.env.NODE_ENV === "development");
  // Supplied headers are always replaced; Next extracts the nonce during SSR.
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", policy);
  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
