import { WorkspaceShell } from "@candidate/ui";
import { candidateContext, candidatePageFailure } from "@/lib/candidates/page-context";
import { getProfile } from "@/lib/candidates/service";
import { uuid } from "@/lib/api/guards";
import { CandidateWorkspace } from "./workspace";
export const dynamic = "force-dynamic";
export default async function Candidate({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ organizationId?: string; tab?: string; returnTo?: string }> }) {
  const query = await searchParams; let data;
  try {
    const { client, scope } = await candidateContext(query.organizationId);
    const profile = await getProfile(client, scope, uuid((await params).candidateId));
    data = { profile, scope };
  } catch (error) { return candidatePageFailure(error); }
  return <WorkspaceShell title="Candidate workspace" description="Candidate profile, assignments and preserved history.">
    <CandidateWorkspace {...data} initialTab={query.tab ?? "overview"} directoryHref={query.returnTo?.startsWith("/candidates?") ? query.returnTo : `/candidates?organizationId=${data.scope.organizationId}`} />
  </WorkspaceShell>;
}
