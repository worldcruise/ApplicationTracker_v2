import type { DatabaseHistory, HistoryRecord } from "@candidate/contracts";
import { classifyHistory, identifyJob, validateHistoryContext } from "@candidate/domain";
import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { currentOrganization, uuid, checkMutationOrigin } from "@/lib/api/guards";
import { ApiFailure, databaseResult } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { strictObject } from "@/lib/candidates/input";
export const OPTIONS = preflight;
export async function POST(request: Request) {
  return api(request, async (): Promise<DatabaseHistory> => {
    const {client,context,token} = await requestContext(request);
    checkMutationOrigin(request,token);
    const scope = currentOrganization(context,uuid(new URL(request.url).searchParams.get("organizationId")));
    const body = strictObject(await readJson(request,250000),["candidateId","context"]);
    const candidateId = uuid(body.candidateId);
    let reviewed;
    try { reviewed = validateHistoryContext(body.context); }
    catch(error) { throw new ApiFailure(422,"SCHEMA_INVALID",error instanceof Error ? error.message : "Invalid reviewed context."); }
    const identifiers = await identifyJob(reviewed);
    const result = await databaseResult<{historyVersion:number;rows:HistoryRecord[];truncated:boolean;checkedAt:string;companyKey:string;companyLooseKey:string}>(
      client.rpc("application_history_candidates",{p_org:scope.organizationId,p_candidate:candidateId,p_company:reviewed.company}));
    if(result.historyVersion!==2)throw new ApiFailure(503,"SERVICE_UNAVAILABLE","Apply the current history migrations before checking frozen submission history. Results remain unknown.");
    // Never claim absence if server/client normalization versions disagree on a Unicode edge case.
    if (identifiers.companyKey !== result.companyKey || identifiers.companyLooseKey !== result.companyLooseKey) throw new ApiFailure(503,"SERVICE_UNAVAILABLE","Company normalization differs between server and client. History is unknown; repair the normalization deployment.");
    const matches=await classifyHistory(reviewed,result.rows);
    const included=new Set([...matches.company,...matches.possible].map(row=>row.observationId??row.id));
    if(result.rows.some(row=>!included.has(row.observationId??row.id)))throw new ApiFailure(503,"SERVICE_UNAVAILABLE","Stored company normalization differs from this matching version. History remains unknown.");
    return {...matches,identifiers,checkedAt:result.checkedAt,truncated:result.truncated,scope:"authorized_candidate"};
  });
}
