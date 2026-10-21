"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function CheckStatus() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(() => router.refresh())} className="justify-self-start underline disabled:opacity-50">{pending ? "Checking…" : "Check approval status"}</button>;
}
