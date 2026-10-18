# Candidate Platform

An npm workspace for the candidate management web application, Chrome extension, shared contracts, and document engine. The web shell uses hosted Supabase development with SSR session-refresh plumbing. Sign-in UI, candidate records, PDF rendering, saving, submission, and application authorization are later build-plan tasks.

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

The root `.env.example` is a reference; Next reads the web application's file. The service-role slot remains blank and is not used by these clients. Never prefix a secret with `NEXT_PUBLIC_`. Use only synthetic data. See [hosted Supabase setup, migrations, diagnostics, and manual refresh testing](docs/HOSTED_SUPABASE.md) and the [cookie-design exception](docs/decisions/0002-hosted-supabase-ssr.md).

If using the task-local portable runtime instead of an installed Node, add its directory to PATH for the terminal session before running npm. `.tools/` is ignored and is not part of the repository setup contract.

## Root commands

| Command | Behavior and requirements |
| --- | --- |
| `npm run dev` | Compile shared packages, then watch them and serve the web app at port 3000. Reads the hosted public settings in `apps/web/.env.local`; no Docker. |
| `npm run check` | ESLint with zero warnings, shared-package/application type checks, operation-state tests and synthetic SSR cookie/cache tests. Generates Next.js types before checking a fresh clone. No Docker or hosted credentials needed. |
| `npm run build` | Compile all four shared packages, build the Next.js production app and bundled MV3 extension. |
| `npm run db:start` | Start the local Supabase stack. Requires a running Docker-compatible engine; first run downloads images. |
| `npm run db:test` | Execute rollback-only pgTAP tests against the running local stack. Does not start Docker or apply a reset. |
| `npm run db:check:hosted` | Read-only hosted Auth connectivity probe; separately attempt an authenticated existing-table query only when the documented synthetic-user token/table prerequisites are provided. Nonzero if incomplete or failed; no Docker. |
| `npm run extension:build` | Compile shared packages and rebuild `apps/extension/dist/`. No web build required. |
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
3. Click the extension action to open its full workspace page; switch between Resume and Profile.
4. After source changes, rebuild and reload the extension on `chrome://extensions`, then reload its workspace tab.

For source watching, run `npm run dev --workspace @candidate/extension` after `npm run build:packages`. Shared-package edits also need the root dev watcher or a new `build:packages` run. HTML/manifest edits require restarting the extension watcher. Builds bundle scripts locally and do not use a development server or remote executable code. The shell requests no host, filesystem, history, or capture permissions. The `chrome120` output target is a conservative syntax target, not a completed browser-compatibility gate.

`apps/extension/.env.example` reserves future **public** API configuration. The current shell makes no API requests and does not load this file or inject arbitrary environment variables. Do not add tokens or privileged keys to extension configuration. Authentication, exact-origin permissions and capture are separate tasks.

## Optional local database

The default development workflow uses hosted Supabase and skips these commands. For optional local Supabase testing only, install and start Docker Desktop (or another compatible engine), then:

```sh
npm run db:start
npm run db:test
```

The Supabase CLI is pinned as a root development dependency. Local defaults in `supabase/config.toml` use API port 54321, PostgreSQL 54322, Studio 54323 and test mail 54324. Keep these development services local. Local signup, analytics, storage and edge-function settings do not configure the hosted project. Hosted CLI migrations need separate CLI authentication and database credentials as documented in [HOSTED_SUPABASE.md](docs/HOSTED_SUPABASE.md). Do not paste secrets into tracked files, logs or client bundles.

There are no application migrations or candidate seeds yet. `supabase/migrations/` is the required home for timestamped SQL changes, including permissions and policies. `supabase/tests/000_infrastructure.test.sql` checks the local Auth schema/role inside a transaction and rolls back; it does **not** establish or test application RLS. Later tables require backend permission checks, RLS/grants, and positive/negative database tests. New migrations can be created with `npx supabase migration new <name>`; run `db:reset` intentionally to verify from empty local state.

## Workspace layout

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js App Router, React, TypeScript and Tailwind; future `/api/v1` backend. |
| `apps/extension` | TypeScript MV3 event worker and React workspace; esbuild bundles local artifacts. |
| `packages/contracts` | Unchanged canonical resume v1 schema, starter API/error/operation types. No validator yet. |
| `packages/domain` | Shared business rules, starting with independent operation progress. |
| `packages/resume-engine` | Typed document-rendering boundary. PDF renderer and templates are not implemented. |
| `packages/ui` | Shared accessible shell components and styles; no server credentials or database imports. |
| `supabase` | Local configuration, migration directory, synthetic seed boundary and pgTAP tests. |
| `docs` | Design transcription, build plan, decisions, progress, and implementation evidence. |

Shared packages emit ESM JavaScript/declarations to ignored `dist/` directories and are consumed through npm workspace links. TypeScript project references determine their build order; no additional monorepo task runner is required. Keep `package-lock.json` committed and use `npm ci` for repeatable installs. Update dependencies deliberately with checks and both builds, rather than mixing unverified latest majors. Node 24, Next 16, React 19, Tailwind 4, ESLint 10 and TypeScript 5.9 were selected from stable releases. ESLint uses the TypeScript recommended rules and Next's own recommended/Core Web Vitals plugin rules directly, avoiding older React/import plugins whose peers require unsupported ESLint 9. TypeScript stays below the parser's supported `<6.1` boundary. npm rejects peer conflicts through `strict-peer-deps`.

The pinned esbuild install script is approved in `package.json` through npm 11's `allowScripts`; review new install-script requests when updating dependencies. On 17 October 2026, `npm audit --omit=dev` reported zero vulnerabilities. The full audit reported four high findings along one development-only chain (`@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`), from the [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No patched braces release was available at verification. Track the upstream fix; do not force the suggested downgrade to the Next 14 lint plugin into this Next 16 scaffold.

Start new work by reading [AGENTS.md](AGENTS.md), [DESIGN.md](docs/DESIGN.md), [BUILD_PLAN.md](docs/BUILD_PLAN.md), and [PROGRESS.md](docs/PROGRESS.md). [Decision 0001](docs/decisions/0001-workspace-scaffold.md) records scaffold scope and pending policies. Follow the [official Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation), [Tailwind Next.js setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs), [Supabase local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started), and [Chrome extension service-worker guide](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics) when updating the corresponding tooling.
