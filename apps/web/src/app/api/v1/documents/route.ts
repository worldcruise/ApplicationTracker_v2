import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { readJson } from "@/lib/api/body";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { strictObject } from "@/lib/candidates/input";
import { documentColumns, storeDocument } from "@/lib/documents/service";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request) { return api(request, async () => {
  const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams; const scope = currentOrganization(context, uuid(q.get("organizationId")));
  // The database resolves current resource grants. No unrestricted profile query is made here.
  const query = client.from("documents").select(documentColumns).eq("organization_id", scope.organizationId).order("created_at", { ascending: false }).limit(100);
  if (q.has("candidateId")) query.eq("candidate_id", uuid(q.get("candidateId")));
  return databaseResult(query);
}); }
export async function POST(request: Request) { return api(request, async requestId => {
  const { client, context, token } = await requestContext(request); checkMutationOrigin(request, token); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const b = strictObject(await readJson(request), ["kind", "sourceVersionId"]); if (b.kind !== "resume" && b.kind !== "cover_letter") throw new ApiFailure(422, "SCHEMA_INVALID", "Choose a resume or cover letter version.");
  return storeDocument(client, scope, b.kind, uuid(b.sourceVersionId), requestId);
}); }
