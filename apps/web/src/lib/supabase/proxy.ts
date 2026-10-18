import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnvironment, noStoreFetch, supabaseCookieOptions } from "./config";
import { preserveSessionResponse, preventSessionCaching } from "./response";

export async function updateSession(request: NextRequest) {
  let response = preventSessionCaching(NextResponse.next({ request }));
  const { url, publishableKey } = getSupabaseEnvironment();
  const supabase = createServerClient(url, publishableKey, {
    global: { fetch: noStoreFetch },
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = preserveSessionResponse(response, NextResponse.next({ request }));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        preventSessionCaching(response);
      },
    },
  });

  // Keep this immediately after client creation: it validates/refreshes the JWT.
  await supabase.auth.getClaims();

  // Refresh is not authorization. Public pages remain public.
  // Protected API handlers must validate identity AND current membership/resource scope.
  // If redirecting, return preserveSessionResponse(response, NextResponse.redirect(url)).
  return response;
}
