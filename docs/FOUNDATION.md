# Foundation operations and boundaries

This increment implements the Section 4–8 authorization foundation. It brings forward minimal candidate, draft-bid and interview permission anchors. [Candidate management](CANDIDATES.md) subsequently adds profile children/revisions, the directory and editor. Company identity, scheduling, submission approvals, submissions, document versions and full OpenAPI remain their build-plan tasks. There is no submission command. `approval_policy = NULL` is undecided; it never authorizes a submission. The user resolved C01: Ready requires name, email, location and phone.

## Database model

An Auth identity alone grants no application access. Each request resolves an active application user, active organization, active organization membership and, when required, matching active team membership. Organization roles are `admin`, `team_leader`, `team_member`, `bidder`. Team roles must match the current organization role. Ownership is descriptive and does not replace assignment or membership. A member requires a current assignment; a leader requires their own team. Organization IDs and compound foreign keys constrain child links.

All business tables enable and force RLS. `authenticated` has SELECT only and explicitly named RPC execution; application roles cannot directly insert/update/delete. Protected commands run as `app_command`, a non-owner NOLOGIN/NOBYPASSRLS role with individual grants and policies. Commands check current scope, pin an empty search path, use qualified tables, and append redacted audit events atomically. Permission helpers use a separate non-login scope reader to avoid recursive membership policies; that reader cannot read profile bodies, notes, feedback or Auth passwords. No runtime role is granted to `authenticated` or the API authenticator.

Assignment endings are immutable; rows are retained. Deactivation closes assignments, disables team memberships and revokes bidder grants in the same transaction. Reactivation restores none of those privileges. Last-active-admin removal is rejected under an organization lock. Membership/summary updates require an expected version; stale versions fail with `VERSION_CONFLICT`.

Bidder access requires an unrevoked, unexpired, exactly-one-target grant and current membership in the target team. A bid grant never authorizes another bid or candidate-wide preparation. `get_bidder_candidate` uses a separate non-owner reader with access only to safe identity/contact columns and the separately approved summary. Email and phone are denied unless explicitly granted. Its fixed response excludes notes, profile content, assignments, unrelated activity and interview feedback. `documentReferences` is empty until immutable documents and their linkage checks exist (T026–T027); it never invents access to future versions. Raw candidates, summaries, interviews and feedback remain denied to bidders even through direct REST queries.

The foundation introduces no general capability override, team transfer, interview mutation or submission RPC. Profile commands are documented in [CANDIDATES.md](CANDIDATES.md). Grant capabilities remain constrained to preparation and future document read/export; they cannot grant candidate editing, resume generation or interview access. Later migrations must preserve these boundaries.

## Isolated database checks

Verified [CI run at fdefe38](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39098518897): all five migrations replay from empty, 104 pgTAP assertions, 27 application tests, web/MV3 production builds and 279 real Auth/production API/artifact assertions pass. Self-deactivation audit and historical assignment/team boundaries have regression coverage. These are isolated synthetic checks; hosted and browser acceptance remain separate.

`.github/workflows/foundation.yml` starts a fresh Supabase instance on an ephemeral Ubuntu runner, resets from migrations, and runs `supabase test db`. It uses no hosted project reference, database password or hosted credentials. Transaction-local synthetic fixtures cover all four roles in each of two organizations, two unrelated teams in the first organization and a third in the second, inactive/invited users, ownership without assignment, revocation and reactivation. Fixtures roll back; `supabase/seed.sql` intentionally does not install accounts or candidate records.

