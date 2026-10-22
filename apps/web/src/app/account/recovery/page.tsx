import { AuthShell as WorkspaceShell } from "@candidate/ui";
import { AuthForm } from "@/app/auth/auth-form";
export const dynamic = "force-dynamic";
export default function Recovery() {
  return <WorkspaceShell title="Account recovery" description="Request a link to reset your password."><AuthForm mode="recover" /></WorkspaceShell>;
}

export const metadata = { title: "Account recovery" };
