import type { ApiErrorResponse, ApiResponse, FoundationCommand } from "@candidate/contracts";

export async function readApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const body = await response.json() as ApiResponse<T> | ApiErrorResponse;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error.message : "The request failed.");
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

