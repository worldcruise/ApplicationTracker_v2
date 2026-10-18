"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export function SignOut() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <div><button disabled={busy} className="rounded border px-3 py-2" onClick={async () => {
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) { setMessage("Sign-out failed. Retry when the service is available."); return; }
      router.replace("/sign-in"); router.refresh();
    } catch { setMessage("Sign-out failed. Try again."); }
    finally { setBusy(false); }
  }}>{busy ? "Signing out…" : "Sign out"}</button><p role="status">{message}</p></div>;
}

