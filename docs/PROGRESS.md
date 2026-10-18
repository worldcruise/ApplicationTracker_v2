# Implementation progress

Last updated: 17 October 2026, America/New_York.

Repository status: T001, T002, and the explicitly requested H001 hosted Supabase SSR foundation are complete. T003–T063 remain pending. The web shell now uses hosted development without Docker; sign-in UI, application schema/authorization, resume validation, and browser feasibility gates are not complete.

## Completed work

| Task | Result | Evidence |
| --- | --- | --- |
| CTX01 | Read PRD and Word design; created [DESIGN.md](DESIGN.md) as a faithful Markdown transcription. | Retained all 25 numbered sections, source paragraphs, 21 tables, four fenced code blocks including two JSON contracts, and the original architecture image in `docs/assets/architecture.png`. Word pagination and its repeating page-number footer are omitted. Source files remain in `doc/` unchanged. |
| CTX02 | Created [BUILD_PLAN.md](BUILD_PLAN.md) and [root AGENTS.md](../AGENTS.md). | Plan defines 63 pending tasks with dependencies, design sections and acceptance criteria; maps all 20 base and 15 archive acceptance criteria; rules preserve permissions, history, independent operation states and scoped execution. |
| CTX03 | Reviewed contradictions, coverage gaps and open decisions; verified the documentation handoff. | C01 records required versus optional phone; G01–G10 distinguish ambiguities/refinements/coverage gaps; D01–D11 retain policy, feasibility and operational gates. Verification details below. |
| T001 | Recorded scaffold authorization and explicit pending dispositions for the conflict, coverage gaps, and decision owners. | [Decision 0001](decisions/0001-workspace-scaffold.md) preserves all affected gates and owner roles without inventing product approvals. |
| T002 | Created the npm monorepo, minimal web/MV3 shells, four shared packages, Supabase configuration/test boundary, environment examples, and local setup instructions. | Exact stable dependencies and npm lockfile; root checks and production builds pass; development/production HTTP and extension artifact smoke checks pass. See scaffold verification and limitations below. |
| H001 | Added hosted Supabase browser/request-scoped server clients, Next 16 proxy refresh, uncached session responses, and separate connectivity diagnostics. Configured ignored app-local public settings without changing example placeholders or remote schema. | Root check passes five tests; production web/extension builds pass and identify the proxy; hosted Auth accepts the public key; served shell/API-404 cache headers and static matcher exclusion pass. [Hosted workflow/manual test plan](HOSTED_SUPABASE.md) and [decision 0002](decisions/0002-hosted-supabase-ssr.md) record prerequisites and the cookie-design conflict. |

## Current work

No implementation task is active. H001's requested configuration work is complete with the verification limits below; T003 remains the next planned task when requested. Authentication UI, application schema, membership/permission enforcement features, and later task acceptance gates remain pending.

## Blockers and dependencies

- Node/npm were absent from the initial PATH. Verified with an official portable Node 24.22.0/npm 11.19.1 runtime under ignored `.tools/`; no system runtime installation was changed. Docker/Podman is absent; hosted development now needs neither, while optional local pgTAP tests remain unavailable.
- Hosted Auth connectivity succeeds. No test-user session/token, approved existing application table, CLI access token, or database password was supplied. No application SQL migrations exist locally; hosted table existence is unverified. Authenticated database access, real browser token rotation, hosted migrations and application authorization cannot be claimed as verified. No remote Auth/schema/RLS/account change was performed.
- No browser is exposed by the available browser tooling. Interactive web/extension checks and loading the unpacked extension remain unverified; HTTP and built-artifact checks are recorded separately below.
- One development-only braces advisory produces four high audit findings through Next's lint plugin. No patched braces release was available; track the upstream fix. Runtime dependency audit reports zero vulnerabilities. See the dated verification and README.
- C01 requires product confirmation before freezing candidate completeness rules: PRD §7.1 both lists phone as required and cautions against assuming every candidate has one; design §1 makes it optional. Draft/Ready validation is a proposed design interpretation, not recorded product approval.
- G01 requires an explicit missing-structure versus empty-content validation disposition. Other coverage gaps must remain visible when writing contracts/migrations; design summary tables do not remove PRD fields.
- D01–D11 are pending at their affected gates, not global blockers for all development. Browser authentication and directory support require measured proof of concept; neither has been tested here.
- Production onboarding depends on accepted retention, access, hosting, backup and recovery decisions and complete release evidence. No providers or service accounts have been configured.

