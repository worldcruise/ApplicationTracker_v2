import { AppShell as WorkspaceShell } from "@/components/app-shell";
import { candidateContext, candidatePageFailure } from "@/lib/candidates/page-context";
import { getProfile } from "@/lib/candidates/service";
import { uuid } from "@/lib/api/guards";
import { ResumeStudio } from "./studio";
export const dynamic = "force-dynamic";
export default async function Studio({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  let data;
  try { const { client, context, scope } = await candidateContext((await searchParams).organizationId); const profile = await getProfile(client, scope, uuid((await params).candidateId)); data = { profile, scope, actorId: context.userId }; }
  catch (error) { return candidatePageFailure(error); }
  return <WorkspaceShell title="Resume Studio" description="Versioned templates · external AI paste workflow · saving a source or PDF does not submit an application."><ResumeStudio {...data} /></WorkspaceShell>;
}
export const metadata = { title: "Resume Studio" };
