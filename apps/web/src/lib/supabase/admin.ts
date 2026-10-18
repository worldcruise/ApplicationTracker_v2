import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnvironment, noStoreFetch } from "./config";
import { ApiFailure } from "@/lib/api/errors";

/** Auth administration only. Never use for ordinary application queries. */
export function createAuthAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "User provisioning needs a server-only Auth administration key.", true);
  const { url } = getSupabaseEnvironment();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: noStoreFetch },
  }).auth.admin;
}

