import { WorkspaceShell } from "@candidate/ui";
import { AuthForm } from "@/app/auth/auth-form";
export const dynamic = "force-dynamic";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const query = await searchParams;
  return <WorkspaceShell title="Sign in" description="Use your existing account. Application access requires an active organization membership."><AuthForm mode="sign-in" initialMessage={query.link === "invalid" ? "The sign-in link could not be completed. Request a fresh link or try again when the service is available." : ""} /></WorkspaceShell>;
}

