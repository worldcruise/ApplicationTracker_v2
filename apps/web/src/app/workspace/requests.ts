import type { ApiErrorResponse, ApiResponse, FoundationCommand } from "@candidate/contracts";

export class ClientApiFailure extends Error {
  constructor(public status: number, public code: string, message: string,
    public currentVersion?: number, public fieldErrors: readonly { path: string; message: string }[] = []) { super(message); }
}

export async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json() as ApiResponse<T> | ApiErrorResponse;
  if (!response.ok || "error" in body) {
    if ("error" in body) throw new ClientApiFailure(response.status, body.error.code, body.error.message, body.error.currentVersion, body.error.fieldErrors);
    throw new Error("The request failed.");
  }
  return body.data;
}

export function sendCommand<T>(organizationId: string, command: FoundationCommand, version?: number) {
  return readApi<T>(`/api/v1/organizations/${organizationId}/commands`, {
    method: "POST", headers: { "Content-Type": "application/json",
      ...(version === undefined ? {} : { "If-Match": JSON.stringify(String(version)) }) },
    body: JSON.stringify(command),
  });
}

