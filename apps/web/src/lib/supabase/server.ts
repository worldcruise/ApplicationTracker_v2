import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnvironment, noStoreFetch, supabaseCookieOptions } from "./config";

/** Create per request. Never cache this client or substitute a privileged key. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnvironment();

  return createServerClient(url, publishableKey, {
    global: { fetch: noStoreFetch },
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. src/proxy.ts refreshes first.
          // Route Handlers/Server Actions have writable cookie stores.
        }
      },
    },
  });
}
