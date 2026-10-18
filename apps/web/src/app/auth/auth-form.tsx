"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ mode, initialMessage = "" }: { mode: "sign-in" | "recover" | "update"; initialMessage?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const client = createClient();
      if (mode === "sign-in") {
        const { error } = await client.auth.signInWithPassword({
          email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""),
        });
        if (error) { setMessage("Sign-in failed. Check your credentials or try again when the service is available."); return; }
        router.replace("/workspace"); router.refresh();
      } else if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(String(form.get("email") ?? "").trim(), {
          redirectTo: `${window.location.origin}/auth/callback?mode=recovery`,
        });
        setMessage(error ? "Recovery is unavailable. Please wait and try again." : "If this account exists, check its email for a recovery link. Open it in this browser.");
      } else {
        const identity = await client.auth.getUser();
        if (identity.error || !identity.data.user) { setMessage("Open a valid invitation or recovery link, or sign in first."); return; }
        const { error } = await client.auth.updateUser({ password: String(form.get("password") ?? "") });
        if (error) { setMessage("The password could not be updated. Check the password policy or request a fresh link."); return; }
        setMessage("Password updated. You can open your workspace.");
        formElement.reset();
      }
    } catch { setMessage("The authentication service is unavailable. Try again."); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="mx-auto grid max-w-md gap-4 rounded-2xl border border-slate-200 bg-white p-6">
      {mode !== "update" && <label className="grid gap-1">Email<input name="email" type="email" autoComplete="email" required maxLength={320} className="rounded border p-2" /></label>}
      {mode !== "recover" && <label className="grid gap-1">{mode === "update" ? "New password" : "Password"}
        <input name="password" type="password" autoComplete={mode === "update" ? "new-password" : "current-password"}
          required minLength={mode === "update" ? 12 : 1} maxLength={256} className="rounded border p-2" /></label>}
      <button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : mode === "recover" ? "Send recovery link" : "Update password"}
      </button>
      <p role="status" className="text-sm">{message}</p>
      <div className="flex flex-wrap gap-4 text-sm underline">
        <Link href="/sign-in">Sign in</Link><Link href="/account/recovery">Account recovery</Link>
        {mode === "update" && <Link href="/workspace">Open workspace</Link>}
      </div>
    </form>
  );
}

