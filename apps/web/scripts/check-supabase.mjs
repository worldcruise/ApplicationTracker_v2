import { createClient } from "@supabase/supabase-js";

// Diagnostic only. Never log keys, JWTs, cookies, error bodies, or candidate rows.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const token = process.env.SUPABASE_TEST_ACCESS_TOKEN?.trim();
const table = process.env.SUPABASE_TEST_TABLE?.trim();

if (!url || !key) {
  console.error("CONFIGURATION_MISSING: set the public Supabase settings in apps/web/.env.local.");
  process.exit(1);
}

let serviceAvailable = false;
try {
  const result = await fetch(new URL("/auth/v1/settings", url), {
    headers: { apikey: key },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  serviceAvailable = result.ok;
  console.log(result.ok
    ? "SERVICE_OK: hosted Auth settings endpoint accepted the publishable key. This is not a database/RLS test."
    : `SERVICE_HTTP_ERROR: Auth settings returned HTTP ${result.status}.`);
  await result.body?.cancel();
} catch (error) {
  console.error(`SERVICE_NETWORK_ERROR: ${error.cause?.code ?? error.name}.`);
}

const prerequisites = [];
if (!token) prerequisites.push("MISSING_AUTHENTICATION: no SUPABASE_TEST_ACCESS_TOKEN for an authorized synthetic test account.");
if (!table) prerequisites.push("MISSING_TABLE_CONFIGURATION: no existing authorized SUPABASE_TEST_TABLE selected; remote table existence is unverified.");
prerequisites.forEach(message => console.log(message));
if (!serviceAvailable || prerequisites.length) {
  console.log("AUTHENTICATED_QUERY_NOT_RUN: no table was created and no access policy was changed.");
  process.exit(serviceAvailable ? 2 : 1);
}

// Same publishable key plus the actual test user's JWT, never a service-role key.
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    headers: { Authorization: `Bearer ${token}` },
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }),
  },
});

// Malformed JWTs can throw before the SDK returns an Auth error; never print them.
const { data, error: authError } = await supabase.auth.getClaims(token)
  .catch(error => ({ data: null, error }));
if (authError || !data?.claims?.sub || data.claims.role !== "authenticated") {
  const networkError = authError?.name === "AuthRetryableFetchError";
  console.error(networkError ? "AUTHENTICATION_NETWORK_ERROR" : "AUTHENTICATION_FAILED: test token is missing, expired, invalid, or not an authenticated user.");
  process.exit(1);
}

const { error, status } = await supabase.from(table).select("id", { head: true }).limit(1);
if (error) {
  const category = status === 0 ? "QUERY_NETWORK_ERROR"
    : ["PGRST205", "42P01"].includes(error.code) ? "MISSING_TABLE"
    : error.code === "42501" || status === 403 ? "PERMISSION_DENIED"
    : status === 401 ? "AUTHENTICATION_FAILED"
    : "QUERY_FAILED";
  console.error(`${category}: HTTP ${status}; code ${error.code || "unavailable"}. No records logged.`);
  process.exit(1);
}
console.log("AUTHENTICATED_QUERY_OK: an existing table accepted a read in the supplied user's RLS context. Empty/RLS-filtered results are possible; this does not prove membership policies or allow/deny coverage.");
