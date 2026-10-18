import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { ExtensionConfig } from "./config";

export interface SessionArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
  setAccessLevel(options: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
}

export class AuthProbeError extends Error {
  constructor(message: string) { super(message); this.name = "AuthProbeError"; }
}

/** No tokens in local/sync storage, IndexedDB, URLs, DOM, messages, or logs. */
export async function sessionStorageAdapter(area: SessionArea) {
  await area.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  return {
    async getItem(key: string) {
      const value = (await area.get(key))[key];
      return typeof value === "string" ? value : null;
    },
    async setItem(key: string, value: string) { await area.set({ [key]: value }); },
    async removeItem(key: string) { await area.remove(key); },
  };
}

export type AuthLock = <T>(name: string, work: () => Promise<T>) => Promise<T>;

const browserLock: AuthLock = async (name, work) => {
  if (!navigator.locks) throw new AuthProbeError("Web Locks are unavailable; concurrent session refresh is unsupported.");
  return navigator.locks.request(name, { signal: AbortSignal.timeout(30000) }, work);
};

export async function createExtensionAuth(config: ExtensionConfig, area: SessionArea = chrome.storage.session) {
  if (!config.supabaseUrl || !config.publishableKey) throw new AuthProbeError("Build with the hosted public Supabase settings first.");
  const storage = await sessionStorageAdapter(area);
  return createClient(config.supabaseUrl, config.publishableKey, {
    auth: {
      storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false,
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

/** Cross-workspace operations serialize using Web Locks; state remains in session storage. */
export async function withAuthOperation<T>(work: () => Promise<T>, lock: AuthLock = browserLock) {
  return lock("candidate-auth-operation", work);
}

export async function signInExistingAccount(client: SupabaseClient, email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new AuthProbeError(error.status && error.status < 500
    ? "Sign-in failed. Check the existing test account credentials and email confirmation."
    : "Auth service could not complete sign-in. Check connectivity and retry.");
  return verifiedIdentity(client);
}

export async function verifiedIdentity(client: SupabaseClient): Promise<User | null> {
  const { data: session, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw new AuthProbeError("The stored session could not be refreshed. Sign in again.");
  if (!session.session) return null;
  const { data, error } = await client.auth.getUser();
  if (error) throw new AuthProbeError(error.status && error.status < 500
    ? "The stored session is no longer valid. Sign in again."
    : "Identity could not be verified because Auth is unavailable.");
  return data.user;
}

/** Only this safe GET is retried once on 401; business writes are never replayed here. */
export async function verifyApiIdentity(client: SupabaseClient, config: ExtensionConfig) {
  const user = await verifiedIdentity(client);
  if (!user) throw new AuthProbeError("Sign in before checking the shared API identity.");
  const endpoint = `${config.apiUrl.replace(/\/$/, "")}/feasibility/identity`;
  let result: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new AuthProbeError("No usable authenticated session is available.");
    try {
      result = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(15000),
      });
    } catch { throw new AuthProbeError("API could not be reached, or its extension-origin allowlist blocked the request."); }
    if (result.status !== 401 || attempt === 1) break;
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw new AuthProbeError("Session refresh failed. Sign in again.");
  }
  if (!result?.ok) throw new AuthProbeError(`API identity check failed (HTTP ${result?.status ?? "unknown"}). Enable the development probe and exact extension origin.`);
  const body = await result.json();
  const expectedProject = new URL(config.supabaseUrl).hostname.split(".")[0];
  if (body.data?.userId !== user.id || body.data?.projectRef !== expectedProject || body.data?.verification !== "identity-only") {
    throw new AuthProbeError("Extension and API identities/projects did not match.");
  }
  return user.id;
}
