# Hosted Supabase development

**Active Stage 1:** [LOCAL_PILOT.md](LOCAL_PILOT.md) is the current localhost-first setup/dashboard/verification guide. Web and `/api/v1` run locally; this existing hosted development project is retained. Public hosting, new production provisioning and extension authentication are later stages. Earlier historical verification below remains evidence of its stated scope.

The development project reference is `xsyxlxpsglhkmvzlmhih`. Its public URL/key are configured only in ignored `apps/web/.env.local`; examples remain placeholders. The web app uses Next.js 16.4.2, `src/app`, the `@/*` alias, and `src/proxy.ts`. No Docker, CLI login, database password, or service-role key is needed to serve the web shell against hosted Supabase.

## Run the application

From the repository root with Node 24/npm 11 on PATH:

```sh
npm ci
npm run dev
```

Visit `http://localhost:3000`. Existing `.env.local` values should be preserved; do not copy the example over an already configured file. A fresh clone needs the two public settings filled in from the development project's Connect dialog. Next reads the app's `.env.local`, not the root reference example. Restart the dev server after changing it.

On this working copy, Node is available as an ignored task-local portable runtime. In PowerShell, if `node`/`npm` are not on PATH:

```powershell
Set-Location C:\Users\Honey\Documents\dev\ApplicationTracker_v2
$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH
npm.cmd ci
npm.cmd run dev
```

New clones should install Node 24 LTS normally; `.tools/` is not committed. Use only synthetic candidate data. The [foundation](FOUNDATION.md) adds sign-in/out/recovery, callbacks, authorization migrations and account administration; hosted migrations and email settings still require an authorized operator.

## Clients, refresh, and authorization

- Client Components use `createClient` from `@/lib/supabase/client` for Auth. Business reads/writes go through `/api/v1`, preserving the design's shared API boundary.
- Server Components, Server Actions and Route Handlers use `await createClient()` from `@/lib/supabase/server` inside each request. `server-only` prevents this module from entering browser bundles. It reads that request's cookies; ordinary queries therefore retain the user's JWT and RLS context. Do not cache this client or replace the key with an administrative credential.
- `src/proxy.ts` calls `updateSession` on all matched routes, including API paths, excluding Next assets and common image files. `getClaims()` runs immediately after client creation. `setAll` updates request cookies, rebuilds the forwarded request, and sets all response cookies plus the SDK's cache headers. Previous response cookies survive repeated updates.
- All matched responses use private/no-store cache headers. User-context server fetches use `cache: 'no-store'`. The public shell uses `dynamic = 'force-dynamic'`; future authenticated pages must also avoid ISR/shared data caches. Verify deployed CDN cache settings respect no-store and never cache Set-Cookie responses.
- If adding a redirect/replacement response, use `preserveSessionResponse(sessionResponse, NextResponse.redirect(url))` from `@/lib/supabase/response`. It copies all cookie attributes/deletions and `Cache-Control`, `Pragma`, and `Expires`. Returning a fresh redirect alone loses the refreshed session. No auth redirect is needed by the current public shell.
- Proxy refresh is not an authorization guard. Every protected API handler must validate identity, resolve current active organization/team membership, check assignment/capability and field scope, and execute ordinary queries in user context. RLS/grants and backend checks are both mandatory. An unexpired token alone is not evidence of current membership or account activation. Foundation cookie mutations now check exact Origin; bearer requests use their verified token context without cookie fallback.

The [recorded cookie conflict](decisions/0002-hosted-supabase-ssr.md) explains why the requested Supabase browser SSR pattern uses JavaScript-readable session cookies despite the design's blanket HttpOnly requirement. Cookies are SameSite=Lax and Secure in production; use HTTPS for deployed authentication.

## Separate connectivity from database access

```sh
npm run db:check:hosted
```

This is read-only and does not require Docker. It loads `apps/web/.env.local` and calls Auth's settings endpoint with the public key. `SERVICE_OK` means the service accepted that key; it proves neither sign-in nor database authorization.

An authenticated database check runs only if both of these private shell environment variables are supplied through a secure local mechanism:

| Variable | Required value |
| --- | --- |
| `SUPABASE_TEST_ACCESS_TOKEN` | A current access JWT from an existing authorized **synthetic** test user's session. Never a service-role/secret key; never prefix this variable with `NEXT_PUBLIC_`. |
| `SUPABASE_TEST_TABLE` | An existing, owner-approved application table in the exposed public schema with an `id` column and established membership/resource RLS. Do not choose a raw bidder-restricted relation for a bidder test. |

The diagnostic verifies claims, then issues a HEAD/select-id request with the supplied user's Authorization header. It logs no token, cookie, candidate row, error body, or key. A successful response can still be empty because of RLS; positive and negative membership/assignment fixtures are required before claiming application authorization works. This diagnostic does not replace the backend permission gate or a business API test.

Results distinguish service/network errors, missing authentication, missing table configuration, invalid authentication, missing relations (`PGRST205`/`42P01`), and database permission failures (`42501`/HTTP 403). Missing table configuration means remote existence is **unverified**, not that the table is absent. Missing prerequisites produce a nonzero/incomplete result even when connectivity passes (the script uses exit 2; npm may wrap it as a lifecycle failure).

