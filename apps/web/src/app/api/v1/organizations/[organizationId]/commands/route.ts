import { api, preflight } from "@/lib/api/http";
import { requestContext } from "@/lib/api/context";
import { checkMutationOrigin, currentOrganization, applicationOrigin, uuid } from "@/lib/api/guards";
import { readCommand } from "@/lib/api/command-input";
import { executeCommand } from "@/lib/api/commands";
import { provisionUser } from "@/lib/api/provisioning";
import { createAuthAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;
export async function POST(request: Request, route: { params: Promise<{ organizationId: string }> }) {
  return api(request, async requestId => {
    const { client, context, token } = await requestContext(request);
    checkMutationOrigin(request, token);
    const scope = currentOrganization(context, uuid((await route.params).organizationId));
    const command = await readCommand(request);
    return executeCommand(command, { client, scope, request, requestId,
      provision: input => provisionUser(input, { client, organizationId: scope.organizationId,
        invite: async email => {
          const { error } = await createAuthAdmin().inviteUserByEmail(email, {
            redirectTo: `${applicationOrigin()}/account/update-password`,
          });
          if (error) throw new Error("Auth invitation unavailable");
        },
      }),
    });
  });
}

