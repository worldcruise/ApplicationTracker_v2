import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { promptVersions } from "@/lib/resumes/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request) { return api(request, async () => {
  const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams;
  return promptVersions(client, currentOrganization(context, uuid(q.get("organizationId"))), uuid(q.get("candidateId")));
}); }
