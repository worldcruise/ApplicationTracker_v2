import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoundationCommand, ProvisioningResult } from "@candidate/contracts";
import { ApiFailure, databaseFailure, databaseResult } from "./errors";

type ProvisionCommand = Extract<FoundationCommand, { command: "provisionUser" }>;
interface ProvisionDependencies {
  client: SupabaseClient;
  organizationId: string;
  invite: (email: string) => Promise<void>;
}

/** The caller already resolved current admin scope; RPCs reauthorize every retry. */
export async function provisionUser(command: ProvisionCommand, deps: ProvisionDependencies): Promise<ProvisioningResult> {
  const p_org = deps.organizationId;
  const p_operation = command.operationId;
  await databaseResult(deps.client.rpc("begin_user_provisioning", { p_org, p_operation,
    p_email: command.email, p_display_name: command.displayName, p_role: command.role }));
  let completion = await deps.client.rpc("complete_user_provisioning", { p_org, p_operation });
  if (!completion.error) return completion.data as ProvisioningResult;
  if (completion.error.code !== "P0002" || completion.error.message !== "AUTH_IDENTITY_REQUIRED") throw databaseFailure(completion.error);
  try {
    await deps.invite(command.email);
  } catch (error) {
    await databaseResult(deps.client.rpc("record_provisioning_failure", {
      p_org, p_operation, p_code: error instanceof ApiFailure ? "CONFIGURATION_REQUIRED" : "AUTH_UNAVAILABLE",
    }));
    // An invitation may have succeeded before its network response was lost.
    completion = await deps.client.rpc("complete_user_provisioning", { p_org, p_operation });
    if (!completion.error) return completion.data as ProvisioningResult;
    if (completion.error.code !== "P0002") throw databaseFailure(completion.error);
    throw new ApiFailure(503, "SERVICE_UNAVAILABLE", "Provisioning remains pending. Retry with the same operation ID and original fields.", true);
  }
  return databaseResult<ProvisioningResult>(deps.client.rpc("complete_user_provisioning", { p_org, p_operation }));
}

