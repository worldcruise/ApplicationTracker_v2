import { WorkspaceShell } from "@candidate/ui";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { candidatePageFailure } from "@/lib/candidates/page-context";
import { OperationalDashboard } from "./workspace";
export const dynamic = "force-dynamic";
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  try {
    const { context } = await requestContext();
    const scope = currentOrganization(context, uuid((await searchParams).organizationId ?? context.organizations[0]?.organizationId));
    return <WorkspaceShell title="Operations" description="Action queues and reports within your current access.">
      <OperationalDashboard scope={scope} actorId={context.userId} />
    </WorkspaceShell>;
  } catch (error) { return candidatePageFailure(error); }
}