Optional local commands on a Docker-capable machine:

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:test
npm run db:stop
```

Hosted development does not require Docker. Apply only reviewed migration files using the linked-project procedure in [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md). Do not run the authorization fixtures against hosted development or production. CI execution evidence is recorded in [PROGRESS.md](PROGRESS.md).

## Current decisions and limits

Supabase's managed Auth schema grants cannot be delegated by the normal migration user. Fixed `private.actor_id`/`actor_role` bridges therefore remain migration-owned and delegate only to `auth.uid()`/`auth.role()` without querying tables. Two command-only Auth identity bridges read only ID/email/confirmation status; they cannot mutate identities or return password material. The business permission reader has no Auth-schema access. Every business mutation remains owned by the separate non-owner, NOBYPASSRLS command role. CI exercises this distinction on the actual Supabase stack.

- D10: the implementation provides invite/attach plus explicit activation and an out-of-band bootstrap mechanism. The owner must still approve and configure hosted onboarding policy; hosted public signup was previously observed enabled. An uninvited Auth identity receives no organization membership.
- Mixed roles across teams and arbitrary capability overrides are not implemented. This increment uses one primary role per organization and matching team roles as a conservative foundation restriction, not an approved permanent product rule. Confirm the mixed-role/override contract before widening scope; the PRD/design do not explicitly settle it.
- Deactivation is organization-scoped. It revokes database access immediately despite a valid token, retains identity/history and preserves access to other organizations. It does not globally ban an Auth identity or revoke sessions belonging to unrelated organizations. A global account shutdown/session purge requires a separately authorized platform operation; previously exported local files cannot be revoked.
- H001-C01 remains: official browser/server SSR uses JavaScript-readable Supabase cookies. SameSite=Lax, Secure production cookies, no-store responses and server mutation CSRF checks remain required. Do not silently switch to an incompatible HttpOnly-only client pattern.
- Live email delivery, callback behavior, browser sessions and hosted migration/application access require manual evidence. CI fixtures do not demonstrate hosted configuration or real account recovery.

## Account setup and recovery

1. Apply the reviewed migrations to an authorized development target following [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md). This task does not apply them to the hosted project. Preserve existing `apps/web/.env.local`; the public project settings already configured there are reused.
2. Set `NEXT_PUBLIC_APP_URL` to the exact application origin (locally `http://localhost:3000`). Set the hosted Auth Site URL to that origin and allow exactly `/auth/callback?mode=recovery` and `/account/update-password` redirects. The local config does not change hosted settings.
3. Configure the hosted **invite** email template to use the link in `supabase/templates/invite.html`: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. This exchanges a one-time invite hash server-side and redirects to a fixed password page. Keep the default recovery `{{ .ConfirmationURL }}` template for the browser-initiated PKCE flow; open recovery links in the same browser that requested them. A custom recovery template may instead use `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Do not log email links, query credentials, session cookies or request authorization headers in infrastructure.
4. An authorized operator creates or invites and confirms the first synthetic Auth identity using the Supabase dashboard. Copy its UUID privately. No application password is stored. For this operator command and subsequent Auth invitations only, provide `SUPABASE_SERVICE_ROLE_KEY` through the ignored web env file or a server secret manager. Never prefix it with `NEXT_PUBLIC_`, send it to the extension, or paste it into a command argument.
5. Bootstrap a **new** organization with a new UUID and the existing confirmed Auth UUID:

```sh
npm run admin:bootstrap -- --organization-id <new-organization-uuid> --admin-user-id <confirmed-auth-uuid> --name "Synthetic Development"
npm run dev
```

The bootstrap RPC is executable only by `service_role`; it creates organization, active admin membership and audit atomically. It refuses an existing organization, so retries cannot attach or escalate a user. After an uncertain response, inspect memberships/audit before retrying. Retain the operator audit request ID. Remove the operator key after bootstrap if server invitations are not needed; ordinary application use never needs it.

Visit `/sign-in`, then `/workspace`. The admin can invite/attach accounts, explicitly activate confirmed identities, change roles, deactivate/reactivate memberships, create teams and manage matching team roles. No public signup UI exists. An invitation attaches an **inactive** membership; only explicit activation enables access. Team membership and assignments must then be granted separately. The last active admin cannot be removed. `/account/recovery`, `/auth/callback` and `/account/update-password` implement recovery; sign-out uses Supabase Auth and clears its session cookies.

Provisioning records `(organization, operationId, actor, requestHash)` before calling Auth. It checks for an existing identity first, reconciles an accepted invitation whose response was lost, and records `CONFIGURATION_REQUIRED` or `AUTH_UNAVAILABLE` while remaining `pending_auth` on failure. Retry the original frozen fields and operation ID through Account operations; a changed actor or payload is rejected. `awaiting_activation` advances to `completed` after activation. Existing deactivated memberships are never silently restored by an invitation. Another active admin may start a **new** operation ID for the same intended identity if the original actor is unavailable; the original operation remains part of the audit/reconciliation record. No global Auth ban or identity deletion is hidden inside organization deactivation.

## Foundation API

Every route is under `/api/v1`, validates identity and current membership server-side, uses the caller's public-key/JWT or SSR cookie context, and returns `{ requestId, data }` or the shared error envelope. Responses are private/no-store. Extension requests use a bearer token and the configured exact `EXTENSION_ALLOWED_ORIGIN`. Cookie mutations require the exact application `Origin`; malformed bearer headers never fall back to cookies. Database RLS and commands independently recheck scope. Missing migrations, unavailable Auth/database services, invalid authentication and denied access produce distinct 503/401/403 outcomes.

| Route | Scope and behavior |
| --- | --- |
| `GET /me` | Current active organizations, roles and team memberships; no role from JWT metadata or client state. Empty organizations is an authenticated identity without active membership. |
| `GET /organizations/{organizationId}` | RLS-filtered teams, memberships, assignments, grants and admin-only account operations. Display-name lookup also retains user RLS context. Initial lists cap at 100; complete cursor contracts remain T005. |
| `GET /candidates?organizationId=...` | Admin/leader/assigned-member directory. Bidders are denied. |
| `GET /candidates/{id}?organizationId=...&bidId=...` | Profile for authorized non-bidders; fixed safe projection for bidders. A bid-specific grant requires the exact bid ID. |
| `POST /organizations/{organizationId}/commands` | Strict foundation command union in `packages/contracts/src/foundation.ts`; no arbitrary RPC name, actor, organization, permission override or unknown fields accepted. |

Commands are `createTeam`, `setTeamMembership`, `setOrganizationMembership`, `createCandidate`, `changeAssignment`, `approveBidderSummary`, `createDraftBid`, `grantBidderAccess`, `revokeBidderAccess`, `provisionUser`. Administrative changes/grants require admin. Leaders create candidates, assign within their team and approve summaries. Members prepare assigned-candidate drafts; bidders need a candidate preparation grant to create a draft. Draft creation never submits an application. Candidate transfer and editing remain later tasks.

Membership/approved-summary commands require `If-Match: "<rowVersion>"`; use `"0"` only when the team membership/approved summary does not exist yet. Responses expose `rowVersion` and ETag. New organization memberships are attached only by provisioning. Assignment end/add is idempotent for an unchanged desired assignment and retains ended rows. Only provisioning currently has a durable frozen operation/retry contract; do not automatically replay other creation commands after an uncertain response. Inspect current state first.

Foundation command input bounds (32 KiB body; 200-character names/titles; 320-character email; 4,000-character approved summary) are defensive limits for these endpoints, not approval of the pending D11 resume/archive/load limits. Full OpenAPI, pagination and business field contracts remain T003–T005 and later entity tasks.

## Manual acceptance still required

- Use synthetic accounts for all four roles in two organizations. Check navigation and every command against current memberships, then deactivate/reassign while an old tab and access token remain open. Reload must reflect current scope; direct Supabase reads must also deny revoked access.
- Sign in, reload, sign out, close/reopen tabs and exercise password recovery. Open a real delivered invite, set the password, confirm no operational access before admin activation, then add team/assignment scope. Test expired/reused links and provider/network failure separately. This computer has no exposed browser; an automated HTTP test is not visual/browser acceptance.
- Follow [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md)'s near-expiry proxy refresh, multi-chunk cookie, redirect, revoked-refresh-token and cross-profile cache-isolation checks. Both successful and unsuccessful responses must carry no-store and preserve refreshed/deleted cookie chunks.
- Force an Auth invitation failure or remove the server admin key: operation stays pending with a safe code; restore configuration and retry the original operation. Repeat with Auth accepted but the client response lost. A payload change or different actor using the same key must fail.
- Review hosted signup, email templates, redirect allowlists, SMTP limits/delivery and operator ownership before onboarding. Configure the invite-only policy with the owner; the previous hosted signup mismatch is not automatically resolved by local code.

Implementation references: [official SSR client/session guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [password and recovery flows](https://supabase.com/docs/guides/auth/passwords), [Auth invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [isolated CI testing](https://supabase.com/docs/guides/deployment/ci/testing).
