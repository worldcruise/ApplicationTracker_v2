import { api, preflight } from "@/lib/api/http";
import { authenticatedIdentity } from "@/lib/api/context";
import { databaseResult } from "@/lib/api/errors";
import type { AccountStatus } from "@candidate/contracts";
export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => {
    const { client } = await authenticatedIdentity(request);
    return databaseResult<AccountStatus>(client.rpc("get_my_account_status"));
  });
}
