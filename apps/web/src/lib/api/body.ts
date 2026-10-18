import { ApiFailure } from "./errors";

export async function readJson(request: Request, maximum = 262_144): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json") || !request.body) {
    throw new ApiFailure(400, "INVALID_JSON", "Supply an application/json body.");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    length += part.value.byteLength;
    if (length > maximum) { await reader.cancel(); throw new ApiFailure(413, "SCHEMA_INVALID", "The profile exceeds the 256 KiB request limit."); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ApiFailure(400, "INVALID_JSON", "Supply valid JSON."); }
}
