import type { NextResponse } from "next/server";

export function preventSessionCaching(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

/** Use when replacing a session response, including every future auth redirect. */
export function preserveSessionResponse(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(cookie => target.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma", "content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy"]) {
    const value = source.headers.get(name);
    if (value !== null) target.headers.set(name, value);
  }
  return target;
}
