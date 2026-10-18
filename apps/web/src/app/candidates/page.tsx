import { WorkspaceShell } from "@candidate/ui";
import { candidateContext, candidatePageFailure } from "@/lib/candidates/page-context";
import { listCandidates } from "@/lib/candidates/service";
import { databaseResult } from "@/lib/api/errors";
import { CandidateDirectoryView } from "./directory";

export const dynamic = "force-dynamic";
export default async function Candidates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (typeof value === "string") query.set(key, value);
  let data;
  try {
    const { client, context, scope } = await candidateContext(query.get("organizationId") ?? undefined);
    const [directory, teams, people, memberships, teamMemberships] = await Promise.all([
      listCandidates(client, scope, query),
      databaseResult<{ id: string; name: string }[]>(client.from("teams").select("id,name").eq("organization_id", scope.organizationId).eq("status", "active")),
      databaseResult<{ id: string; displayName: string }[]>(client.from("users").select("id,displayName:display_name").eq("status", "active")),
      databaseResult<{ userId: string; role: string }[]>(client.from("organization_memberships").select("userId:user_id,role").eq("organization_id", scope.organizationId).eq("state", "active")),
      databaseResult<{ userId: string; teamId: string }[]>(client.from("team_memberships").select("userId:user_id,teamId:team_id").eq("organization_id", scope.organizationId).eq("active", true)),
    ]);
    data = { directory, scope, teams, people: people.filter(p => memberships.some(m => m.userId === p.id)), memberships, teamMemberships,
      organizations: context.organizations.filter(o => o.role !== "bidder") };
  } catch (error) { return candidatePageFailure(error); }
  return <WorkspaceShell title="Candidates" description="Search and manage the candidates in your current scope.">
    <CandidateDirectoryView {...data} query={query.toString()} />
  </WorkspaceShell>;
}
