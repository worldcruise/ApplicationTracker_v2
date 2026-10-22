"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registrationErrors } from "@candidate/contracts";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@candidate/ui";
export function RegistrationForm({ available }: { available: boolean }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(available ? "" : "Registration is unavailable. Ask the administrator to configure account requests and email signup, then reload this page.");
  const [errors, setErrors] = useState<{ path: string; message: string }[]>([]);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || sent || !available) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const values = { fullName: String(form.get("fullName") ?? ""), email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), confirmation: String(form.get("confirmation") ?? "") };
    const invalid = registrationErrors(values); setErrors(invalid); setMessage("");
    if (invalid.length) return;
    setBusy(true);
    try {
      const { data, error } = await createClient().auth.signUp({ email: values.email.trim(), password: values.password,
        options: { data: { full_name: values.fullName.trim(), registration_flow: "approval_v1" }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) {
        setMessage(error.code === "weak_password" ? "Choose a stronger password that meets the project's password policy."
          : error.status === 429 ? "Too many signup or email requests. Wait before trying again."
          : error.code === "signup_disabled" ? "Email signup is disabled. Contact the administrator."
          : "Registration could not be completed. Check your details and retry; if you already have an account, sign in or recover it. Contact the administrator if this continues.");
        return;
      }
      element.reset(); setSent(true);
      if (data.session) { router.replace("/account/status"); router.refresh(); }
      else setMessage("Check your email for a confirmation link. Open it to verify your email, then sign in to check administrator approval. If you already registered, use Sign in or Account recovery. Email verification does not grant application access.");
    } catch { setMessage("The authentication service could not be reached. Check your connection and retry."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={busy} className="auth-form grid gap-4">
    {([['fullName','Full name','text','name'],['email','Email','email','email'],['password','Password','password','new-password'],['confirmation','Confirm password','password','new-password']] as const).map(([name,label,type,complete]) => <div key={name} className="grid gap-1"><label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} autoComplete={complete} required maxLength={name === 'fullName' ? 200 : name === 'email' ? 320 : 256} disabled={busy || sent || !available} aria-invalid={errors.some(e => e.path === name)} aria-describedby={`${name}-error`} className="rounded border p-2" />
      <span id={`${name}-error`} className="text-sm text-red-800">{errors.find(e => e.path === name)?.message}</span>
    </div>)}
    <p className="text-sm">Use 12–256 characters for your password. An Admin assigns your role and team after review.</p>
    <Button type="submit" variant="primary" disabled={busy || sent || !available}>{busy ? "Creating account…" : "Create account"}</Button>
    <p role="status">{message}</p><div className="auth-links"><span>Already have an account? <Link className="font-semibold" href="/sign-in">Sign in</Link></span><Link href="/account/recovery">Account recovery</Link></div>
  </form>;
}
