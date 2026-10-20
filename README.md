# Candidate Platform

Role dashboards are available at `/workspace` and `/dashboard`. See the [operational workspace and metric definitions](docs/OPERATIONS.md) and the [full acceptance matrix](docs/ACCEPTANCE.md) for verified behavior and remaining release prerequisites. Hosted setup remains Docker-free; isolated CI handles database/RLS checks.

An npm workspace for the candidate management web application, Chrome extension, shared contracts, and document engine. The web app uses hosted Supabase with SSR sessions, organization/team/assignment authorization, safe bidder projections, account administration and a versioned candidate profile editor. The extension provides authenticated Resume and Profile tabs with exact prompts, shared JSON validation/rendering, durable account-scoped drafts and independent export/synchronization results. Resume/template/letter production and bid/interview operations are implemented; hosted/manual acceptance remains explicit.

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
| `npm run history:fixture -- --organization-id <synthetic UUID> --candidate-id <synthetic UUID>` | Create a new ignored synthetic archive root with two hashed packages for manual Quick Check tests; no API or existing-file overwrite. |
| `npm run admin:bootstrap -- --organization-id <new UUID> --admin-user-id <confirmed Auth UUID> --name "Synthetic Development"` | Audited new-organization bootstrap; operator-only key in the ignored server environment. See FOUNDATION.md before running. |
| `npm run test:foundation:http` | Isolated CI-only production build/Auth/API and web/unpacked-MV3 Chromium harness; refuses hosted settings and a configured `.env.local`. Requires the CI local Supabase stack and installed Playwright Chromium. |
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
npm run dev
```

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`.
2. Set `EXTENSION_ALLOWED_ORIGIN=chrome-extension://<actual-id>` in the web app's ignored `.env.local` and restart the web server. The development identity probe can remain disabled.
3. Click the extension action, sign in to an existing synthetic account, and select the organization/candidate. Profile shows the authorized summary/configuration; Resume provides job input, exact Copy Prompt, JSON validation/factual review, PDF preview/export and letter saving.
4. After rebuilding, reload the extension on `chrome://extensions`, then reload its workspace. Expect sign-in again; local drafts and frozen operations remain partitioned by account/organization/candidate.

Read [the extension build/configuration, recovery and Chrome testing runbook](docs/EXTENSION_WORKFLOW.md). It documents public-only build overrides, hosted migrations/accounts/signing prerequisites, directory permission renewal, export-only bidder scope and original-operation reconciliation. Quick Application Check adds user-triggered activeTab/scripting/contextMenus permissions to the existing storage, clipboardWrite, downloads and configured API/Supabase hosts. Scripts/worker/fonts are local; injected capture receives no credentials, and there are no persistent content scripts or external messages. See [Quick Check matching, archive lookup/repair and synthetic fixtures](docs/QUICK_APPLICATION_CHECK.md).

Isolated CI verifies the actual unpacked extension against real Supabase Auth/RLS and the shared production API, including native download SHA equality, closure/restart, account isolation and revocation. Hosted-account testing, interactive Windows directory/worker lifecycle and two-device acceptance remain manual. The existing email/password flow is retained; PKCE and store publication remain separate gates. Quick Check routes the shortcut/selection menu through reviewed capture and independent database/local history results. [FEASIBILITY.md](docs/FEASIBILITY.md) preserves the earlier Phase 0 evidence.

[Bid package saving and recovery](docs/ARCHIVE_PACKAGES.md) adds frozen original JSON/PDF/letter packages beneath an authorized root, verified hashes, immutable database receipts, strong duplicate serialization and independent local/database/reconciliation/clipboard results. Reopen or retry the original operation after interruptions. Saving a package never submits an application.

## Optional local database

The default development workflow uses hosted Supabase and skips these commands. For optional local Supabase testing only, install and start Docker Desktop (or another compatible engine), then:

```sh
npm run db:start
npm run db:test
```

The Supabase CLI is pinned as a root development dependency. Local defaults in `supabase/config.toml` use API port 54321, PostgreSQL 54322, Studio 54323 and test mail 54324. Keep these development services local. Local signup, analytics, storage and edge-function settings do not configure the hosted project. Hosted CLI migrations need separate CLI authentication and database credentials as documented in [HOSTED_SUPABASE.md](docs/HOSTED_SUPABASE.md). Do not paste secrets into tracked files, logs or client bundles.

