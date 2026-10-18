# Candidate Platform

An npm workspace for the candidate management web application, Chrome extension, shared contracts, and document engine. The web app uses hosted Supabase with SSR sessions, organization/team/assignment authorization, safe bidder projections and account administration. The extension includes Phase 0 probes for existing-account sign-in, directory handles and synthetic PDF preview/export. Complete profile editing, document workflows and submission remain later tasks.

## Local setup

Install **Node.js 24 LTS** and **npm 11**. The verified runtime is recorded in `.nvmrc` and `package.json`. On Windows use the official Node installer, or a version manager that honors `.nvmrc`. Restart your terminal after installation. Run commands from the repository root.

```sh
node --version
npm --version
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The shared packages compile first and rebuild in watch mode alongside Next.js. Stop both processes with Ctrl+C. Hosted development needs no Docker or local database startup. If PowerShell blocks `npm.ps1`, use `npm.cmd` for the same commands; no execution-policy change is needed.

Before serving the web app, configure `apps/web/.env.local`. It has already been created for the supplied hosted development project in this working copy. On a fresh clone, copy `apps/web/.env.example` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the development project's Connect dialog. Preserve an existing local file rather than overwriting it. The examples contain placeholders; real values remain ignored. Restart Next after changing environment settings. Builds and offline tests do not require hosted credentials, but the session-refresh proxy requires the two public settings at request time.

The root `.env.example` is a reference; Next reads the web application's file. The service-role slot is optional and server-only: Auth invitations and operator bootstrap use it; ordinary reads and commands always retain the authenticated user context. Never prefix a secret with `NEXT_PUBLIC_`. Use only synthetic data. See [hosted Supabase setup, migrations, diagnostics, and manual refresh testing](docs/HOSTED_SUPABASE.md) and the [cookie-design exception](docs/decisions/0002-hosted-supabase-ssr.md).

If using the task-local portable runtime instead of an installed Node, add its directory to PATH for the terminal session before running npm. `.tools/` is ignored and is not part of the repository setup contract.

## Root commands

| Command | Behavior and requirements |
| --- | --- |
| `npm run dev` | Compile shared packages, then watch them and serve the web app at port 3000. Reads the hosted public settings in `apps/web/.env.local`; no Docker. |
| `npm run check` | ESLint with zero warnings, shared/application type checks, domain/SSR/extension/Auth/IndexedDB/PDF tests. Generates Next.js types and package output on a fresh clone. No Docker or hosted credentials needed. |
| `npm run build` | Compile all four shared packages, build the Next.js production app and bundled MV3 extension. |
| `npm run db:start` | Start the local Supabase stack. Requires a running Docker-compatible engine; first run downloads images. |
| `npm run db:test` | Execute rollback-only pgTAP tests against the running local stack. Does not start Docker or apply a reset. |
| `npm run db:check:hosted` | Read-only hosted Auth connectivity probe; separately attempt an authenticated existing-table query only when the documented synthetic-user token/table prerequisites are provided. Nonzero if incomplete or failed; no Docker. |
| `npm run extension:build` | Compile shared packages and rebuild `apps/extension/dist/`. No web build required. |
| `npm run feasibility:pdf` | Generate the two-page synthetic sample, parse/render it with PDF.js, verify text/bounds/repeated hash, and write `output/pdf/phase0-synthetic-resume.pdf` plus ignored page PNGs. Uses the native canvas development dependency. |
| `npm run admin:bootstrap -- --organization-id <new UUID> --admin-user-id <confirmed Auth UUID> --name "Synthetic Development"` | Audited new-organization bootstrap; operator-only key in the ignored server environment. See FOUNDATION.md before running. |
| `npm run test:foundation:http` | Isolated CI-only production build/Auth/API harness; refuses hosted settings and a configured `.env.local`. Requires the CI local Supabase stack. |
| `npm run db:stop` | Stop this project's local Supabase services, preserving local data. |
| `npm run db:reset` | Reset the **local** database, reapply migrations and seeds. Destructive to local development data; use intentionally. |
| `npm run lint` / `npm run typecheck` / `npm test` | Run a single check. Type checking builds package declarations; tests use Node's built-in TypeScript test runner. |

For a production-shell smoke check after building:

```sh
npm run start --workspace @candidate/web
```

No deployment is configured by this scaffold.

## Chrome extension

```sh
npm run extension:build
```

1. Open `chrome://extensions` in desktop Chrome and enable Developer mode.
2. Choose **Load unpacked** and select `apps/extension/dist`.
3. Click the extension action to open its full workspace page. The Resume view contains the directory and synthetic PDF probes; Profile remains a placeholder with no candidate data.
4. After source changes, rebuild and reload the extension on `chrome://extensions`, then reload its workspace tab.

