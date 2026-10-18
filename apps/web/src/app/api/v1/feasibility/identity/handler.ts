import { createClient } from "@supabase/supabase-js";

/** Development-only Auth identity proof. Never substitutes for /me or membership checks. */
export async function identityProbe(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0", Vary: "Origin" });
  const requestId = crypto.randomUUID();
  const reply = (body: object, status: number) => Response.json({ requestId, ...body }, { status, headers });
  const fail = (code: string, message: string, status: number, retryable = false) =>
    reply({ error: { code, message, retryable, fieldErrors: [] } }, status);
  if (process.env.FEASIBILITY_API_ENABLED !== "true" || process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404, headers });
  }
  const allowed = process.env.EXTENSION_ALLOWED_ORIGIN?.trim();
  const origin = request.headers.get("origin");
  if (!allowed || !/^chrome-extension:\/\/[a-p]{32}$/.test(allowed) || origin !== allowed) {
    return fail("FORBIDDEN", "This extension origin is not allowlisted for the development probe.", 403);
  }
  headers.set("Access-Control-Allow-Origin", allowed);
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token) return fail("UNAUTHENTICATED", "A user bearer token is required.", 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("SERVICE_UNAVAILABLE", "Hosted Auth is not configured.", 503);
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }),
    },
  });
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return error && (!error.status || error.status >= 500)
        ? fail("SERVICE_UNAVAILABLE", "Auth could not be reached or verified.", 503, true)
        : fail("UNAUTHENTICATED", "The bearer session is invalid or expired.", 401);
    }
    return reply({ data: { userId: data.user.id, projectRef: new URL(url).hostname.split(".")[0], verification: "identity-only", applicationAccessVerified: false } }, 200);
  } catch { return fail("SERVICE_UNAVAILABLE", "Auth verification could not complete.", 503, true); }
}
