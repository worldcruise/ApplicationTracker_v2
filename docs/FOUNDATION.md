# Foundation operations and boundaries

This increment implements the Section 4–8 authorization foundation. It brings forward minimal candidate, draft-bid and interview permission anchors; complete profile children/revisions, company identity, scheduling, approvals, submissions, document versions and full OpenAPI remain their build-plan tasks. There is no submission command. `approval_policy = NULL` is undecided; it never authorizes a submission. Phone and Ready validation remain pending C01.

## Database model

An Auth identity alone grants no application access. Each request resolves an active application user, active organization, active organization membership and, when required, matching active team membership. Organization roles are `admin`, `team_leader`, `team_member`, `bidder`. Team roles must match the current organization role. Ownership is descriptive and does not replace assignment or membership. A member requires a current assignment; a leader requires their own team. Organization IDs and compound foreign keys constrain child links.

All business tables enable and force RLS. `authenticated` has SELECT only and explicitly named RPC execution; application roles cannot directly insert/update/delete. Protected commands run as `app_command`, a non-owner NOLOGIN/NOBYPASSRLS role with individual grants and policies. Commands check current scope, pin an empty search path, use qualified tables, and append redacted audit events atomically. Permission helpers use a separate non-login scope reader to avoid recursive membership policies; that reader cannot read profile bodies, notes, feedback or Auth passwords. No runtime role is granted to `authenticated` or the API authenticator.

Assignment endings are immutable; rows are retained. Deactivation closes assignments, disables team memberships and revokes bidder grants in the same transaction. Reactivation restores none of those privileges. Last-active-admin removal is rejected under an organization lock. Membership/summary updates require an expected version; stale versions fail with `VERSION_CONFLICT`.

Bidder access requires an unrevoked, unexpired, exactly-one-target grant and current membership in the target team. A bid grant never authorizes another bid or candidate-wide preparation. `get_bidder_candidate` uses a separate non-owner reader with access only to safe identity/contact columns and the separately approved summary. Email and phone are denied unless explicitly granted. Its fixed response excludes notes, profile content, assignments, unrelated activity and interview feedback. `documentReferences` is empty until immutable documents and their linkage checks exist (T026–T027); it never invents access to future versions. Raw candidates, summaries, interviews and feedback remain denied to bidders even through direct REST queries.

No general capability override, team transfer, profile editing, interview mutation or submission RPC is introduced. The grant capabilities are constrained to preparation and future document read/export; they cannot grant candidate editing, resume generation or interview access. Later migrations must preserve these boundaries.

## Isolated database checks

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

- D10: the implementation provides invite/attach plus explicit activation and an out-of-band bootstrap mechanism. The owner must still approve and configure hosted onboarding policy; hosted public signup was previously observed enabled. An uninvited Auth identity receives no organization membership.
- Deactivation is organization-scoped. It revokes database access immediately despite a valid token, retains identity/history and preserves access to other organizations. It does not globally ban an Auth identity or revoke sessions belonging to unrelated organizations. A global account shutdown/session purge requires a separately authorized platform operation; previously exported local files cannot be revoked.
- H001-C01 remains: official browser/server SSR uses JavaScript-readable Supabase cookies. SameSite=Lax, Secure production cookies, no-store responses and server mutation CSRF checks remain required. Do not silently switch to an incompatible HttpOnly-only client pattern.
- Live email delivery, callback behavior, browser sessions and hosted migration/application access require manual evidence. CI fixtures do not demonstrate hosted configuration or real account recovery.
