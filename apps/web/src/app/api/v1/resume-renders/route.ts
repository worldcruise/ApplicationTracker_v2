import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
import { getAssembly } from "@/lib/resumes/service";
import { renderAssembly } from "@/lib/resumes/render";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request) { return api(request, async () => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const b = strictObject(await readJson(request, 2_097_152), ["assemblyId", "rawJson", "review", "renderedAt"]);
  const assembly = await getAssembly(client, scope, uuid(b.assemblyId)); const current = await getProfile(client, scope, assembly.candidateId);
  if (current.status === "archived") throw new ApiFailure(403, "FORBIDDEN", "Restore the candidate before generating a new PDF.");
  if (current.rowVersion !== assembly.profileRevision) throw new ApiFailure(409, "VERSION_CONFLICT", "The verified profile changed. Assemble a new prompt and re-review this source.");
  const { bytes, ...receipt } = await renderAssembly(assembly, b.rawJson, b.review, b.renderedAt);
  return { ...receipt, base64: Buffer.from(bytes).toString("base64") };
}); }
