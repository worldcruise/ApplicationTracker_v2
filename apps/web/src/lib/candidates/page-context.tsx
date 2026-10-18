import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@candidate/ui";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, requireRole, uuid } from "@/lib/api/guards";
import { ApiFailure } from "@/lib/api/errors";

export async function candidateContext(organizationId?: string) {
  const result = await requestContext();
  const id = organizationId ?? result.context.organizations[0]?.organizationId;
  const scope = currentOrganization(result.context, uuid(id));
  requireRole(scope, ["admin", "team_leader", "team_member"]);
  return { ...result, scope };
}
export function candidatePageFailure(error: unknown) {
  if (error instanceof ApiFailure && error.status === 401) redirect("/sign-in");
  return <WorkspaceShell title="Candidate access unavailable" description="The requested information could not be loaded.">
    <p role="alert">{error instanceof ApiFailure ? error.message : "The application service is unavailable. Check connectivity and migrations before retrying."}</p>
    <Link href="/workspace" className="underline">Return to workspace</Link>
  </WorkspaceShell>;
}
