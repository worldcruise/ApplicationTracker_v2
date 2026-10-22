import { AuthShell as WorkspaceShell } from "@candidate/ui";
import { createClient } from "@/lib/supabase/server";
import { RegistrationForm } from "./registration-form";
export const dynamic = "force-dynamic";
export default async function Register() {
  const { data, error } = await (await createClient()).rpc("registration_available");
  return <WorkspaceShell title="Create account" description="Verify your email, then wait for an organization administrator to review your request.">
    <RegistrationForm available={!error && data === true} />
  </WorkspaceShell>;
}
export const metadata = { title: "Create account" };