## Decisions recorded

| ID | Date | Decision or status | Basis |
| --- | --- | --- | --- |
| CTX-D01 | 2026-10-17 | Keep original input files in `doc/`; put new implementation context in requested `docs/` and instructions at the root. | Actual repository paths; no source move or duplicate PRD needed. |
| CTX-D02 | 2026-10-17 | Preserve source requirements, proposed defaults, and open decisions verbatim in DESIGN.md; record comparison findings separately. | Faithful transcription and explicit conflict reporting requested. This does not approve product defaults. |
| CTX-D03 | 2026-10-17 | Copy the embedded architecture figure unchanged as a Markdown asset. | Retains the design's trust-boundary diagram alongside all tables and contracts. |
| CTX-D04 | 2026-10-17 | Retain documented architecture and canonical resume v1 as the implementation baseline. | User project rules. Schema metadata remains outside the original content object; no new required content fields are introduced here. |
| T002-D01 | 2026-10-17 | Use npm workspaces with Node 24/npm 11, Next 16/React 19, Tailwind 4, TypeScript 5.9, ESLint 10, and esbuild for MV3. | User-selected structure; exact stable package versions and compatible peers are locked. TypeScript remains within the parser's supported range; Next lint rules use its plugin directly. |
| T002-D02 | 2026-10-17 | Copy canonical schema v1 unchanged and expose starter API/error/state and renderer boundaries only. | T003–T005 own complete contracts/validation; T008 owns rendering feasibility. No business routes, candidate tables, permissions, document generation, or submission behavior is claimed. |
| T002-D03 | 2026-10-17 | Keep project instructions in root AGENTS.md; disable Next's automatic managed-agent-file generation. | The development smoke check demonstrated that default Next behavior creates `apps/web/AGENTS.md`; `agentRules: false` removes that generated-only file and keeps development from changing instruction files. |
| H001-D01 | 2026-10-17 | Use hosted development with Supabase SSR 0.12.7/JS 2.118.0 and actual `src/proxy.ts` on installed Next 16.4.2. | Explicit user request and current official SSR guidance; compatible package peers/Node versions, pinned lockfile, request-scoped server clients, and no privileged credentials. Docker remains optional. |
| H001-C01 | 2026-10-17 | Record the design §4 HttpOnly conflict and follow the specifically requested browser/server SSR pattern with JavaScript-readable Supabase session cookies. | [Decision 0002](decisions/0002-hosted-supabase-ssr.md). SameSite=Lax/Secure production transport is explicit; strict HttpOnly-only transport needs a separately scoped architecture decision. Membership checks and CSRF requirements are not waived. |
| C01 / D01–D11 | Pending | Product/policy and feasibility decisions remain unresolved; recommended defaults have not been accepted on an owner's behalf. | See [comparison and decision register](BUILD_PLAN.md#requirements-comparison-and-decision-register), including owner roles and affected gates. |

Relative paths and collision-safe folder suffixes are compatible refinements: the PRD explicitly allows relative path copying and labels its folder layout recommended. They are not recorded as contradictions. Interviews separating lifecycle from outcome, and bidder export being distinct from generation, also preserve the stated requirements.

## Verification

### H001 hosted SSR verification — 17 October 2026

Passed:

