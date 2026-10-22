import { AppShell as WorkspaceShell } from "@/components/app-shell";
import { candidateContext, candidatePageFailure } from "@/lib/candidates/page-context";
import { getProfile } from "@/lib/candidates/service";
import { uuid } from "@/lib/api/guards";
import { LetterEditor } from "./letter-editor";
export const dynamic = "force-dynamic";
export default async function Letters({ params, searchParams }: { params: Promise<{ candidateId: string }>; searchParams: Promise<{ organizationId?: string }> }) {
  try { const { client, context, scope } = await candidateContext((await searchParams).organizationId); const profile = await getProfile(client, scope, uuid((await params).candidateId));
    return <WorkspaceShell title="Cover letters" description="Edit, review and append immutable letter versions. Saving or exporting never submits an application."><LetterEditor profile={profile} scope={scope} actorId={context.userId} /></WorkspaceShell>;
  } catch (error) { return candidatePageFailure(error); }
}
export const metadata = { title: "Cover letters" };