Versioned migrations now establish the Section 4–8 foundation, protected commands and forced RLS. Transaction-local synthetic fixtures exercise all four roles, multiple teams and two organizations; the seed remains empty. GitHub Actions runs migrations/tests on an isolated Supabase instance without hosted credentials. See [foundation setup, bootstrap, account flows, API and manual acceptance](docs/FOUNDATION.md). New schema changes require migrations and allow/deny tests; use `db:reset` only for intentional local reset.

Candidate management adds `/candidates`, a searchable scoped directory and six-tab profile workspace with real persistence, ordered records, immutable revisions, explicit conflict recovery and archive/restore. Ready requires name, email, location and phone, following the user's C01 decision. See [candidate setup, APIs, limits and acceptance](docs/CANDIDATES.md). Apply the reviewed pending migrations to hosted development before using these pages; local Docker startup remains optional. [Bid and interview operations](docs/BID_INTERVIEW_WORKFLOW.md) add independent opportunities, exact-version approvals, explicit submission events, bid-specific rounds, feedback revisions and follow-up queues.

Resume Studio now includes canonical-v1 validation, scoped exact prompts, factual review, nine immutable template presets and customization, same-byte PDF.js preview/export, source history, cover letters and authorized frozen document history. See [workflow, APIs, signing-key registration and exact retrieval prerequisites](docs/RESUME_WORKFLOW.md). `npm run resume:verify` checks synthetic multipage layouts and all presets. Optional `npm run documents:configure` registers an operator-supplied server signing key for attested exact-PDF storage; it is unnecessary for source saving/local export. No hosted schema or signing-key change was performed by these tasks.

## Pilot deployment

Pilot preparation uses a separate production Supabase project and a proposed Render Node service. It is **not ready for real candidate onboarding** until the remaining acceptance gates and owner decisions pass. Read the [deployment commands and Auth/environment setup](docs/PILOT_DEPLOYMENT.md), [tagged extension installation/reload](docs/RELEASING.md), [encrypted backup/restore and rollback](docs/RECOVERY.md), [provider limits](docs/PROVIDER_LIMITS.md) and [actual deployment results](docs/DEPLOYMENT_RESULTS.md). Production scripts reject development fallback; no paid resource or hosted migration has been provisioned by this preparation.

## Workspace layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router, React, TypeScript, Tailwind, account pages and user-context `/api/v1` foundation. |
| `apps/extension` | TypeScript MV3 event worker and React workspace; esbuild bundles local artifacts. |
| `packages/contracts` | Unchanged canonical resume v1, precompiled validator, template/document/review/API/error/operation contracts. |
| `packages/domain` | Shared business rules, starting with independent operation progress. |
| `packages/resume-engine` | Measured pdf-lib/fontkit rendering, pinned licensed fonts, nine presets, letter layout and synthetic PDF verification. |
| `packages/ui` | Shared accessible shell components and styles; no server credentials or database imports. |
| `supabase` | Local configuration, migration directory, synthetic seed boundary and pgTAP tests. |
| `docs` | Design transcription, build plan, decisions, progress, and implementation evidence. |

Shared packages emit ESM JavaScript/declarations to ignored `dist/` directories and are consumed through npm workspace links. TypeScript project references determine their build order; no additional monorepo task runner is required. Keep `package-lock.json` committed and use `npm ci` for repeatable installs. Update dependencies deliberately with checks and both builds, rather than mixing unverified latest majors. Node 24, Next 16, React 19, Tailwind 4, ESLint 10 and TypeScript 5.9 were selected from stable releases. ESLint uses the TypeScript recommended rules and Next's own recommended/Core Web Vitals plugin rules directly, avoiding older React/import plugins whose peers require unsupported ESLint 9. TypeScript stays below the parser's supported `<6.1` boundary. npm rejects peer conflicts through `strict-peer-deps`.

The pinned esbuild install script is approved in `package.json` through npm 11's `allowScripts`; review new install-script requests when updating dependencies. On 17 October 2026, `npm audit --omit=dev` reported zero vulnerabilities. The full audit reported four high findings along one development-only chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), from the [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No patched braces release was available at verification. Track the upstream fix; do not force the suggested downgrade to the Next 14 lint plugin into this Next 16 scaffold.

Start new work by reading [AGENTS.md](AGENTS.md), [DESIGN.md](docs/DESIGN.md), [BUILD_PLAN.md](docs/BUILD_PLAN.md), and [PROGRESS.md](docs/PROGRESS.md). [Decision 0001](docs/decisions/0001-workspace-scaffold.md) records scaffold scope and pending policies. Follow the [official Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Supabase local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started), and [Chrome extension service-worker guide](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) when updating the corresponding tooling.
