import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthProbeError, createExtensionAuth, signInExistingAccount, verifiedIdentity, verifyApiIdentity, withAuthOperation } from "../auth";
import { extensionConfig } from "../config";

export function AuthProbe() {
  const [client, setClient] = useState<SupabaseClient>();
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking trusted session storage…");
  const origin = `chrome-extension://${chrome.runtime.id}`;

  useEffect(() => {
    let active = true;
    let instance: SupabaseClient | undefined;
    createExtensionAuth(extensionConfig).then(async value => {
      instance = value;
      if (!active) { value.auth.dispose(); return; }
      setClient(value);
      value.auth.onAuthStateChange(event => { if (active && event === "SIGNED_OUT") setUser(null); });
      const identity = await withAuthOperation(() => verifiedIdentity(value));
      if (active) { setUser(identity); setMessage(identity ? "Existing session verified with Supabase Auth." : "Sign in with an existing synthetic test account."); }
    }).catch(error => { if (active) setMessage(error instanceof AuthProbeError ? error.message : "Session could not be checked."); });
    return () => { active = false; instance?.auth.dispose(); };
  }, []);

  async function perform(work: () => Promise<string>) {
    if (!client || busy) return;
    setBusy(true);
    try { setMessage(await withAuthOperation(work)); }
    catch (error) { setMessage(error instanceof AuthProbeError ? error.message : "The authentication check failed. No identity was verified."); }
    finally { setBusy(false); }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "");
    const password = String(fields.get("password") ?? "");
    form.reset();
    void perform(async () => {
      const identity = await signInExistingAccount(client!, email, password);
      setUser(identity);
      return identity ? "Supabase identity verified. Application permissions are not established by this probe." : "Sign-in did not produce a verified identity.";
    });
  }

  return <section className="workspace-card probe-card" aria-labelledby="auth-title">
    <h2 id="auth-title">1. Extension sign-in</h2>
    <p>Existing synthetic accounts only. No account is created. Tokens stay in trusted extension session storage and are cleared by Chrome on browser restart or extension reload.</p>
    {!user && <form onSubmit={signIn} className="probe-form">
      <label>Email<input name="email" type="email" autoComplete="username" required disabled={busy || !client} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={busy || !client} /></label>
      <button type="submit" disabled={busy || !client}>Sign in to existing account</button>
    </form>}
    {user && <>
      <p>Last verified Supabase user ID: <code>{user.id}</code></p>
      <div className="probe-actions">
        <button disabled={busy} onClick={() => void perform(async () => {
          const refreshed = await client!.auth.refreshSession();
          if (refreshed.error) throw new AuthProbeError("Refresh failed. Sign in again.");
          const identity = await verifiedIdentity(client!);
          setUser(identity);
          return identity ? "Session refreshed and identity verified." : "No active session.";
        })}>Refresh and verify</button>
        <button disabled={busy} onClick={() => void perform(async () => {
          await verifyApiIdentity(client!, extensionConfig);
          return "Extension and API verified the same Supabase user and project. Membership and resource access remain untested.";
        })}>Verify shared API identity</button>
        <button disabled={busy} onClick={() => void perform(async () => {
          const result = await client!.auth.signOut({ scope: "local" });
          if (result.error) throw new AuthProbeError("Sign-out failed. Check connectivity before retrying.");
          setUser(null);
          return "This extension session is signed out.";
        })}>Sign out of extension</button>
      </div>
    </>}
    <p role="status" aria-live="polite">{busy ? "Checking…" : message}</p>
    <details><summary>Development identity check setup</summary>
      <p>Set the web app's private <code>FEASIBILITY_API_ENABLED=true</code> and <code>EXTENSION_ALLOWED_ORIGIN={origin}</code>, then restart the web dev server. The identity-only endpoint is disabled in production.</p>
      <p>Extension origin: <code>{origin}</code></p>
    </details>
  </section>;
}
