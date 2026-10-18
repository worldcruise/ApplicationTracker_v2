"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnvironment, supabaseCookieOptions } from "./config";

/** Browser Auth only; business reads/writes belong behind the shared /api/v1 API. */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnvironment();
  return createBrowserClient(url, publishableKey, { cookieOptions: supabaseCookieOptions });
}
