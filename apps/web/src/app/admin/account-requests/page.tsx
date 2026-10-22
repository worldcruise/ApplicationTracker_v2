import { redirect } from "next/navigation";
import { AppShell as WorkspaceShell } from "@/components/app-shell";
import { requestContext } from "@/lib/api/context";
import { ApiFailure } from "@/lib/api/errors";
import { currentOrganization, requireRole, uuid } from "@/lib/api/guards";
import { AccountReviews } from "./reviews";
export const dynamic = "force-dynamic";
export default async function AccountRequests({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  let org: string;
  try {
    const { context } = await requestContext();
    org = uuid((await searchParams).organizationId);
    requireRole(currentOrganization(context, org), ["admin"]);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect("/sign-in");
    return <WorkspaceShell title="Account review unavailable" description="Current administrator membership in the selected organization is required."><p>No applicant information is available.</p></WorkspaceShell>;
  }
  return <WorkspaceShell title="Account approval" description="Review verified applicants for this organization. Approval creates current role and team membership."><AccountReviews organizationId={org} /></WorkspaceShell>;
}
export const metadata = { title: "Account approval" };
