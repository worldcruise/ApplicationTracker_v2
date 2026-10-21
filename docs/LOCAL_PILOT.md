# Stage 1: localhost-first synthetic pilot

Active direction: **21 October 2026**. Run the existing Next.js 16 web application and `/api/v1` locally with hosted Supabase development project **`xsyxlxpsglhkmvzlmhih`**. Keep the GitHub repository, schema v1, existing features and immutable histories. No Docker, Render/Vercel account, public domain or new production project is required. Internet access to Supabase is required for Auth/database synchronization; this is not an offline database.

The initial route through the existing application is **sign in → workspace → candidate directory/profile/assignment → Resume Studio (ATS Classic) → PDF preview/export → candidate bids**. Other templates, letters, interviews, dashboards and extension code remain intact. Public deployment/release runbooks are retained for a later stage; their production-only guards intentionally do not accept this development project. Do not use `production:*` or `db:production:*` to run Stage 1.

## Start locally

Install Node **24.22.0** / npm **11.19.1** (Node 24 LTS/npm 11), then use the repository root:

```powershell
npm ci
npm run dev
```

Open the **Local pilot** URL printed by the launcher, normally **http://localhost:3000/sign-in**. It validates the public development settings, chooses port 3000 when available, sets the actual app origin for callbacks/CSRF checks, then builds/watches shared packages and starts Next on **IPv4 loopback `127.0.0.1`**. The browser/app origin remains **localhost**; the IPv4 listener avoids machines that deny IPv6 `::1`. It never starts Docker, migrates a database, modifies hosted Auth settings or provisions a cloud project. Ctrl+C stops the watches/server.

If PowerShell blocks `npm.ps1`, use `npm.cmd`. For this existing working copy only, the ignored portable runtime is also available:

```powershell
Set-Location C:\Users\Honey\Documents\dev\ApplicationTracker_v2
$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH
npm.cmd run dev
```

Fresh clones should install Node normally; `.tools/` is not a dependency. The launcher fails with setup guidance if public configuration is absent or points at another project. It does not require an operator/service-role key to start the app or perform ordinary authenticated work.

When 3000 is occupied, the default launcher checks 3001–3010 and prints the selected URL. Use that origin everywhere; email flows require its exact Auth URL configuration below. To choose a specific port in PowerShell:

```powershell
$env:PORT = '3001'
npm.cmd run dev
```

An explicitly requested occupied port fails rather than silently moving. Clear the override with `Remove-Item Env:PORT -ErrorAction SilentlyContinue` to prefer 3000 again. The computed `NEXT_PUBLIC_APP_URL` is a **process-only** override, so callback redirects and cookie mutations match the actual port without rewriting unrelated env settings. Use `localhost` consistently, not a mix of localhost/127.0.0.1/LAN IPs. Browser drafts/pending work are origin-specific: return to their original port to recover them rather than clearing storage. Ports do not isolate browser cookies; use separate browser profiles for role/session isolation. If the port is taken between probing and Next starting, resolve that collision and restart.

## Environment

On a fresh clone copy `apps/web/.env.example` to **`apps/web/.env.local`**, then fill public values privately from the **existing development project's** Connect dialog. Preserve an existing file. Root `.env.example` is a reference, not Next's env location.

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xsyxlxpsglhkmvzlmhih.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<existing-development-publishable-key>
```

Examples committed to Git keep key/project slots as placeholders. This working copy already has the public URL/key and now has the localhost app origin; `.env.local` is ignored. Shell variables take precedence, so clear stale production settings before using this local stage. Restart after changing env. The existing `@/lib/supabase` browser/request-scoped server clients and Next 16 `src/proxy.ts` remain in use; refreshed request/response cookies and no-store behavior are preserved.

| Optional private setting | Purpose / prerequisite |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing operator bootstrap and protected Auth invitations only. Never required for normal candidate/bid/source queries. Keep server-only; remove after bootstrap if invitations are unnecessary. |
| `DOCUMENT_RENDER_KEY_ID`, `DOCUMENT_RENDER_SIGNING_KEY` | Attested frozen PDF synchronization/retrieval, after matching document migrations/key registration. **Local preview/export and source-version saving do not require this signing key.** Retain original keys/bytes for historical documents; do not replace a registered ID with a different key. |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` | Authorized CLI management/migration runner only. Do not put these in client/public settings or command arguments. |
| `SUPABASE_TEST_ACCESS_TOKEN`, `SUPABASE_TEST_TABLE` | Optional existing synthetic user's authenticated diagnostic read; token is private and never logged. Choose an existing authorized relation, not a new sample table. |

