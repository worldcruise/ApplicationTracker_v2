import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid } from "@/lib/api/guards";
import { databaseResult } from "@/lib/api/errors";
import { getProfile } from "@/lib/candidates/service";
import { classicLayout, type TemplateVersion } from "@candidate/contracts";
export const dynamic = "force-dynamic"; export const OPTIONS = preflight;
export async function GET(request: Request) { return api(request, async () => {
  const { client, context } = await requestContext(request); const q = new URL(request.url).searchParams; const scope = currentOrganization(context, uuid(q.get("organizationId")));
  const profile = await getProfile(client, scope, uuid(q.get("candidateId")));
  const presets = await databaseResult<{ id: string; scope: TemplateVersion["scope"]; sharing: TemplateVersion["sharing"]; ownerId: string; teamId: string | null; candidateId: string | null; current: number }[]>(client.from("template_presets")
    .select("id,scope,sharing,ownerId:owner_id,teamId:team_id,candidateId:candidate_id,current:current_version").eq("organization_id", scope.organizationId).limit(1000));
  const versions = await databaseResult<{ id: string; name: string; version: number; presetId: string | null; layout: TemplateVersion["layout"]; layoutHash: string | null; assetHashes: Record<string, string>; rendererVersion: string }[]>(client.from("template_versions")
    .select("id,name,version,presetId:preset_id,layout,layoutHash:layout_hash,assetHashes:asset_hashes,rendererVersion:renderer_version").order("version", { ascending: false }).limit(2000));
  return versions.flatMap(v => { const p = presets.find(p => p.id === v.presetId); if (v.presetId && (!p || (p.scope === "team" && p.teamId !== profile.owningTeamId) || (p.scope === "candidate" && p.candidateId !== profile.id))) return [];
    return [{ ...v, layout: v.rendererVersion === "ats-classic/1.0.0" ? classicLayout : v.layout, layoutHash: v.layoutHash ?? "legacy-fixed-layout", scope: p?.scope ?? "builtin", sharing: p?.sharing ?? "organization", ownerId: p?.ownerId ?? null, teamId: p?.teamId ?? null, candidateId: p?.candidateId ?? null, current: !p || p.current === v.version } satisfies TemplateVersion]; });
}); }