- Inspected installed Next 16.4.2, Node 24.22.0, React 19.3.1, source layout/aliases, existing shell, rules, design/PRD Auth boundaries, and absence of existing Supabase integration. Added one explicitly scoped H001 preparation task without marking future foundation/auth tasks complete.
- Consulted the [official SSR client/proxy guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client), advanced cookie/cache guidance, current npm package metadata and pinned CLI help. Installed exact web-workspace dependencies and updated `package-lock.json`; SSR's JS ^2.114.0 peer and JS's Node >=22 requirement are satisfied.
- `npm run check`: zero lint warnings, shared/web/extension type checks, two domain tests and three web tests. Real Supabase SDK tests with synthetic mocked Auth exercise near-expiry refresh with multiple cookie chunks, immediate forwarded request/response synchronization, persistence without repeat refresh, redirect cookie attributes/deletions/cache headers, and preserving user Authorization while overriding fetch caching. These are offline tests, not real hosted-user authentication.
- `npm run build`: all shared packages, Next web and MV3 extension pass. Next reports dynamic `/` and `Proxy (Middleware)`, proving the installed version discovers `src/proxy.ts`. Build ran outside this environment's filesystem sandbox for the existing extension bundler restriction.
- Production HTTP smoke: `/` returns 200 with the expected public shell; `/api/v1/not-implemented` returns 404, exposing no invented API route. Both carry private/no-store, `Pragma: no-cache`, and `Expires: 0`. A real `/_next/static` asset returns success without the proxy cache headers, validating the matcher exclusion. Test server stopped afterward.
- `npm run db:check:hosted`: after retrying outside the network sandbox (initial `EACCES`), hosted Auth settings accepted the configured publishable key (`SERVICE_OK`). The separate authenticated query correctly did not run: `MISSING_AUTHENTICATION` and `MISSING_TABLE_CONFIGURATION`; script exit 2 is reported by npm as a nonzero lifecycle failure. No test table was created or RLS relaxed.
- `npm audit --omit=dev`: zero vulnerabilities after adding Supabase dependencies. Earlier development-only braces follow-up remains recorded below.
- `.env.local` is ignored by Git; only the supplied public URL/key were set, preserving unrelated content. Example files remain placeholders. No service-role/secret key is imported into source or clients. Source PRD/design and schema v1 remain unchanged. JSON/whitespace, dependency graph, local documentation links, and diff review pass.

Not run / remaining prerequisites:

- No browser is exposed (empty browser inventory), and no approved synthetic account session/sign-in flow is available. Real hosted browser refresh, invalid-refresh/network interaction, and actual protected redirects remain manual checks in [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md#manual-session-refresh-test-plan). Current shell has no sign-in/callback route or protected data.
- No authorized test table/token was provided; local migration folder contains no application SQL. Remote table absence is not assumed. Membership/resource allow/deny tests and authenticated application queries remain blocked on their schema/test-identity prerequisites.
- CLI management authentication, project linking, database credentials, remote baseline reconciliation, migration dry-run/application, and pgTAP execution were not performed. CLI hosted flags were checked with `--help`; the Docker-free workflow is documented. No migration is needed for application client configuration.

### T002 scaffold verification — 17 October 2026

Passed:

- `npm ci --offline --no-audit --no-fund` installed 198 packages from the committed lockfile's dependency graph using a populated local cache. Network downloads were required to populate that cache; large vendor archives were verified against their published integrity hashes. No credentials are required to install/check/build the shells.
- `npm run check`: ESLint with zero warnings, shared-package and both application type checks, and two Node tests. Tests demonstrate local archive success and database synchronization failure remain independent, saving does not imply submission, and operation state is not shared between operations.
- `npm run build`: TypeScript builds all four packages, Next.js creates the production shell, and esbuild bundles the MV3 workspace and service worker. `npm run extension:build` also passes independently. The extension bundler required execution outside this environment's filesystem sandbox after a sandbox directory-access failure; no source change was needed for that failure.
- `npm ls --all --omit=optional`: dependency/peer graph resolves without errors. `package-lock.json` records all six workspace links and exact dependencies; the pinned esbuild installer is explicitly allowed through npm's install-script policy.
- `npm run dev`: shared-package watch reports zero errors and Next serves port 3000. Both development and production (port 3100) returned HTTP 200 with the expected shell heading; all referenced local CSS/JS assets returned success (16 development, seven production). Test servers were stopped after verification.
- Extension output has Manifest V3, no requested host/API permissions, and existing local workspace HTML, CSS, script, and module service-worker references. This checks artifacts, not browser installation or interaction.
- Canonical resume v1 JSON matches the design's schema block exactly. JSON configuration parsing, Git ignore boundaries for local credentials/tooling/build output, and whitespace checks pass; source requirements remain unchanged.
- `npm audit --omit=dev`: zero vulnerabilities. Full `npm audit`: four high findings on the single development-only chain `@next/eslint-plugin-next → fast-glob → micromatch → braces`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) affects braces through 3.0.3; no patched braces version was available. npm's suggested Next 14 plugin downgrade was not applied to the Next 16 scaffold.

