import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { ApiFailure } from "@/lib/api/errors";
import { getSource } from "@/lib/resumes/service";
import { render } from "@/lib/resumes/render";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request, route: { params: Promise<{ versionId: string }> }) { return api(request, async () => {
  const { client, context } = await requestContext(request); const scope = currentOrganization(context, uuid(new URL(request.url).searchParams.get("organizationId")));
  const source = await getSource(client, scope, uuid((await route.params).versionId));
  if (!source.render) throw new ApiFailure(422, "SCHEMA_INVALID", "This source version has no recorded PDF. Generate a new operation to record one.");
  const { bytes, ...result } = await render({ rawJson: source.rawJson, snapshot: source.snapshot, mapping: source.provenance.mapping, reviewed: source.provenance.reviewed, renderedAt: source.render.renderedAt, templateVersionId: source.templateVersionId, ...(source.templateSnapshot ? { template: source.templateSnapshot } : {}) });
  if (result.sha256 !== source.render.sha256 || result.pageCount !== source.render.pageCount || result.rendererVersion !== source.render.rendererVersion) throw new ApiFailure(409, "VERSION_CONFLICT", "Pinned recovery did not reproduce the recorded PDF hash. Exact historical export is unavailable; no replacement was substituted.");
  return { ...result, base64: Buffer.from(bytes).toString("base64") };
}); }
