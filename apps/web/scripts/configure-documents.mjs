// Operator-only configuration. Never print the key or SDK payloads.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const operator = process.env.SUPABASE_SERVICE_ROLE_KEY;
const signingKey = process.env.DOCUMENT_RENDER_SIGNING_KEY;
const keyId = process.env.DOCUMENT_RENDER_KEY_ID ?? "primary";
if (!url || !operator || !/^[0-9a-f]{64}$/.test(signingKey ?? "") || !/^[a-zA-Z0-9_-]{1,60}$/.test(keyId)) {
  console.error("Set the project URL, server-only operator credential and 64-character lowercase hex DOCUMENT_RENDER_SIGNING_KEY. See docs/RESUME_WORKFLOW.md."); process.exitCode = 1;
} else {
  const client = createClient(url, operator, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await client.rpc("configure_document_render_key", { p_id: keyId, p_key_hex: signingKey });
  if (error) { console.error("Render key registration failed. Check migrations, operator access and whether this key ID is already registered with another key."); process.exitCode = 1; }
  else console.log(JSON.stringify({ result: "registered", keyId }));
}
