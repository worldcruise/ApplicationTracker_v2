# Pilot deployment runbook

**Disposition: not ready for real candidate onboarding.** Preparation targets a separate Supabase production project and a Render native Node service. No production account, project reference/domain, CLI session or budget approval was supplied, so no hosted resource, migration or deployment has been created. The initial smoke test must use synthetic accounts/data. [ACCEPTANCE.md](ACCEPTANCE.md) remains the release authority; passing CI is not a waiver for native Chrome, retention, recovery or load gates.

## Services and open approvals

Use Supabase PostgreSQL 17/Auth and a **Render native Node web service**, repository root build, one proposed `standard` (1 CPU/2 GB) instance in Virginia. Co-locate Supabase in `us-east-1` if the owner accepts this region. `render.yaml` is reviewable infrastructure configuration, with auto-deploy disabled. This is a paid proposal; confirm workspace/team, region, commercial terms, billing limit and incident owner before creating resources. Supabase Pro plus Render paid compute is proposed for recovery/availability; it does not satisfy the PRD's literal free-tier acceptance criterion without an explicit owner disposition.

Render supports the [full Next.js Node server](https://render.com/docs/deploy-nextjs-app). Static export cannot serve this application's API/proxy. Vercel Functions have a [4.5 MB request/response limit](https://vercel.com/docs/functions/limitations), while the existing document contract permits 16 MiB PDFs and returns base64 in JSON. Render is selected for preparation to preserve that contract. Maximum-size upload/export through actual Render ingress, memory and timeouts still need testing; no unlimited-body claim is made.

Keep development project `xsyxlxpsglhkmvzlmhih` unchanged. Create a new production project in an approved Supabase organization through its dashboard, with a distinct database password and project reference. Do not copy development users, identities, candidate records, signing keys, test fixtures or service keys. Identical email addresses in different projects are **different identities**. Use a separate production operator checkout and Chrome profile.

## Clean checkout and configuration

Install Node **24.22.0**, npm **11.19.1** and Git; use PowerShell `npm.cmd` when execution policy blocks `npm.ps1`. From a new directory:

```powershell
git clone https://github.com/worldcruise/ApplicationTracker_v2.git ApplicationTracker-pilot
Set-Location ApplicationTracker-pilot
git checkout v0.2.0-pilot.1
npm ci
npm run check
```

The tag identifies a source release candidate, **not a deployed/approved production release**. See [release procedure](RELEASING.md) for configured packaging and evidence. A local cache or `.tools` installation is not required by this procedure. Docker is optional for operators; full isolated database/RLS/browser/recovery checks run in GitHub Actions.

Copy `deploy/production.env.example` to an ignored `.env.production.local` and populate it privately. Do not overwrite `apps/web/.env.local`, which remains development-only. Load the production file with Node's `--env-file` for operator commands; Render receives the same variables through its encrypted environment settings. Public values must be present at **build and runtime**; changing them requires rebuilding both clients.

| Settings | Placement |
| --- | --- |
| `PRODUCTION_SUPABASE_PROJECT_REF`, `APPLICATION_ENV=production`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production web build/runtime. URL must exactly match the separate project; APP_URL is the exact HTTPS origin. Only `NEXT_PUBLIC_*` values may enter browser bundles. |
| `DOCUMENT_RENDER_KEY_ID=pilot-2026-01`, `DOCUMENT_RENDER_SIGNING_KEY` | Server-only secret store; independent random 32-byte hex key registered in the database. Retain old verification keys for historical versions; rotate additively. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only identity provisioning and operator bootstrap/configuration. Normal application requests still use the user's JWT and RLS. Never give this to an extension or replace user-context clients with it. |
| `EXTENSION_ALLOWED_ORIGIN` | Exactly `chrome-extension://egidlmfmpaelbkicmhoheoonleejbfkg`. No wildcard extension/web origins. |
| `PILOT_DATA_MODE=synthetic-only`, `FEASIBILITY_API_ENABLED=false` | Required initial pilot settings. The data-mode declaration is an operator gate, **not** an automatic PII detector. Restrict access to synthetic testers. |
| `RETENTION_POLICY_APPROVAL_ID` | Empty initially. `approved-production` requires the real accepted policy reference **and** completed purge/preservation/manual release work; setting a string alone does not certify readiness. |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Operator/controlled migration runner only, never web host or client. CLI login may use its normal secure session instead. |
| Backup `PG*`, `BACKUP_ENCRYPTION_KEY` | Separate recovery operator/secret escrow per [RECOVERY.md](RECOVERY.md), never web/client. |
| SMTP/provider credentials | Supabase Auth settings only. Do not put them in `NEXT_PUBLIC_*`, extension or archive metadata. |

Do not print environment values, request Authorization, cookies, recovery URLs, candidate JSON or private SQL backup content. Disable/sanitize query-string access logging for `/auth/confirm` and callback routes at every configured proxy/log sink; verify actual host logging behavior before real onboarding. Restrict provider accounts with MFA and named operator access.

## Database: review, then ordered application

Use the repository-pinned Supabase CLI. Login is required; the publishable key cannot migrate a database:

```powershell
npm exec --no -- supabase login
node --env-file=.env.production.local scripts/migrate-production.mjs plan
```

This is `npm run db:production:plan` with the production environment explicitly loaded. It targets `--project-ref` rather than trusting a stale development link, prints ordered migration checksums and uses `--dry-run --skip-vault`. CLI `SUPABASE_DB_PASSWORD` belongs in the private environment or its password prompt; do not use password flags. Verify project identity, **empty application schema**, PostgreSQL major and remote migration history privately before application. If a target already has schema, reconcile it through a reviewed baseline; never repair migration history blindly.

After reviewed backup/maintenance preparation, apply:

```powershell
node --env-file=.env.production.local scripts/migrate-production.mjs apply
npm exec --no -- supabase migration list --project-ref <production-ref>
node --env-file=.env.production.local apps/web/scripts/configure-documents.mjs
```

The pinned CLI's `migration list --project-ref` and `db push --project-ref` flags were checked with `--help`; no linked development target is needed. No seeds, test SQL or synthetic CI fixture account passwords are installed into production.

The **27** SQL migrations apply in lexical timestamp order. Never skip an intermediate file:

```text
20261017000100_foundation.sql
20261017000200_foundation_commands.sql
20261017000300_admin_roster.sql
20261018000100_self_deactivation_audit.sql
20261018000200_assignment_history_scope.sql
20261018000300_candidate_profiles.sql
20261018000400_candidate_profile_commands.sql
20261018000500_candidate_scope_directory.sql
20261018000600_resume_sources.sql
20261018000700_resume_validation_commands.sql
20261019000100_template_library.sql
20261019000200_template_source_pinning.sql
20261019000300_cover_letters_documents.sql
20261019000400_document_consistency.sql
20261019000500_bid_workflow.sql
20261019000600_pending_bid_facts.sql
20261019000700_interview_operations.sql
20261019000800_workflow_access.sql
20261019000900_workflow_serialization.sql
20261019001000_workflow_integrity.sql
20261020000100_application_history.sql
20261020000200_history_submission_snapshots.sql
20261020000300_archive_packages.sql
20261020000400_archive_device_observations.sql
20261020000500_operational_reporting.sql
20261020000600_operational_observations.sql
20261020000700_api_rate_limit.sql
```

Application/private command roles, constraints, grants and forced RLS are part of these migrations. Verify managed PostgreSQL operator privileges in staging; CI's cluster is not proof of hosted role-creation privileges. Do not loosen grants to fix a failed migration. Preserve applied migration logs/checksums in the release inventory without secrets.

## Auth and origins

In the **production** Supabase project configure email/password Auth, disable public signup and anonymous sign-in for the invite-only pilot, and configure approved SMTP delivery. Set Site URL to `NEXT_PUBLIC_APP_URL`. Allow exactly:

```text
https://<production-host>/auth/callback?mode=recovery
https://<production-host>/account/update-password
```

Use the committed `supabase/templates/invite.html` in the hosted invitation template. Keep the default recovery `{{ .ConfirmationURL }}` template for same-browser PKCE recovery, or deliberately configure the documented server token-hash recovery link in [FOUNDATION.md](FOUNDATION.md). `supabase/config.toml` changes local CI only; it does not configure hosted Auth. No wildcard preview domains or localhost redirects in production. The extension uses the previously selected existing-account email/password flow against this same project, so it does **not** need an OAuth/Chromium redirect. Extension PKCE remains unimplemented and is not claimed.

Create/confirm a designated synthetic first administrator in Supabase Auth, then bootstrap a **new** organization using its actual Auth UUID and a newly generated organization UUID:

```powershell
node --env-file=.env.production.local apps/web/scripts/bootstrap-admin.mjs --organization-id <new-org-uuid> --admin-user-id <confirmed-synthetic-auth-uuid> --name "Synthetic Pilot"
```

Sign in at `/sign-in`; there is no self-registration page. An administrator invites users in the application and explicitly activates organization/team membership and assignments. Auth existence does not grant access. Use two synthetic teams and all four roles for manual scope checks. Public web CORS remains same-origin; the shared API additionally accepts only the exact pinned extension origin and the documented headers. Cookie mutations retain exact Origin/CSRF checks; bearer calls retain user identity/current permissions. Test redirects, near-expiry proxy refresh and no-store through the actual host following [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md#manual-session-refresh-test-plan).

## Render deployment

Install the [Render CLI](https://render.com/docs/cli) (reference checked against 2.30.0). Connect the GitHub repository and authorize its read access in the approved Render workspace. Review `render.yaml`, select the `codex/pilot-release` source branch, then create the service through **New Blueprint** with that file and enter the `sync: false` values privately when prompted. This is the one-time dashboard/account/secret step; no secret command-line flags are necessary. The default branch may not contain this preparation yet. Do not enable production preview environments against the production database.

After the account exists, exact operator commands are:

```powershell
render login
render workspaces
render workspace set <approved-workspace-id>
render blueprints validate render.yaml --workspace <approved-workspace-id>
node --env-file=.env.production.local scripts/production.mjs check
render services
render deploys create <srv-production-service-id> --commit <verified-full-release-commit> --wait --confirm
render services update <srv-production-service-id> --auto-deploy=false --confirm
```

Use the service's assigned HTTPS domain initially or configure accepted custom DNS/TLS and update APP_URL/Auth/extension configuration together. Set root directory to repository root; build is `npm ci && npm run production:build`, start is `npm run production:start`, health path `/healthz`, provider `PORT` is honored. Install dev dependencies at build time because TypeScript/Tailwind are build tools. Avoid setting `NODE_ENV=production` during `npm ci` unless using `--include=dev`. No filesystem persistence on Render is relied upon. Keep secrets out of static asset/CDN configuration. `/healthz` is **liveness only**, never an authenticated readiness claim.

For local production-mode verification using the ignored production file:

```powershell
node --env-file=.env.production.local scripts/production.mjs build
node --env-file=.env.production.local scripts/production.mjs start
```

This starts only the web server, with no Docker. For normal hosted development use the existing `apps/web/.env.local` and `npm run dev` at `http://localhost:3000`.

## Smoke, release and monitoring

Supply designated synthetic account password and organization/team UUIDs through a private ignored `.env.smoke.local`, alongside the production settings:

```dotenv
PILOT_SMOKE_EMAIL=<designated-synthetic-account-email>
PILOT_SMOKE_PASSWORD=<private-test-password>
PILOT_SMOKE_ORGANIZATION_ID=<synthetic-org-uuid>
PILOT_SMOKE_TEAM_ID=<synthetic-team-uuid>
PILOT_SMOKE_SYNTHETIC_CONFIRMED=true
```

```powershell
node --env-file=.env.production.local --env-file=.env.smoke.local scripts/pilot-smoke.mjs
```

The test uses only public production configuration and its synthetic user's password; it does not require or use an administrative key/signing secret. A dedicated smoke env file may omit those server secrets. It separately checks service settings, web liveness, real password Auth, active membership, denied anonymous/unsupported client requests, a newly persisted synthetic candidate via the real API, direct authenticated RLS read and retained archive cleanup. It never submits an application or hard-deletes records. A failure after creation reports the synthetic candidate UUID for follow-up; a timeout before receiving that UUID may have committed and needs directory inspection, not blind write replay. It is also exercised against the isolated CI backend; hosted execution remains pending. Missing tables, inactive membership, invalid credentials or network failures must be investigated separately, never worked around with service-role product queries.

Then complete [RELEASING.md](RELEASING.md) and native Chrome/Windows checks in [ACCEPTANCE.md](ACCEPTANCE.md). Record service/project/domain, release commit/tag, migration checksums, signing-key ID (never value), provider quota snapshot, operator/time, smoke evidence, backup receipt/restore measurement and every manual result in [DEPLOYMENT_RESULTS.md](DEPLOYMENT_RESULTS.md).

Monitor HTTPS liveness plus a protected synthetic readiness probe, failed sync/processing dashboard, 401/403/409/429/5xx counts, latency, PDF/export failures, pending operations, DB size/CPU/connections, Auth email errors, egress and backup age/restore checks. Notifications need a named operator and configured provider channel; no alert integration is claimed as provisioned. Never log candidate content. Stop expansion if quotas, permission checks, exact historical PDF hashes or recovery fail.

## Rollback / incident response

Disable new changes, keep original immutable operation IDs and pending local work, preserve evidence and identify the last compatible release. Redeploy the prior verified commit with `render deploys create <service-id> --commit <last-compatible-sha> --wait --confirm`, keeping auto-deploy off. Reload the earlier unpacked extension in the **same directory/profile/identity**, retaining IndexedDB. Never uninstall/clear storage as a rollback step. Do not roll back the database by deleting history or editing applied migrations; use a reviewed forward correction. Additive v1 compatibility must survive the application rollback.

For data loss/corruption follow [RECOVERY.md](RECOVERY.md), restore into an isolated target, verify before cutover, then reconcile database receipts with original local journals. A timeout can have committed; look up the same operation before retry. Saving remains independent of submission. Credential exposure requires key rotation and incident review; document HMAC verification keys may need retained inactive historical verification rather than deletion. Retention and purge authority remain pending: no real candidate onboarding until T058 and preservation/backup-expiry rules are accepted and tested.
