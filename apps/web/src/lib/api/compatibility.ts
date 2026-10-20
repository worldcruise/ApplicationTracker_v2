import { ApiFailure } from "./errors";
/** Unversioned 0.1.0 clients retain v1, including their frozen pending operations. */
export function checkClientVersion(request: Request) {
 const client=request.headers.get("x-candidate-client"); if(client===null)return;
 if(!/^extension\/0\.(1|2)\.\d+$/.test(client))throw new ApiFailure(426,"CLIENT_UPGRADE_REQUIRED","Install a supported pilot extension (0.1.x or 0.2.x). Keep the original browser profile and pending operations; do not reset local storage.");
}