Repository migrations now define foundation tables and RLS, but they have not been applied to hosted development by this task. No hosted test-user credentials/session were supplied. Do not create a `todos` table, change signup merely for this connectivity probe, bypass the shared API for product features, disable RLS, or use an admin key to make this probe pass. The later explicitly requested registration workflow has its own reviewed setup in [REGISTRATION.md](REGISTRATION.md).

## Hosted migrations without Docker

The public app key does not authorize CLI management or schema changes. An authorized project maintainer needs a Supabase account with access to this development project, a CLI personal access token/login, and the development database password when prompted. Keep CLI access tokens/database passwords out of web env files, client bundles, command history, source control, and logs. CI credentials belong in an encrypted secret store; `.env.local` is not automatically loaded by the CLI.

Use the pinned local CLI from the repository root:

```sh
npx supabase login
npx supabase link --project-ref xsyxlxpsglhkmvzlmhih
npx supabase migration list --linked
npx supabase migration new descriptive_change_name
```

Review the linked project's identity, remote migration history, and existing schema **before** preparing a change. If the hosted database already has application schema outside this repository's migration history, reconcile a reviewed baseline first; do not blindly push, repair history, reset the remote database, or assume an empty local migration folder means an empty hosted schema. Export/review the existing schema using an authorized database tooling workflow if needed; some CLI pull/diff workflows require additional tooling/Docker and are not part of this Docker-free path.

Write every table/constraint/policy/grant/function change in `supabase/migrations/<timestamp>_<name>.sql`. Include tenant boundaries, immutable history protections, backend authorization, and database allow/deny tests in the relevant feature task. Then inspect the pending changes:

```sh
npx supabase db push --linked --dry-run
```

After review and explicit authorization for that migration, apply only to the verified development target:

```sh
npx supabase db push --linked
npx supabase migration list --linked
```

No schema change or CLI login/link/push was performed by H001. No application SQL migration was needed for that client configuration. The local `supabase/config.toml` does not configure hosted Auth. Current onboarding uses the later user-requested Admin-approved registration workflow; an authorized owner must apply [REGISTRATION.md](REGISTRATION.md), including migration, explicit intake organization, email confirmation and localhost callback settings.

For database tests, `npm run db:test` remains **local**. The CLI also supports `npx supabase test db --linked`; its test-runner tooling may require Docker and is not required to run this application. For Docker-free SQL checks, use an approved PostgreSQL client against a dedicated hosted development/test database and run the reviewed rollback-only test SQL. Tests requiring pgTAP need that extension available; psql alone prints assertions and does not constitute a TAP pass/fail runner. Use an appropriate TAP-aware runner and inspect every assertion. H001 does not claim database tests passed. Never run development fixtures or mutation tests against production.

## Manual session-refresh test plan

Prerequisites: an existing synthetic test account, an approved sign-in flow or trusted SSR test harness for this app origin, and a browser with developer tools. The sign-in/callback UI and membership migrations now exist. Apply the reviewed hosted migrations and configure the account/email prerequisites in [FOUNDATION.md](FOUNDATION.md) before testing hosted account access. The automated tests use the real SDK with a synthetic mocked Auth server; they do not prove hosted browser rotation.

1. Start the app with the configured hosted settings. Open `/` anonymously: expect HTTP 200, the public empty shell, private/no-store response headers, and no invented signed-in state.
2. Once an authorized sign-in flow/harness is available, sign in as the synthetic user. Inspect cookies privately; never copy tokens/cookie values into logs, screenshots, commits, or chat. Verify SameSite=Lax, path `/`, and Secure on deployed HTTPS. The documented Supabase cookie is deliberately not HttpOnly.
3. Close other app tabs and wait until the access token is near expiry/expired while the refresh token remains valid. Avoid client-side auto-refresh masking the test (for example, temporarily disable JavaScript for the next navigation after sign-in). Navigate to `/`; the server proxy should refresh through `getClaims()`.
4. Inspect the response for all renewed cookie chunks and private/no-store `Cache-Control`, `Pragma: no-cache`, and `Expires: 0`. Server rendering should see the renewed request cookies immediately. Navigate again: the refreshed session should persist without another expiry-driven refresh or random sign-out. Restore JavaScript if disabled.
5. Repeat with a multi-chunk cookie and through an actual authorized redirect once implemented. Verify no chunk/deletion or cache header is lost; redirects must use `preserveSessionResponse`. Do not add a fake login redirect to the public shell for testing.
6. Test an invalid/expired refresh token and an Auth network failure separately. The public shell may remain anonymous; future protected routes must deny or route to a real login page without exposing data. A network failure must not be reported as a permission failure or successful sign-in.
7. Use two isolated browser profiles to check session isolation and no caching across users. Revoke membership/assignment and verify backend plus RLS denial even with an unexpired JWT. Isolated database/API checks cover these denial paths; hosted/browser acceptance remains pending.

Offline checks: `npm run check`. Production build: `npm run build`. Production HTTP smoke: `npm run start --workspace @candidate/web`. None starts Docker.

References: [official SSR clients/proxy guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [SSR caching and cookies](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [hosted migration workflow](https://supabase.com/docs/guides/deployment/managing-environments).
