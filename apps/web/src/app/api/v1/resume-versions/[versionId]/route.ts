import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { getSource } from "@/lib/resumes/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ versionId: string }> }) { return api(request, async () => {
  const { client, context } = await requestContext(request); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  return getSource(client, scope, uuid((await route.params).versionId));
}); }
