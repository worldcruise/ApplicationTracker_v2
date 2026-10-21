import { redirect } from "next/navigation";
import { WorkspaceShell } from "@candidate/ui";
import { CheckStatus } from "./check-status";
import type { AccountStatus } from "@candidate/contracts";
import { authenticatedIdentity } from "@/lib/api/context";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { SignOut } from "@/app/workspace/sign-out";
export const dynamic = "force-dynamic";
export default async function Status() {
  let status: AccountStatus;
  try {
    const { client } = await authenticatedIdentity();
    status = await databaseResult<AccountStatus>(client.rpc("get_my_account_status"));
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 401) redirect("/sign-in");
    return <WorkspaceShell title="Account status unavailable" description="Your current status could not be checked. No access has been granted."><CheckStatus /><SignOut /></WorkspaceShell>;
  }
  if (status.status === "approved" && status.emailVerified) redirect("/workspace");
  const title = status.status === "rejected" ? "Account request rejected" : status.status === "pending" ? "Awaiting administrator approval" : "No active organization membership";
  return <WorkspaceShell title={title} description="Email verification and administrator approval are separate requirements.">
    <div className="grid gap-4 rounded border bg-white p-6">
      <p role="status">{status.status === "rejected" ? "An administrator rejected your request. Contact the organization administrator if you believe this is an error."
        : status.status === "pending" ? "Your request is pending. Candidate records, documents and operational tools are unavailable until approval."
        : "Ask the organization administrator to check your invitation or activation."}</p>
      {status.status !== "not_requested" && <p>Email: {status.emailVerified ? "Verified" : "Not verified. Open the confirmation email before approval."}</p>}
      {status.reason && <p>Review reason: {status.reason}</p>}
      <CheckStatus /><SignOut />
    </div>
  </WorkspaceShell>;
}
