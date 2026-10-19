import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { getAssembly } from "@/lib/resumes/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ assemblyId: string }> }) { return api(request, async () => {
  const { client, context } = await requestContext(request); return getAssembly(client, currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId"))), uuid((await route.params).assemblyId));
}); }
