import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { UserContext } from "@candidate/contracts";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnvironment, noStoreFetch } from "@/lib/supabase/config";
import { ApiFailure, databaseResult } from "./errors";
import { bearerToken } from "./guards";

export async function requestContext(request?: Request) {
  const token = request ? bearerToken(request) : null;
  const settings = getSupabaseEnvironment();
  const client = token ? createSupabaseClient(settings.url, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: noStoreFetch },
  }) : await createClient();
  // getUser also checks the current Auth identity; cached token roles are never used.
  const identity = token ? await client.auth.getUser(token) : await client.auth.getUser();
  if (identity.error || !identity.data.user) {
    if (identity.error && (identity.error.status === undefined || identity.error.status >= 500)) {
      throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "Authentication is unavailable.", true);
    }
    throw new ApiFailure(401, "UNAUTHENTICATED", "Sign in to continue.");
  }
  const context = await databaseResult<UserContext>(client.rpc("get_my_context"));
  if (context.userId !== identity.data.user.id) throw new ApiFailure(401, "UNAUTHENTICATED", "The session identity could not be verified.");
  const operationActor = request?.headers.get("x-operation-actor");
  if (operationActor !== null && operationActor !== undefined && operationActor !== context.userId) throw new ApiFailure(403, "FORBIDDEN", "This local operation belongs to another account. Sign back in as its original actor; its frozen payload has been retained.");
  return { client, context, token };
}

