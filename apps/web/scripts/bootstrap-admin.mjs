import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({ options: {
  'organization-id': { type: 'string' }, 'admin-user-id': { type: 'string' }, name: { type: 'string' },
} });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !uuid.test(values['organization-id'] ?? '') || !uuid.test(values['admin-user-id'] ?? '') || !values.name?.trim()) {
  console.error('Set server-only SUPABASE_SERVICE_ROLE_KEY and the project URL. Supply --organization-id <new UUID> --admin-user-id <confirmed Auth UUID> --name <organization name>.');
  process.exitCode = 1;
} else {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const requestId = randomUUID();
  const { error } = await client.rpc('bootstrap_organization', {
    p_org: values['organization-id'], p_admin: values['admin-user-id'], p_name: values.name.trim(), p_request: requestId,
  });
  if (error) {
    // Never print SDK payloads, keys, links, passwords or tokens.
    console.error(error.message === 'BOOTSTRAP_ALREADY_EXISTS' ? 'Organization already exists. Inspect the existing membership/audit; bootstrap never attaches to an existing organization.' : 'Bootstrap failed. Check migrations, operator credentials and confirmed Auth identity.');
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ organizationId: values['organization-id'], adminUserId: values['admin-user-id'], requestId, result: 'bootstrapped' }));
  }
}