For source watching, run `npm run dev --workspace @candidate/extension` after `npm run build:packages`. Shared-package edits also need the root dev watcher or a new `build:packages` run. Restart the watcher for HTML/manifest/config/font/worker-asset edits. Builds bundle scripts, PDF.js worker and licensed fonts locally. The extension requests `storage` plus only configured Supabase/API hosts; it requests no history/capture/identity/downloads permission. Directory picking uses the user-authorized browser API. The `chrome120` syntax target is not a completed browser-support gate.

The build reads the two public hosted settings from `apps/web/.env.local`. Optional `EXTENSION_PUBLIC_*` overrides can be set in ignored `apps/extension/.env.local` or the shell; `.env.example` remains placeholders. Only an explicit public configuration allowlist enters the bundle. Never add tokens or privileged keys. For the identity-only API check, set the web app's server-only `FEASIBILITY_API_ENABLED=true` and `EXTENSION_ALLOWED_ORIGIN` to the actual origin shown in the extension, then restart the web dev server. Production always disables this endpoint.

Read [FEASIBILITY.md](docs/FEASIBILITY.md) for results, the synthetic sample, exact Chrome/manual test instructions and unsupported behavior. Automated checks do not establish live sign-in, actual directory-handle persistence, or MV3 PDF.js/CSP support. The user selected existing email/password Auth; the proposed PKCE gate remains unverified.

## Optional local database

The default development workflow uses hosted Supabase and skips these commands. For optional local Supabase testing only, install and start Docker Desktop (or another compatible engine), then:

```sh
npm run db:start
npm run db:test
```

The Supabase CLI is pinned as a root development dependency. Local defaults in `supabase/config.toml` use API port 54321, PostgreSQL 54322, Studio 54323 and test mail 54324. Keep these development services local. Local signup, analytics, storage and edge-function settings do not configure the hosted project. Hosted CLI migrations need separate CLI authentication and database credentials as documented in [HOSTED_SUPABASE.md](docs/HOSTED_SUPABASE.md). Do not paste secrets into tracked files, logs or client bundles.

Versioned migrations now establish the Section 4–8 foundation, protected commands and forced RLS. Transaction-local synthetic fixtures exercise all four roles, multiple teams and two organizations; the seed remains empty. GitHub Actions runs migrations/tests on an isolated Supabase instance without hosted credentials. See [foundation setup, bootstrap, account flows, API and manual acceptance](docs/FOUNDATION.md). New schema changes require migrations and allow/deny tests; use `db:reset` only for intentional local reset.

## Workspace layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router, React, TypeScript, Tailwind, account pages and user-context `/api/v1` foundation. |
| `apps/extension` | TypeScript MV3 event worker and React workspace; esbuild bundles local artifacts. |
| `packages/contracts` | Unchanged canonical resume v1, foundation roles/context/commands, API/error/operation types. Canonical validator remains pending. |
| `packages/domain` | Shared business rules, starting with independent operation progress. |
| `packages/resume-engine` | Typed rendering boundary plus a fixed synthetic pdf-lib/fontkit feasibility renderer. Production validators/templates are pending. |
| `packages/ui` | Shared accessible shell components and styles; no server credentials or database imports. |
| `supabase` | Local configuration, migration directory, synthetic seed boundary and pgTAP tests. |
| `docs` | Design transcription, build plan, decisions, progress, and implementation evidence. |

Shared packages emit ESM JavaScript/declarations to ignored `dist/` directories and are consumed through npm workspace links. TypeScript project references determine their build order; no additional monorepo task runner is required. Keep `package-lock.json` committed and use `npm ci` for repeatable installs. Update dependencies deliberately with checks and both builds, rather than mixing unverified latest majors. Node 24, Next 16, React 19, Tailwind 4, ESLint 10 and TypeScript 5.9 were selected from stable releases. ESLint uses the TypeScript recommended rules and Next's own recommended/Core Web Vitals plugin rules directly, avoiding older React/import plugins whose peers require unsupported ESLint 9. TypeScript stays below the parser's supported `<6.1` boundary. npm rejects peer conflicts through `strict-peer-deps`.

The pinned esbuild install script is approved in `package.json` through npm 11's `allowScripts`; review new install-script requests when updating dependencies. On 17 October 2026, `npm audit --omit=dev` reported zero vulnerabilities. The full audit reported four high findings along one development-only chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), from the [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No patched braces release was available at verification. Track the upstream fix; do not force the suggested downgrade to the Next 14 lint plugin into this Next 16 scaffold.

Start new work by reading [AGENTS.md](AGENTS.md), [DESIGN.md](docs/DESIGN.md), [BUILD_PLAN.md](docs/BUILD_PLAN.md), and [PROGRESS.md](docs/PROGRESS.md). [Decision 0001](docs/decisions/0001-workspace-scaffold.md) records scaffold scope and pending policies. Follow the [official Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Supabase local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started), and [Chrome extension service-worker guide](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) when updating the corresponding tooling.
