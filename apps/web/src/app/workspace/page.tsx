import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@candidate/ui";
import { requestContext } from "@/lib/api/context";
import { ApiFailure } from "@/lib/api/errors";
import { SignOut } from "./sign-out";
import { FoundationWorkspace } from "./workspace";
import { currentOrganization, uuid } from "@/lib/api/guards";

export const dynamic = "force-dynamic";
export default async function Workspace({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  let context;
  let initialOrganization = "";
  try { context = (await requestContext()).context; if (context.organizations.length) initialOrganization = currentOrganization(context, uuid((await searchParams).organizationId ?? context.organizations[0]?.organizationId)).organizationId; }
  catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect("/sign-in");
    return <WorkspaceShell title="Application access unavailable" description="The account or application service could not be checked.">
      <p>Check service connectivity and apply the foundation migrations before retrying.</p><Link href="/sign-in" className="underline">Return to sign in</Link><SignOut />
    </WorkspaceShell>;
  }
  return <WorkspaceShell title="Candidate workspace" description="Your access follows your current organization, team and assignments.">
    <div className="mb-5 flex items-center justify-between gap-4"><p className="text-sm">Account: {context.userId}</p><SignOut /></div>
    {context.organizations.length ? <FoundationWorkspace context={context} initialOrganization={initialOrganization} /> :
      <div role="status" className="rounded border p-5"><h2 className="font-semibold">No active organization membership</h2><p>Ask an organization administrator to check your invitation or activation. Signing in alone does not grant access.</p></div>}
  </WorkspaceShell>;
}

