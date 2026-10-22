import { AuthShell as WorkspaceShell } from "@candidate/ui";
import { AuthForm } from "@/app/auth/auth-form";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function UpdatePassword() {
  const { data, error } = await (await createClient()).auth.getUser();
  if (error || !data.user) return <WorkspaceShell title="Password update requires a session" description="Open a valid invitation or recovery link, or sign in first."><Link className="underline" href="/account/recovery">Request a recovery link</Link></WorkspaceShell>;
  return <WorkspaceShell title="Set your password" description="Use an authenticated account, invitation or recovery session."><AuthForm mode="update" /></WorkspaceShell>;
}

export const metadata = { title: "Set your password" };
