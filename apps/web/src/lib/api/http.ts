import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "@candidate/contracts";
import { preventSessionCaching } from "@/lib/supabase/response";
import { ApiFailure } from "./errors";
import { applicationOrigin } from "./guards";

function permittedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try { if (origin === applicationOrigin()) return origin; } catch { return null; }
  const extension = process.env.EXTENSION_ALLOWED_ORIGIN?.trim();
  return extension && /^chrome-extension:\/\/[a-p]{32}$/.test(extension) && extension === origin ? origin : null;
}

function headers(request: Request, response: NextResponse): NextResponse {
  preventSessionCaching(response);
  response.headers.set("Vary", "Origin, Cookie, Authorization");
  const origin = permittedOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, Idempotency-Key, X-Operation-Actor");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    response.headers.set("Access-Control-Expose-Headers", "ETag");
  }
  return response;
}

export function preflight(request: Request) {
  return headers(request, new NextResponse(null, { status: permittedOrigin(request) ? 204 : 403 }));
}

export async function api(request: Request, work: (requestId: string) => Promise<unknown>) {
  const requestId = crypto.randomUUID();
  try {
    const data = await work(requestId);
    const response = headers(request, NextResponse.json({ requestId, data }));
    if (data && typeof data === "object" && "rowVersion" in data && Number.isSafeInteger(data.rowVersion)) {
      response.headers.set("ETag", JSON.stringify(String(data.rowVersion)));
    }
    return response;
  } catch (error) {
    const failure = error instanceof ApiFailure ? error : new ApiFailure(503, "SERVICE_UNAVAILABLE", "The application service is unavailable.", true);
    const body: ApiErrorResponse = { requestId, error: {
      code: failure.code, message: failure.message, fieldErrors: failure.fieldErrors, retryable: failure.retryable,
      ...(failure.currentVersion === undefined ? {} : { currentVersion: failure.currentVersion }),
    } };
    const response = headers(request, NextResponse.json(body, { status: failure.status }));
    if (failure.status === 429) response.headers.set("Retry-After", "60");
    return response;
  }
}

