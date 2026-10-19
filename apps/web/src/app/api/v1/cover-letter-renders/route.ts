import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { strictObject } from "@/lib/candidates/input";
import { renderCurrentLetter } from "@/lib/documents/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request) { return api(request, async () => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const b = strictObject(await readJson(request, 2_097_152), ["candidateId", "profileRevision", "templateVersionId", "bodyText", "review", "renderedAt"]);
  const { bytes, ...receipt } = await renderCurrentLetter(client, scope, b, b.renderedAt);
  return { ...receipt, base64: Buffer.from(bytes).toString("base64") };
}); }