Leave `FEASIBILITY_API_ENABLED=false` and extension origin unset unless separately testing that workflow. Stage 1 web sign-in needs no Chrome extension identity, OAuth redirect, extension build or content-script credential transport.

## Supabase dashboard changes you must make

Open the **existing project**, verify its ref `xsyxlxpsglhkmvzlmhih`, then:

1. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:3000`.
2. Add these exact **Redirect URLs**:

   ```text
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/callback?mode=recovery
   http://localhost:3000/account/update-password
   ```

   If using an alternate printed port, add the corresponding exact URLs for that port. Avoid wildcard public origins. Existing approved URLs for other development users need not be removed; coordinate project-wide Site URL changes. For invitations using the SiteURL-based template, Site URL must point to the intended running app.
3. Under **Authentication → Sign In / Providers**, enable the existing **email/password** provider. Use designated synthetic accounts. Keep the existing app's invite/activation model: disable public signup and anonymous sign-in for the pilot; no self-registration UI or automatic admin role is added.
4. Under **Authentication → Email Templates**, use the committed `supabase/templates/invite.html` invitation template, whose link is `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`. The app exchanges the one-time hash server-side and uses a fixed password page. Keep the default recovery `{{ .ConfirmationURL }}` for the browser-initiated PKCE recovery flow and open recovery links in the **same browser profile** that requested them. Verify the chosen sender/SMTP can deliver to your controlled synthetic test mailbox.
5. Confirm/create the existing synthetic Auth test identity in **Authentication → Users**. An Auth user is not automatically an application admin/member. Complete the migration/membership setup below before expecting candidate access.

These are **manual changes, not changes already made remotely**. `supabase/config.toml` configures optional local CI services only; editing it does not update hosted Auth. The dashboard settings follow [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls), [SSR client/proxy guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates). Web password sign-in is distinct from the browser-initiated recovery PKCE flow and from the later extension authentication workflow.

## Database and account setup without Docker

The repository has **27 ordered migrations** and existing four-role authorization. Hosted application schema/migration state must be checked; a successful Auth endpoint call does not establish it. An authorized operator needs CLI login/project access and the development database password. From this checkout:

```powershell
npm exec --no -- supabase login
npm exec --no -- supabase link --project-ref xsyxlxpsglhkmvzlmhih
npm exec --no -- supabase migration list --linked
npm exec --no -- supabase db push --linked --dry-run --skip-vault
```

Verify that the linked ref is exactly the existing development project and review history/schema/pending files before applying. **Do not reset the hosted database, overwrite an existing baseline, edit applied migrations, include CI seeds/test fixtures, or disable RLS.** If remote schema exists outside migration history, stop and reconcile a reviewed baseline first. After review, apply only pending migrations:

```powershell
npm exec --no -- supabase db push --linked --skip-vault
npm exec --no -- supabase migration list --linked
```

These commands use native hosted CLI operations; `db:start`, `db:reset` and Docker are unnecessary. Any schema/grant/policy correction still requires a new versioned migration. Isolated CI continues using Docker on its own runner for database/RLS tests; that does not impose Docker on this computer.

Use an existing active pilot organization when available. If no organization exists, the authorized operator privately supplies its server-only key, creates/confirms a synthetic Auth user in the dashboard, chooses a new organization UUID and uses the existing audited bootstrap:

```powershell
npm run admin:bootstrap -- --organization-id <new-org-uuid> --admin-user-id <confirmed-synthetic-auth-uuid> --name "Synthetic Local Pilot"
```

Do not bootstrap an existing organization or repeat an uncertain result blindly; inspect membership/audit first. See [FOUNDATION.md](FOUNDATION.md) for recoverable invitation and activation states. Sign in, create a synthetic team, activate designated users with matching organization/team roles and assign the candidate. Members require an active assignment; leaders require their team; bidders receive scoped preparation/export access and never raw profiles/interview feedback. All normal requests retain current user context for RLS, regardless of where Next runs.

Optional exact-PDF server storage, after private signing settings are configured:

```powershell
npm run documents:configure
```

This registers a private attestation key; it is not needed to preview/download the PDF locally. Source saving, PDF rendering, local export and database synchronization remain independently reported. Do not treat a failed exact-PDF sync as failed local export or as submission.

## Manual five-flow verification

Record the date, browser version, local origin, synthetic roles/team scope and result for each row. Avoid passwords, tokens, recovery URLs, real candidate facts or private key values in evidence.

| Flow | Steps / expected result |
| --- | --- |
| 1. Auth and access | Open `/sign-in`; use existing email/password synthetic account → `/workspace`. Refresh/reopen and verify the current organization/role. Request recovery from `/account/recovery`; use the same browser, change password, sign out and confirm protected APIs return 401 and protected pages route to sign-in. Follow [near-expiry proxy test](HOSTED_SUPABASE.md#manual-session-refresh-test-plan). Test separate admin/leader/member/bidder browser profiles; revoke membership/assignment and observe current backend/RLS denial despite an unexpired session. |
| 2. Candidate persistence | From workspace open the scoped directory; create `Synthetic Local Avery` as a Draft. Add only invented name/email/phone/location and a synthetic professional summary. Save, refresh and reopen. An authorized admin/leader assigns a member; that member can edit the assigned candidate, an unrelated member cannot. Ready requires name, email, location **and phone** (accepted C01). Preserve official vs approved display titles. Two tabs editing the same version must produce a conflict, preserve input and require an explicit resolution. |
| 3. JSON / ATS Classic | Candidate → Resumes → **Open Resume Studio**. Keep the existing default **ATS Classic** preset. Paste invalid JSON and verify actionable errors plus unchanged original text. Correct it to canonical v1 using only candidate facts; review mapping/claims. Target company remains separate from historical employers. Other built-in templates remain available but are not a Stage 1 dependency. |
| 4. PDF / local export | Generate the validated/reviewed PDF; preview each page and download **that same byte snapshot**. Check Unicode/multiple pages and exact historical source version after later profile edits. Save an immutable source, refresh history and retrieve it. If server PDF sync is unavailable, retain the successful local download and explicit synchronization error; configure signing prerequisites only for frozen server PDF storage. |
| 5. Basic bid tracking | Candidate → Bids → Manage opportunities, or workspace → Open bids. Create a synthetic opportunity with company/job details and an authorized owner/team. Refresh and verify persisted status/details. Create a second opportunity for the same candidate and confirm independent bids. Exercise a permitted pre-submission transition and a stale edit/denied action. Approval/submission constraints stay in force; saving a source, PDF or archive must never submit. Do not record an actual application submission during this initial smoke test. |

Starter v1 JSON for a candidate whose verified synthetic summary is exactly `Built synthetic web tools.`:

```json
{
  "company": "Synthetic Example Company",
  "title": "Synthetic Engineer",
  "summary": "Built synthetic web tools.",
  "skills": [],
  "experience": [],
  "education": []
}
```

All six top-level fields are retained. Empty arrays are allowed structural content/warnings, not proof of factual accuracy. Shared client/server validation and factual review remain necessary. Resume schema metadata stays outside this content object. Later edits must preserve historical source/template/profile/font/renderer/PDF identities. [Resume workflow](RESUME_WORKFLOW.md), [candidate workflow](CANDIDATES.md) and [bid rules](BID_INTERVIEW_WORKFLOW.md) contain the existing detailed flows.

## Checks and current evidence

```powershell
npm run check
npm run resume:verify
npm run db:check:hosted
```

`db:check:hosted` reports **service connectivity separately from an authenticated table query**. Without a synthetic user's private token/authorized table configuration it exits incomplete (2), even if `SERVICE_OK`. Do not infer that remote tables are absent or that permissions passed. No test table or service-role fallback is used. Root `check` does not need Docker or a hosted session; local socket checks need permission to bind loopback.

The previous tagged CI verified all five implementations using synthetic isolated Auth/API/RLS/browser data. That is retained regression evidence, not proof of this hosted project's current migrations/account/email/browser state. Current Stage 1 observations/results are in [PROGRESS.md](PROGRESS.md). [ACCEPTANCE.md](ACCEPTANCE.md) still records broader production/archive gates; public deployment, production budgets/domains and extension Windows checks are deferred from this web-only stage.
