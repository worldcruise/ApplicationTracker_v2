import { WorkspaceShell } from "@candidate/ui";
import { requestContext } from "@/lib/api/context";
import { currentOrganization,uuid } from "@/lib/api/guards";
import { candidatePageFailure } from "@/lib/candidates/page-context";
import { getBid } from "@/lib/workflow/service";
import { WorkflowWorkspace } from "../workspace";
export const dynamic="force-dynamic";
export default async function BidPage({params,searchParams}:{params:Promise<{bidId:string}>;searchParams:Promise<{organizationId?:string;view?:string}>}){
 try{const p=await params;const q=await searchParams;const {client,context}=await requestContext();const scope=currentOrganization(context,uuid(q.organizationId??context.organizations[0]?.organizationId));const bid=await getBid(client,scope,uuid(p.bidId));return <WorkspaceShell title="Bid workspace" description="Saving and exporting do not record submission."><a className="underline" href={`/bids?organizationId=${scope.organizationId}`}>Bid board</a><WorkflowWorkspace scope={scope} actorId={context.userId} initialId={bid.id} candidateId={bid.candidateId} initialView={scope.role!=="bidder"&&q.view==="interviews"?"interviews":q.view==="followups"?"followups":"bids"}/></WorkspaceShell>;}catch(e){return candidatePageFailure(e);}
}
