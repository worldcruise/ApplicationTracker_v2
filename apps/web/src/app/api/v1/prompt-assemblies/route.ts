import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { getProfile } from "@/lib/candidates/service";
import { getAssembly } from "@/lib/resumes/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token);
  const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const incoming = await readJson(request, 1_048_576); const keys = ["candidateId", "profileRevision", "job"];
  const b = strictObject(incoming, incoming && typeof incoming === "object" && "templateVersionId" in incoming ? [...keys, "templateVersionId"] : keys); const id = uuid(b.candidateId);
  await getProfile(client, scope, id); const job = strictObject(b.job, ["company", "title", "description"]);
  if (!Number.isSafeInteger(b.profileRevision) || Object.values(job).some(v => typeof v !== "string") || new TextEncoder().encode(String(job.description)).length > 204800 || String(job.company).length > 200 || String(job.title).length > 200) throw new ApiFailure(422, "SCHEMA_INVALID", "Supply a profile revision and reviewed job text up to 200 KiB.");
  const assemblyId = await databaseResult<string>(client.rpc("assemble_resume_prompt", { p_org: scope.organizationId, p_candidate: id, p_revision: b.profileRevision, p_job: { ...job, ...(b.templateVersionId ? { templateVersionId: uuid(b.templateVersionId) } : {}) }, p_request: requestId }));
  return getAssembly(client, scope, assemblyId);
}); }
