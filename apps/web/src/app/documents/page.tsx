import { AppShell as WorkspaceShell } from "@/components/app-shell";
import { candidatePageFailure } from "@/lib/candidates/page-context";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { DocumentHistory } from "./document-history";
export const dynamic = "force-dynamic";
export default async function Documents({ searchParams }: { searchParams: Promise<{ organizationId?: string; candidateId?: string }> }) {
  try {
    const query = await searchParams; const { context } = await requestContext(); const scope = currentOrganization(context, uuid(query.organizationId ?? context.organizations[0]?.organizationId));
    return <WorkspaceShell title="Document history" description="Frozen PDFs available through your current document permissions."><a className="mb-4 inline-block underline" href="/workspace">Workspace</a><DocumentHistory scope={scope} {...(query.candidateId ? { candidateId: uuid(query.candidateId) } : {})} /></WorkspaceShell>;
  } catch (e) { return candidatePageFailure(e); }
}
export const metadata = { title: "Document history" };