Unavailable/limited:

- Supabase CLI `--version` succeeds at 2.121.0. `npm run db:start` exits 1 because neither Docker nor Podman is installed. `npm run db:test` exits 1 with `ECONNREFUSED 127.0.0.1:54322`; no pgTAP assertion executed. The mail section was updated from deprecated `[inbucket]` to `[local_smtp]` using the pinned CLI's generated template.
- Browser inventory is empty, so visual/keyboard inspection, the extension action, view switching, and unpacked-extension loading could not be tested. README documents the manual procedure. Browser auth, filesystem access, PDF rendering, and application RLS are later tasks, not scaffold capabilities.

### Historical context-preparation verification

The following evidence belongs to CTX01–CTX03 before application implementation:

- Compared every nonempty source paragraph against the transcription: all 328 retained, including requirements and open decisions. Confirmed the numbered section sequence is exactly 1–25.
- Compared all 21 tables in order: all 206 header/body rows match the source cells. Confirmed all 63 source code lines are unchanged and in order across four fenced blocks; both JSON examples parse successfully.
- Confirmed the architecture image bytes are unchanged and all 16 local Markdown links/anchors resolve.
- Checked all 63 implementation task IDs and three context IDs: unique, dependencies exist, no self-dependencies or cycles. T036 intentionally precedes document production because bid/grant identity is needed for safe document linkage; later workflow migrations remain with their features.
- Checked acceptance coverage includes every base criterion 1–20 and archive criterion 1–15. This verifies plan coverage, not implemented behavior.
- Checked Markdown for trailing whitespace and final newlines; `git diff --check` reported no tracked-file whitespace errors. Confirmed original tracked sources have no diff and their SHA-256 values match the initial read:

| Source | SHA-256 |
| --- | --- |
| `doc/Candidate_Platform_Design_Document.docx` | `44638F4455441364611C539299950ABA243EE2CBA28656CCE67EF9F24064DBAC` |
| `doc/PRD.md` | `B1D735C450BC4199AF1559518E82189CC7CF030A29BAABBC982D42AD7A188F1D` |

At that handoff, change scope was limited to root AGENTS.md, docs/DESIGN.md, docs/BUILD_PLAN.md, docs/PROGRESS.md, and the source figure asset. No dependency install, source move, database operation, external write, commit, or deployment occurred during context preparation.

Application checks could not run during context preparation because there was no application or package manifest. Current scaffold evidence is recorded above. External technical references and live provider quotas were preserved from the design, not independently reverified in the context-only task; implementation/release tasks explicitly require those checks.

## Next task

**T003 — Define shared identifiers, capabilities, errors, and operation states**, when requested. Expand the starter contracts with request IDs, UUID/camelCase conventions, pagination and independent operation-state contracts/tests. Preserve the proposed status of D11 limits; keep G01 and phone-completeness decisions pending at their feature gates. Do not begin T004 validation or API/business implementation as part of the scaffold.

## Update instructions

After each completed task, add its ID, concrete result and validation evidence to Completed work; identify any active task under Current work; update blockers and dated decisions; and name exactly one next ready task. Record failed or unavailable checks and their reasons. Preserve past evidence and never relabel pending implementation as completed merely because documentation exists.
