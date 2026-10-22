import { AppShell as WorkspaceShell } from "@/components/app-shell";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { candidatePageFailure } from "@/lib/candidates/page-context";
import { WorkflowWorkspace } from "./workspace";
export const dynamic="force-dynamic";
export default async function Bids({searchParams}:{searchParams:Promise<{organizationId?:string;candidateId?:string;view?:string}>}){
 try{const q=await searchParams;const {context}=await requestContext();const scope=currentOrganization(context,uuid(q.organizationId??context.organizations[0]?.organizationId));return <WorkspaceShell title={q.view === "interviews" ? "Interviews" : q.view === "followups" ? "Follow-ups" : "Bids"} description="Independent opportunities, exact-version reviews and explicit submission records."><a className="underline" href="/workspace">Workspace</a><WorkflowWorkspace scope={scope} actorId={context.userId} candidateId={q.candidateId?uuid(q.candidateId):""} initialView={q.view??"bids"} /></WorkspaceShell>;}catch(e){return candidatePageFailure(e);}
}
export const metadata = { title: "Bids" };
