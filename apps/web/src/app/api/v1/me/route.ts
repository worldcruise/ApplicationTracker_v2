import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function GET(request: Request) {
  return api(request, async () => (await requestContext(request)).context);
}

