// Trusted operator setup only. No public route loads a privileged credential.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
const { values } = parseArgs({ options: { "organization-id": { type:"string" }, disable: { type:"boolean", default:false } }, strict:true });
const org = values["organization-id"];
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(org ?? "")) throw new Error("Supply --organization-id with the existing approved organization UUID.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Privately configure NEXT_PUBLIC_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY.");
const client = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const { error } = await client.rpc("configure_registration",{p_org:org,p_enabled:!values.disable});
if (error) { process.stderr.write("Registration configuration failed. Check migrations, organization state and its active administrator. No credentials were printed.\n"); process.exitCode=1; }
else process.stdout.write(`Registration ${values.disable ? "disabled" : "enabled"} for organization ${org}. Configure hosted email signup/confirmation separately.\n`);
