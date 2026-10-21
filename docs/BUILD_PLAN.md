# Implementation build plan

Prepared on 17 October 2026. This file plans implementation; no application, migration, service, or proof of concept has been implemented by the context preparation task.

Sources are [PRD version 1.0](../doc/PRD.md) and the [original proposed design version 1.0](../doc/Candidate_Platform_Design_Document.docx), transcribed in [DESIGN.md](DESIGN.md). The repository contains the sources in `doc/`, rather than the `docs/` paths named in the request. The originals remain unchanged. `D§N` below refers to the numbered section in DESIGN.md; `P§N` refers to the PRD. Their section numbers differ.

## Working method

1. Read [PROGRESS.md](PROGRESS.md), select one ready task, and mark it current there. All implementation tasks below start pending.
2. Complete dependencies and resolve only the decisions that affect that task. Record decisions with an owner, date, rationale, affected contracts, and acceptance evidence. Proposed defaults are not evidence of owner approval.
3. Implement the smallest reviewable change, including its migration and backend/database authorization where applicable. Split a task further if it cannot be reviewed as one change; retain its parent ID and dependencies.
4. Run relevant checks, inspect user-visible behavior, and record results or reasons checks could not run. A task is complete only when its acceptance criteria have evidence.
5. Update PROGRESS.md after every completed task, including current work, blockers, decisions, and the next task. Do not start the next task merely because it appears in this plan; the active user request controls scope.

The target structure is `apps/web`, `apps/extension`, `packages/contracts`, `packages/domain`, `packages/resume-engine`, `packages/ui`, `supabase/migrations`, database tests, `docs`, and releases, as specified in D§21. Normal API requests retain user context; protected commands commit business changes, history, and audit events in one database transaction. A filesystem write and database transaction are independently recoverable operations.

## Active stage — localhost-first pilot (21 October 2026)

The user's latest direction prioritizes **local Next.js web + `/api/v1`**, normally `http://localhost:3000`, with the existing hosted development Supabase project **`xsyxlxpsglhkmvzlmhih`** and existing GitHub repository. Docker is optional. Public hosting, custom domains and production provisioning are deferred; the earlier PD01–PD04 work and source tag remain available for a later stage. Production budget/domain/recovery acceptance is not a prerequisite for this synthetic localhost stage. Authorization, RLS, versioned migrations and immutable document history still apply; real-data onboarding remains outside this stage.

| Task | Scope / dependencies | Design | Acceptance |
| --- | --- | --- | --- |
| LC01 (complete — 21 October) | Local development startup/configuration and Auth runbook; reuses H001, FN and completed web workflows. | §2–4, 20–21 | Local root check passes 60 tests; dev/anonymous API/Auth-redirect/no-store smoke passes on 3000 and automatic 3001 fallback. Existing project/public env preserved; IPv4 loopback supports this machine. Exact dashboard/manual five-flow checklist is in LOCAL_PILOT.md. No authenticated hosted persistence claim. |
| LC02 (next) | Reconcile hosted development migration history and activate designated synthetic pilot identities/team assignments. | §4–8, 21 | Authorized operator reviews the existing target/history before applying pending migrations; no reset/RLS weakening/test fixtures. Existing email/password synthetic account obtains current app membership; four roles have observed allowed/denied access. No account password/token goes into Git or chat. |
| LC03 | Execute the five-flow localhost acceptance checklist; depends on LC01–LC02. | §3, 6, 10–13, 18, 22 | Real local-browser sign-in/out/refresh; candidate create/edit/assignment/reload/conflict; canonical-v1 invalid input retained; ATS Classic same-byte preview/download/source history; independent basic Draft bid creation/tracking with no save-to-submit behavior. Distinguish local, hosted and prior CI evidence. |
| LC04 (later) | Local extension authentication/capture/archive acceptance as a separate workflow. | §14–17, 22 | Choose actual development extension identity/origin separately and repeat account/project/restart/directory checks; no web setup dependency on extension credentials/CORS/production identity. Completed extension code is retained. |

All five priority flows already have implementations and isolated CI coverage. Reuse them: nine templates, cover letters, interviews, dashboards and history are retained; ATS Classic is the initial pilot template. Do not restart the scaffold or remove later features. Hosted invite/recovery delivery, active memberships and persistence need current target-specific evidence before marking LC02–LC03 complete.

## Requirements comparison and decision register

### Current requested increment — registration approval (21 October 2026)

The explicit registration request supersedes D10's invite-only restriction for configured public intake; controlled initial Admin bootstrap and trusted invitations remain. See [decision 0003](decisions/0003-registration-approval.md) and [REGISTRATION.md](REGISTRATION.md). No public hosting/production provisioning is introduced.

| Task | Dependencies / design | Acceptance |
| --- | --- | --- |
| RG01 | Existing FN foundation; design §§4–5, 8 | Versioned actual-schema request/configuration, self-only status projection, Admin review RLS, atomic membership/team/decision/audit, confirmed identity, no self/default Admin, stale/concurrent/idempotent review tests. |
| RG02 | RG01; design §§3–5 | Validated registration and confirmation/no-session UI, awaiting/rejected status, current Admin review screen/navigation, existing-user sign-in preserved. |
| RG03 | RG01–RG02; design §§21–22 | Local checks/build, isolated real Auth/email/API/RLS/browser/concurrency checks, exact hosted/first-Admin/manual setup, decisions and progress evidence; distinguish unexecuted hosted checks. |

### Contradiction requiring resolution

| ID | PRD statement | Design statement | Classification and required action | Affected tasks |
| --- | --- | --- | --- | --- |
| C01 | P§7.1 lists Phone under required fields, then says validation must not assume every candidate has a phone number. | D§1 explicitly makes phone optional; D§6 requires name, email, and location for Ready profiles and permits incomplete drafts. | The design contradicts the required-phone list and the PRD is internally inconsistent. **Resolved by the user on 18 October 2026:** Ready requires name, email, location **and phone**; Draft permits unknown facts. Preserve both source statements. | T016–T017, T020; CM01–CM03 implement the explicit disposition with backend, database and UI validation. |
| C02 | P§22.20 expects initial operation within available free-tier limits, subject to quotas. | D§20–21 requires accepted recovery/quotas and moving to a plan that can meet them. | Deployment tradeoff identified 20 October 2026: proposed Supabase Pro plus Render paid Node compute/workspace does not meet a literal free-tier acceptance claim. Owner must approve budget and disposition B20; source requirements remain unchanged and B20 stays unverified. | D07, T059–T062, PD03–PD04. |

The initial source comparison found no other definite mandatory contradiction. C02 records the later deployment proposal's acceptance tradeoff; it is not an approval to rewrite either source. The differences below are ambiguities, compatible refinements, or coverage gaps.

### Clarifications and coverage gaps

| ID | Source comparison | Implementation treatment |
| --- | --- | --- |
| G01 | P§9.2 distinguishes required structure from empty optional content without enumerating every missing-key rule. D§11 requires all six top-level keys and required entry fields, while empty strings/arrays warn and unknown fields are retained but excluded from rendering. | RP01 implements D§11 explicitly: required structure errors; empty content warnings; unknown properties preserved raw and excluded from render. Shared/SQL/HTTP fixtures verify each case. This follows the user's canonical-v1 workflow request and does not change the source schema or silently make candidate Ready validation identical. |
| G02 | P§7.3 specifies preferred bullet count; P§7.6 includes credential name and optional identifier; P§8.2 includes prompt description; P§14.1 includes last contact date and notes. These are not all repeated in D§6–7's principal-field tables. | Treat those tables as summaries, not permission to drop PRD fields. Carry the fields into T016, T021–T023, and T036–T037. Education display order and policy also remain required where specified. |
| G03 | P§15.2 presents interview labels together but requires completion to be distinct from outcome. D§19 separates lifecycle and outcome and retains the supplied labels. | Compatible normalization. T042 must define how Completed, Feedback Pending, and Next Round appear together without conflating round completion and bid outcome. |
| G04 | P§11.3 gives Downloads as initial PDF behavior. P§24.8 prefers authorized directory handles for archive inspection and permits a relative path; P§24.10 explicitly supports relative paths. D§13–16 uses directory handles for packages and Downloads as a fallback. | Compatible workflows, not an absolute-path contradiction. Ordinary export and archive inspection need separate capability checks; a download event cannot prove an arbitrary directory still exists. D02 stays open. |
| G05 | P§24.3 labels its folder tree recommended. D§16 adds company-key hashes, operation UUID suffixes, a manifest, and an advisory index. | Compatible collision and recovery refinement. Preserve candidate/company organization and original names; verify same-day/same-title collisions. Do not describe the PRD example tree as a mandatory literal path. |
| G06 | P§24.4 lists description fingerprints as supporting exact-job evidence but warns against automatic merging. D§15 treats a fingerprint-only match as possible and requires strong identifiers for automatic exact matching. | Conservative compatible interpretation. Document confidence and evidence in T046; fingerprints alone must never merge records or block a different job. |
| G07 | P§24.7 suggests `resume_json` alongside version references. D§7 explicitly forbids mutable JSON copies in both bids and resume versions. | Compatible normalization because the PRD fields are suggested. Keep one immutable source version and references from the bid. |
| G08 | P§14.3 permits configurable approvals and direct submission when disabled. D§1/18 proposes approvals enabled and no self-approval except audited admin override. P§4.5 and D§4 both deny bidder resume generation by default. | Approval defaults and exceptional grants need policy decisions, not silent expansion of role powers. D03–D04 gate their implementation. Archiving a prepared document is distinct from creating one. |
| G09 | P§22 criterion 20 expects operation within available free-tier limits, subject to quotas. D§20–21 says production recovery requirements may require a paid plan and proposes load/recovery targets. | Budget and readiness tension, not an accepted change to P§22.20. Obtain accepted objectives and a compatible provider plan; if free tiers cannot satisfy the release, record the constraint and seek a product decision. Do not quietly revise acceptance criteria. |
| G10 | P§5 explicitly requires landing, sign-in, and recovery pages. D§3 emphasizes the authenticated shell and says public pages expose no data. | T015 retains the public pages. Optional About/Contact pages remain optional. All ten authenticated areas remain in scope. |

### Open policy and feasibility decisions

These entries carry forward every decision in D§24. No named individual owner or approval is supplied by the sources; the roles below are the requested decision owners.

| ID | Decision and proposed starting point | Owner and evidence required | Gate |
| --- | --- | --- | --- |
| D01 | Supported clients: Chrome desktop on Windows for archive pilot; responsive web for ordinary operations. | Product; T006–T008 compatibility results on recorded browser/OS versions. | Before promising archive capability or freezing client support. |
| D02 | Exact absolute path and OS folder opening: begin with labeled relative paths; native helper only if required. | Product and desktop engineering; T007 results and explicit path/opening requirements. | T049–T050 capability presentation; T063 only if the requirement demands it. |
| D03 | Bidder resume generation disabled; permit export/archive of authorized prepared versions. | Admin and product; exact `resume.generate` versus `document.export` scopes and cross-device PDF availability. | T019, T027, T034, T052. |
| D04 | Approvals enabled per team; no self-approval except reasoned, audited admin override. | Operations owner; accepted default, reviewer eligibility, required-letter policy, and direct-submit rules. | T038–T040. |
| D05 | Retention/removal for candidate, document, audit, backup, and exported data. | Data owner; actual periods, preservation rules, purge authority, and offboarding/local-cleanup guidance. | T058 and production onboarding. Ordinary work preserves history. |
| D06 | PDF persistence: local bytes plus server JSON; frozen re-export or private storage for exact cross-device handoff. | Product and operations; repeatable rendering evidence or original-byte retrieval strategy, storage budget. | T027–T031, T034, T052 and exact historical handoff. |
| D07 | Host, quotas, commercial-use terms, backup budget, and proposed recovery objectives. | Engineering and business owner; current provider checks, accepted RPO/RTO and measured restore. | T059–T062 and production deployment. |
| D08 | Company identity and repostings: verified aliases, provider-aware IDs, explicit override for confirmed reposting. | Operations owner; normalization fixtures, override capability and reason requirements. | T046 and T051. |
| D09 | Accuracy review: factual mapping plus human review of unresolved narrative claims. | Product and team leads; publishable-version and reviewer policy, evidence requirements. | T025, T027 and submission readiness. |
| D10 | Invite-only onboarding; initial admin bootstrapped out of band through audited runbook. | Engineering and initial administrator; bootstrap and partial-failure recovery procedure. | T014 and first deployment. |
| D11 | Additional proposed limits: JSON 1 MiB, JD 200 KiB, depth 32, 100 array entries; list cap 100. Pilot: 25 concurrent users, 5,000 candidates, 50,000 bids; p95 scoped reads under 1 second and three-page PDF under 5 seconds on agreed device. | Product and engineering; accept or revise proposed limits and load targets with measured evidence, without changing canonical v1 content. | T003–T005 contract freeze and T062 load gate. |

## Context preparation

| ID | Task | Acceptance criteria | Status |
| --- | --- | --- | --- |
| CTX01 | Read both sources and transcribe the Word design into Markdown. | All source text, 21 tables, code contracts, original figure, requirements, and open decisions retained; sources unchanged. | Complete; see PROGRESS.md for verification. |
| CTX02 | Prepare task dependencies, source comparison, and project instructions. | Tasks have design references and acceptance criteria; contradictions and open decisions are explicit; root AGENTS.md contains all project rules. | Complete. |
| CTX03 | Verify and record the handoff. | Local links, fidelity, code blocks, dependency graph, and change scope checked; completed/current work, blockers, decisions, and next task recorded. | Complete; check results are in PROGRESS.md. |

## Milestone 0 Feasibility and contracts

The first task is a reviewable decision record. Bootstrap exists only to support the approved architecture and proof-of-concept gates; it does not approve unresolved product choices.

Implementation dispositions dated 19 October 2026: the user explicitly chose any authorized profile editor for paraphrase attestation (D09 subset), and explicitly requested frozen `document.export` without content creation/editing (D03 subset). TP02 stores exact, server-attested PDF bytes in a private database relation; pinned-input recovery remains available with hash comparison (D06 mechanism). Production storage budget, retention, backup/recovery, submission approval eligibility and all broader D01–D11 release gates remain open. See [RESUME_WORKFLOW.md](RESUME_WORKFLOW.md) and current evidence in [PROGRESS.md](PROGRESS.md).

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T001 | Record source-conflict dispositions and decision owners. | CTX01–CTX03 | D§1, 24 | C01 and G01–G10 receive explicit dispositions or pending status with affected gates; D01–D11 have owner roles and evidence needs. No source requirement is silently edited. |
| T002 | Bootstrap TypeScript workspace and minimal check commands. | T001 | D§2, 21 | Web/extension/shared package boundaries exist; package manager and runtime versions are recorded with lockfile; lint, typecheck, and a meaningful shared test run from the root. No credentials required for these checks. |
| H001 | Configure hosted-development Supabase SSR without Docker (explicit user-requested preparation for T013). | T002 | D§2, 4–5, 9, 21 | Request-scoped server/browser clients and Next-version-compatible refresh entry point preserve cookies/cache headers; ignored local settings and placeholder examples; service connectivity distinguished from authenticated application access; hosted migration and manual refresh procedures documented. Record the HttpOnly/browser-SSR conflict explicitly. This does not complete T003–T005, T009–T014, or authorization gates. |
| T003 | Define shared identifiers, capabilities, errors, and operation states. | T002 | D§4, 9–10, 17 | Typed request/error envelopes include requestId; UUIDs, camelCase API conventions, pagination, and independent validation/PDF/local/sync/clipboard states are documented and tested. D11 limits are explicitly proposed or accepted. |
| T004 | Publish canonical resume schema v1 and validator fixtures. | T003; G01 disposition | D§11 | Original six-key content shape and dynamic skill categories remain; schema metadata is external. Missing/wrong types fail; empty values and unsupported fields warn as specified; unsafe keys, input limits, and unsupported versions have fixtures; precompiled validator works without eval. |
| T005 | Write OpenAPI v1 contract and typed client generation. | T003–T004 | D§8–10 | Every D§9 route, authentication mode, safe projection, If-Match rule, error, and archive-operation variant is represented; generation/type checks pass. Bidder prepared-version requests and idempotency mismatch responses are explicit. |
| T006 | Prove extension sign-in and API session boundary. | T002–T005 | D§4–5, 14 | PKCE callback, allowlisted redirect, state/code validation, serialized refresh, restart sign-in, and ordinary user RLS context are demonstrated with synthetic identities. Tokens never reach page URLs/content scripts. Record D01 implications. |
| T007 | Prove authorized directory access and truthful fallback. | T002 | D§14, 16–17, 24 | On recorded Chrome/Windows versions, user gesture, picker, persisted handle, restart renewal, and cross-tab access are tested. Record actual relative-path/OS-open capability, denied-access states, and D01/D02 disposition. |
| T008 | Prove typography and PDF preview from shared bytes. | T002, T004 | D§13, 22 | Bundled licensed fonts, Unicode names, long bullets, selectable text, and multipage layout work with pdf-lib and PDF.js; preview/export consume the same bytes. Record feasibility and D06/D11 evidence. |

### Explicit Phase 0 feasibility increments

The user requested the following probes after H001, before the full contract/schema sequence. These are isolated synthetic-data feasibility implementations; they do not waive T006's T003–T005 dependencies, T008's T004 validation gate, or the manual Chrome acceptance evidence. Complete each code increment and record its checks before starting the next. Live gates stay pending until observed.

| ID | Increment | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| F001A | Extension Auth and shared-identity probe. | H001, T002 | D§4–5, 14 | Same hosted project; existing-account email/password sign-in selected by the user; trusted session storage and serialized refresh; authenticated development API identity check without business access; rejection tests; report missing account/browser evidence. Password sign-in does not complete the proposed PKCE/redirect gate in T006. |
| F001B | Full-page directory-handle probe. | F001A code checks | D§14, 16–17 | Picker only on user gesture; handle persisted in IndexedDB; reopen queries permission without prompting; explicit renewal, denied/cancelled/unsupported states; every write rechecks permission; mocks separated from real Chrome evidence. |
| F001C | Synthetic PDF rendering/preview/export probe. | F001B code checks | D§11, 13–14, 22 | Canonical v1 unchanged; bundled licensed fonts; Unicode/wrapping/multipage synthetic sample; PDF.js previews a copy of the exact persisted/exported bytes; hash verification and independent local/export status; no submission/database-write claim; visual/render tests and remaining Chrome gates documented. |
| F001V | Record live Chrome acceptance evidence. | F001A–F001C code checks; available browser and existing synthetic account | D§4–5, 13–14, 24 | Record actual Chrome/Windows versions and observed sign-in/shared UUID, refresh/restart/worker-stop, real directory handle cloning/renewal/cross-tab behavior, PDF.js CSP preview and same-hash exports. Resolve remaining client/provider decisions explicitly; no mocked result substitutes for this gate. |

## Milestone 1 Foundation

### Candidate management increments (18 October 2026 request)

Complete CM01, CM02, then CM03, reusing FN01–FN03. This request brings forward the candidate-specific subset of T005 and completes candidate profile/directory work without claiming the full resume/OpenAPI or later document/bid/interview workflows. C01 is resolved for implementation by the user's explicit choice: Ready requires name, email, location **and phone**; incomplete drafts remain valid. Original source documents remain unchanged.

| ID | Increment | Design / plan | Acceptance |
| --- | --- | --- | --- |
| CM01 | Profile contracts, normalized children, immutable revisions, protected mutations | §§6, 8; T016–T018 | Ordered records, date precision, official/proposed/approved titles, four-field Ready rule, scoped RLS, transactional audit/revisions, optimistic edit/archive/assignment commands. |
| CM02 | User-context candidate APIs and persistence tests | §§3, 6, 8–9; T017–T019 | Search/filter/sort/paging, create/read/edit, assignment/title approval/archive, safe tabs, real reload persistence, conflict and denied-access evidence in isolated CI. |
| CM03 | Candidate directory and six-tab editor | §§3, 6; T020 | URL-preserved directory filters and selection, accessible structured editing/reordering, unsaved/conflict retention, assignments, archive/read-only states, honest later-workflow tabs; checks and progress evidence. |

### Explicit foundation increments (current user request)

The requested foundation brings forward the minimum contracts and scope anchors needed by Sections 4–8. Execute FN01, FN02, then FN03. This does not complete T004/T005, full profile editing (T016–T018), the complete bid/company model (T036), interview workflows, or document-reference retrieval (T027). Their remaining fields and gates are retained.

Foundation scope clarification: one organization role currently determines matching team roles; mixed roles across teams and arbitrary capability overrides remain unimplemented pending an explicit contract. This is a conservative implementation restriction, not a newly accepted permanent requirement. Organization deactivation revokes that organization's scope; global Auth shutdown must not disable unrelated organization memberships implicitly.

| ID | Scoped increment | Dependencies | Design | Acceptance criteria |
| --- | --- | --- | --- | --- |
| FN01 | Tenant/role/assignment/grant migrations and authorization fixtures | H001; foundation subset of T003 | §§4–8; T009–T012/T019 | Active database membership controls scope; non-owner NOLOGIN/NOBYPASSRLS command roles; direct writes denied; bidder projection excludes raw profiles/feedback; synthetic cross-organization/team allow/deny tests. |
| FN02 | User-context API guards and account flows | FN01 | §§4–5, 8–9; T013–T015 | Cookie/bearer clients preserve user context; current server-side resource checks, CSRF and no-store; sign-in/out/recovery; durable invitation, explicit activation/deactivation, last-admin protection; audited bootstrap runbook. |
| FN03 | Isolated database CI and operating evidence | FN01–FN02 | §§5, 8, 20–22 | Fresh Supabase migrations and pgTAP in isolated CI; relevant local checks; report actual run evidence and missing credentials/browser checks; update progress and next task. |

Each database task includes migrations and allow/deny evidence for its new relations. A passing UI check cannot replace direct database checks.

Task IDs are stable references, not execution order. T036 establishes the minimal bid/company/grant schema here because bidder projections and immutable document links need it before resume production. Later bid tasks add workflow tables with their command implementations.

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T009 | Migrate organization, membership, team, and administrative-operation records. | T005 | D§4, 6, 8, 20 | Tenant keys, composite foreign keys, activation and allowed roles are constrained; migrations apply from empty; no passwords in application tables. RLS defaults deny unauthorized access. |
| T010 | Implement private permission helpers and command execution roles. | T009 | D§4–5 | Scope uses current membership; no recursive policy failure or self-escalation. Functions pin search_path and qualify objects; dedicated NOLOGIN/NOBYPASSRLS command role has minimal grants and revoked PUBLIC execute. Direct role and workflow writes are denied. |
| T011 | Add append-only audit storage and redacted projections. | T010 | D§5, 7, 20 | System events identify actor, scope, action, request, and time; clients cannot forge or alter events. Admin/team/personal projections hide unrelated activity and sensitive changed values. |
| T012 | Create synthetic role fixtures and authorization harness. | T009–T011 | D§22 | Multiple organizations, unrelated teams, all four roles, deactivated and reassigned users are represented. API/database allow/deny tests detect cross-tenant and direct-table bypasses; fixtures contain no real candidate data. Extend this suite with each later entity. |
| T013 | Implement web sessions, current-user API, and request guards. | T005, T010–T012; T006 findings | D§4–5, 9, 20 | `/me` resolves current scopes; cookies are Secure/HttpOnly/SameSite, mutations check CSRF; bearer requests retain user context. Stale roles/deactivated memberships lose access; protected responses are no-store. |
| T014 | Implement retryable invitation, role change, and deactivation commands. | T011–T013; D10 | D§9, 20 | Auth identity creation and membership attach reconcile partial failures through one administrative operation. No access before activation; deactivation blocks database access before session revocation. Initial-admin runbook is audited. |
| T015 | Build public pages and authenticated navigation shell. | T013 | D§1, 3; P§5 | Landing, sign-in, recovery, and all ten permission-filtered destinations exist; public pages expose no operational data. Keyboard focus, error summaries, loading/empty/denied states, and URL filter persistence work. |
| T016 | Migrate candidate profiles, children, revisions, and assignments. | T010–T012; C01 disposition for completeness rules | D§6, 8 | Include PRD fields in G02, accurate title policies, date precision, optional facts, and ordered children. Composite tenant/parent constraints and scoped RLS cover every relation; revisions and assignment history cannot be rewritten. |
| T017 | Implement transactional candidate editing and scoped queries. | T005, T016 | D§6, 8–9 | Create/read/update/archive validates children and expected version, increments row_version, appends revision/audit atomically. Reorders cannot reference another candidate; bad date order fails; overlapping dates warn; 409 preserves intentional concurrent edits. |
| T018 | Implement audited assignment and transfer commands. | T014, T017 | D§4–5, 8 | Leaders act only within own team; members cannot reassign. End/add assignment preserves history; access revokes immediately. Candidate transfer never silently transfers historical bid teams. |
| T036 | Migrate minimal bid/company identity, identifiers, and access grants. | T010–T012, T016 | D§7–8, 15, 18 | Create candidate/team/owner-linked draft bids, companies/aliases, job identifiers and expiring exclusive-target grants with tenant constraints, indexes and RLS. Include all P§14.1 draft metadata, last contact and notes. T026 adds document foreign keys; T038–T040 add immutable workflow tables. |
| T019 | Implement safe bidder candidate projections. | T017–T018, T036; D03 | D§4–5 | Raw candidate/profile-revision access is denied to bidder application roles even via direct database calls. Narrow projection exposes only authorized preparation fields; ownership cannot expand scope. Define the safe document-reference contract here; T027 implements it after document tables exist. |
| T020 | Build candidate directory, profile editing, and detail workspace. | T015, T017–T019 | D§3, 6 | Search/filter/sort and Overview/Profile/Resumes/Bids/Interviews/Activity work within scope, with later features connected when ready. Child add/edit/remove/reorder, fixed/approved titles, completeness, archived states, and conflict recovery match the API. |

## Milestone 2 Resume production

### First complete ATS Classic workflow (18 October 2026 request)

Implement RP01, then RP02, then RP03 using CM01–CM03 and F001C. The user explicitly limits this milestone to ATS Classic; additional templates, cover letters, submission approval and extension production integration remain separate tasks. G01 follows the explicit design §11 interpretation: missing structure/wrong types fail; empty content and unsupported fields warn, with original raw text preserved. The user explicitly permits any authorized profile editor to attest paraphrases against frozen verified facts; this does not grant submission approval (D09 remains pending for submission policy).

| ID | Increment | Design / plan | Acceptance |
| --- | --- | --- | --- |
| RP01 | Shared v1 validation and factual mapping/review | §§10–12; T003–T004/T025 subset | Original schema unchanged; precompiled CSP-safe validator; JSON Pointer errors; bounded safe parsing; empty/unsupported warnings; original text retained; stable work/education mapping, unsupported/conflicting claims blocked or explicitly unresolved. |
| RP02 | Scoped prompt versions/assembly and immutable source API | §§10–13; T021–T023/T026–T027 subset | Server-authorized stable scope/order, exact text/hash and frozen references, protected instructions, user-context reads, non-owner protected commands, RLS/immutable history, actor/key/payload-bound replay and synchronization reconciliation. |
| RP03 | ATS Classic rendering and web production workflow | §§10–13; T028–T031 subset | Frozen identity/content/template/provenance; measured selectable Unicode/multipage PDF, PDF.js previews exact export bytes; raw editor preservation, claim review, exact clipboard, independent operation outcomes and failed sync/retry checks; isolated API/database/browser evidence and visual inspection. |

### Template, letter and frozen export extension (19 October 2026 request)

Continue after RP03. Complete TP01, TP02, then TP03. Exporting a linked frozen PDF is a separate capability; it must never grant raw profile/source access or generation rights. Persist exact PDF bytes when the authenticated rendering attestation is configured; otherwise report the source-only reproduction prerequisites explicitly. No historical version may be overwritten.

| ID | Increment | Design / plan | Acceptance |
| --- | --- | --- | --- |
| TP01 | Remaining eight presets and versioned scoped template library | §13; T021/T024/T028 | Nine searchable presets; safe configuration-only customization/duplication; private/team/organization visibility with matching role scope; append-only publication; frozen versions retain layout/assets/renderer identity. |
| TP02 | Cover letters, sealed artifacts and narrow frozen export | §§5,7,10,13; T026–T027/T031 | Immutable body/snapshot/template/provenance and PDF hashes; signed rendered bytes, actor/key/payload-bound replay; authorized history; linked-bid export without candidate/source/generation grants; revoked grants denied. Report missing signing/storage/reproduction prerequisites. |
| TP03 | Template/letter/document UI and acceptance | §§3,13; T024/T027/T029–T031 | Search/select/duplicate/customize/publish, scoped sharing, letter edit/review/preview/save/export/history and frozen PDF retrieval; later profile/template changes leave old bytes unchanged; isolated permission and browser checks plus visual QA. |
| TP04 | Audit repeated request and strengthen export-only denial evidence | TP01–TP03; §§5,10,13 | Reuse the implemented milestone; correctly formed requests under an active `document.export` grant must be denied for resume/letter creation, new rendering, source editing and direct RPC bypass. Recheck local validation/rendering and isolated database/API/browser evidence; retain explicit hosted/two-device prerequisites. |

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T021 | Migrate prompt/template definitions and immutable versions. | T010–T012 | D§6, 8, 12–13 | Global/team/candidate scope, descriptions, ordering, protected main prompt, layout configuration and asset identity persist. Version allocation is race-safe; publication appends; old versions cannot be changed or deleted by clients. |
| T022 | Implement scoped prompt management and editor. | T015, T021 | D§3, 9, 12 | Main/custom prompts support description, enable/order, version history, scope filtering and authorized publication. Only admins change protected global instructions; users cannot escalate scope. |
| T023 | Implement deterministic prompt assembly and exact Copy Prompt. | T004, T017, T022 | D§9, 12 | Resolve main/enabled blocks, profile snapshot, template instructions and reviewed JD in stable order. Return pinned version IDs and hash; preview/clipboard strings match exactly; untrusted text cannot override controls; clipboard denial is separate. |
| T024 | Define template configuration and build library/editor. | T008, T015, T021 | D§3, 13 | Nine named presets from D§13 have shared sample thumbnails; search, select, duplicate, custom save, reset and visibility work within scope. All P§10.2 controls validate safe bounds; no arbitrary scripts/remote assets; template versions remain immutable. |
| T025 | Implement factual mapping and review workflow. | T004, T017, T023; D09 | D§11–12 | Experience maps to verified source IDs; ambiguous employers require selection; provenance lives outside v1 JSON. Conflicts block publishable versions; structural preview is visibly Unverified; accurate title variants and human-reviewed narrative claims are recorded. |
| T026 | Migrate immutable document versions and render artifacts. | T016, T021, T036 | D§7–8, 13 | Raw/parsed JSON, schema/profile/template/renderer versions, frozen identity, provenance, asset and PDF hashes persist. Add draft bid/version references with candidate and tenant consistency constraints; referenced snapshots cannot be updated/deleted; optional storage is private. |
| T027 | Implement source/letter version APIs and frozen document retrieval. | T005, T019, T025–T026; D03, D06 | D§5, 9–10, 13 | Generation creates immutable, idempotent versions; Save Source does not claim a PDF exists. Letter editing appends. `document.export` reuses existing authorized content without generation rights; exact bytes/hash mismatch blocks a claim of identical handoff. |
| T028 | Implement measured layout planning and PDF rendering. | T008, T024–T027 | D§13 | Line measurement, wrapping, headings with following content, bullets, page splits and Letter/A4 layouts pass synthetic edge cases. No silent truncation or unreadable shrinkage; recorded hashes/renderer/fonts support the chosen reproduction policy. |
| T029 | Implement PDF.js preview and accessible text view. | T028 | D§3, 13 | Preview uses generated PDF bytes with pagination/zoom and an equivalent text view; content edits mark it stale. Renderer errors retain input and cannot show stale output as current. |
| T030 | Build Resume Studio editing and version-history flow. | T020, T023–T024, T027, T029 | D§3, 11–13 | Desktop 3–6–3 grid and narrow-screen tabs expose templates, preview, and JSON. Paste/sample/validate/format/import/clear/source-save preserve invalid input and warn before discard; selected version history is traceable. |
| T031 | Implement web PDF/letter export outcomes. | T027–T030; D06 | D§10, 13, 17 | Safe candidate/company/role/date/operation filenames avoid overwrite. Anchor export says Download initiated; verified directory writes say saved only after completion. Validation, render, local save and sync outcomes remain independent, including partial failure. |

## Milestone 3 Extension workflow

### Scoped implementation increments (19 October 2026)

Complete EX01, then EX02, then EX03 for the requested Resume/Profile milestone. Reuse existing email/password Auth, user-context APIs and frozen document contracts. PKCE/provider experiments, automatic capture/history matching and archive package orchestration remain separate gates.

| ID | Increment | Dependencies / design | Acceptance |
| --- | --- | --- | --- |
| EX01 | Authenticated shared API adapter and durable account-scoped journal | F001A–C, BO01–04; T032/T035; §14 | Current identity/membership before writes, safe GET refresh only, no credentials in content scripts/IndexedDB, frozen operations survive closure, cross-workspace locking and no other-account replay. |
| EX02 | Candidate/Profile and Resume/letter workspace | EX01; T033/T034; §§10–14 | Authorized selection/summary/config, exact previewed prompt copy, invalid JSON retention, shared factual review/rendering, same-byte preview/export, immutable source/letter saves, independent operation results and web links; bidder prepared-export boundary. |
| EX03 | Real-backend extension acceptance and Chrome runbook | EX02; §§14/22 | Isolated real Auth/API/RLS and unpacked Chromium checks, persistence/reopen/retry/account-switch/revocation evidence, builds, installation/reload/manual instructions and truthful hosted/interactive prerequisites. |

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T032 | Build secure MV3 workspace and authenticated API adapter. | T006–T007, T013, T015 | D§14, 20 | Full workspace has Resume/Profile tabs; trusted contexts contain tokens. Manifest has minimal exact-origin permissions, validated messages, local scripts/validator, no unsafe eval, no reliance on long-lived worker globals. |
| T033 | Connect candidate context, reviewed JD, and prompt copying. | T020, T023, T032 | D§12, 14 | Profile tab shows authorized identity/summary/settings/status and web link; selection is reused. Resume tab shows editable JD and copies exact previewed prompt; restricted candidate state and clipboard failure remain clear. |
| T034 | Connect extension JSON, preview, prepared documents, and letters. | T027–T029, T031, T033; D03, D06 | D§10–14 | Authorized generators validate/paste/preview/render and append letters without re-entering profiles. Bidders export only approved scoped prepared versions. Downloads fallback waits for complete/interrupted events; each operation stage reports its own result. |
| T035 | Implement durable IndexedDB operation journal. | T003, T032 | D§10, 14, 17 | Frozen payload/bytes, original actor/org/device, operation ID/hash, attempts/errors and nextRetryAt survive worker termination and workspace restart. Account switching never replays another user's queue; cross-tab locking prevents duplicate local execution. |

## Milestone 4 Bid and interview operations

### Scoped implementation increments (19 October 2026)

The user approved D04: approval required by default, leader/admin reviewers, no self-review by owner/package editor/document author except an audited admin override with reason; letters optional unless team policy requires one. The user also resolved the pending-package D09 question: changed candidate facts require fresh reviewed versions, while previously recorded submissions stay immutable. Preserve all original source requirements. Complete the following increments in order; each receives checks/progress before the next.

| ID | Increment | Dependencies / design | Acceptance |
| --- | --- | --- | --- |
| BO01 | Bid contracts, protected persistence/state machine, exact approvals and explicit submissions | TP01–TP04; §§7–8,18; T036–T040 | Independent opportunities, scoped ownership/team/job fields, optimistic/idempotent commands, all fifteen statuses, held state/admin reopen, immutable job/document approvals and submissions, invalidation and reviewer restrictions. |
| BO02 | Interview rounds, scheduling/feedback revisions and next-action tasks | BO01; §19; T042–T044 | Bid-specific rounds, UTC plus IANA and explicit DST ambiguity choice, lifecycle separate from outcome, immutable reschedule/feedback history, typed tasks and scoped in-app events. |
| BO03 | User-context APIs and isolated authorization/workflow acceptance | BO01–BO02; §§5,9,18–19 | Strict input, current permissions, allowed/denied transitions, stale/concurrent edits, changed documents after approval, multiple opportunities and retained submissions; fresh DB/API checks. |
| BO04 | Bid board/detail and interview/task UI; milestone verification/runbook | BO03; §§3,18–19; T041/T043/T045 | Owner/team/status filters, explicit review/submission, version history, interview scheduling/feedback/next rounds and follow-ups; browser checks, setup/prerequisites and completed progress. Saving/exporting never submits. |

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T037 | Implement scoped bid creation, draft editing, and listing. | T005, T018–T019, T036 | D§4–5, 8–9 | Bid grants and assignment scope are checked on API and database paths; updates require If-Match and allowlisted fields. Direct status/ownership escalation fails; company and job details preserve original values. Strong duplicate resolution is added in T046/T051 before archive release. |
| T038 | Implement bid transition state machine and history migration. | T037; D04 | D§8, 18 | All fifteen statuses and D§18 allowed/denied edges are covered. Append-only status history has scoped RLS; only the transition command writes status/history/audit atomically. On Hold remembers prior state; exceptional reopen is audited. Submission remains gated until T040. |
| T039 | Implement exact-version approvals and their immutable records. | T027, T038; D04, D09 | D§12, 18 | Migrate scoped append-only approvals binding job revision hash and exact resume/letter versions. Edits invalidate approval; no self-approval under selected policy except audited admin override; resume/letter requirements and approval-disabled behavior are explicit. |
| T040 | Implement explicit submission recording and immutable event migration. | T039 | D§7–8, 18 | Scoped submission events enforce candidate/version consistency. Submission checks actor, verified versions, valid approval when required, timestamp and confirmation/attestation. Event/status/audit commit together; later edits or resubmissions cannot replace prior references. Saving/exporting cannot invoke this transition. |
| T041 | Build bid board/detail, review, and submission controls. | T015, T037–T040 | D§3, 18 | Owner/team/status filters, priority, follow-up dates, selected documents, review actions, conflicts and immutable history are visible within scope. Submission is a separate explicit action; archived candidate/history remains traceable. |
| T042 | Migrate interview rounds/feedback and implement commands. | T036, T040 | D§7–9, 19 | Unique round per bid; candidate derives from bid or is constrained consistent. Lifecycle/outcome/feedback representation preserves P§15 labels. UTC plus IANA zone handles DST ambiguity; reschedules retain history and feedback revisions append; bidder denied. |
| T043 | Build interview agenda, scheduling, feedback, and next-round UI. | T015, T041–T042 | D§3, 19 | Bid-specific rounds show time zone, meeting/interviewer details, pending feedback and outcomes separately. New round preserves earlier round; bid outcome changes require an explicit permitted action. |
| T044 | Migrate scoped tasks and notification events; implement APIs. | T010–T012, T042 | D§7, 9, 19 | Target/organization/assignee scope is enforced using typed references or a validating trigger. Reminder event/recipient uniqueness prevents duplicates; overdue work is computed on read; recipients change only their own read state. |
| T045 | Build follow-up queues and notification navigation. | T015, T041, T043–T044 | D§3, 19 | Due/overdue tasks and assignment/review/revision/interview/failure notifications open authorized records. Revoked links show unavailable; queues remain accurate without a live extension worker. |

## Milestone 4A History lookup

Requested Quick Application Check increments: complete QC01, QC02, then QC03. They implement the read-only T046–T049 subset. Strong-identifier save locks, duplicate overrides and package writing remain T050–T053; lookup never creates or submits an application.

| ID | Scoped increment | Acceptance |
| --- | --- | --- |
| QC01 | Shared versioned normalization/evidence and indexed history API | Recompute reviewed identifiers; current organization/candidate and RLS; company/exact/possible results, bounded/truncated scope, authorized status only; matching and deny fixtures. |
| QC02 | Shared capture and direct archive index lookup/repair | Shortcut/menu share bounded user-triggered capture; review before lookup; no credentials in injected code; direct scoped paths, manifest/file hashes, denied/corrupt/incomplete states and explicit company-only repair. |
| QC03 | Concurrent result panel and acceptance | Database/local start independently with allSettled; errors never become absence, source/evidence/status displayed separately; real isolated backend/MV3 checks and manual Chrome instructions. |

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T046 | Implement versioned job/company matching and history API. | T003, T036–T037; D08 | D§7–9, 15 | Original identifiers persist; Unicode/company aliases, provider IDs, posting-specific URLs and JD hashes have fixtures. Preserve unknown/job-bearing URL parameters; company/exact/possible matches include evidence and checkedAt within authorized scope. Fingerprint similarity never silently merges. |
| T047 | Implement shared shortcut/context-menu capture. | T032–T033 | D§14–15 | Ctrl+Shift+F and selection context menu use one CaptureContext flow; capture is user-triggered and bounded. URL/title/company/JD are reviewable; missing selection or restricted-page injection falls back to manual entry. No nonexistent commands permission. |
| T048 | Implement local manifest/index lookup and bounded inspection. | T007, T035, T046 | D§15–16 | Map org/candidate/company to actual paths; verify manifest, operation IDs, hashes and required files. Healthy direct lookup distinguishes missing from denied/failed/unknown; corrupt indexes do not trigger silent recursive scans. |
| T049 | Build concurrent history result and proposed-path panel. | T046–T048; D01–D02 | D§15–16 | API and local checks start concurrently and settle independently. Company/exact/possible history, local presence and recorded status remain separate; scope-limited absence is labeled. Previous history, package inspection, save, cancel and truthful proposed path are available. |

## Milestone 4B Archive writing and recovery

The user explicitly authorized this milestone after QC01–QC03. Implement AP01, then AP02, then AP03; keep the existing normal-user/RLS and frozen-document boundaries.

| ID | Scoped increment | Acceptance |
| --- | --- | --- |
| AP01 | Frozen package journal, safe paths and recoverable local files | Persist UUID/input/bytes before effects; required original JSON/PDF/job details/metadata and optional letter; no overwrite of conflicting bytes; verify closed writes/hashes and retain partial/restart state. |
| AP02 | Protected database synchronization and duplicate serialization | User-context authorization; same actor/key/payload replay; exact frozen versions; stable candidate lock/strong duplicate checks; immutable archive record distinct from submission; export-only bidder prepared-source boundary. |
| AP03 | Independent orchestration, reconciliation, clipboard and acceptance | Local-only/database-only/unknown outcomes, original retry/reopen, metadata/index reconciliation, labeled relative path/manual copy, current permissions and account isolation; local/isolated CI tests and runbook. |

AP01–AP03 are complete for the requested milestone. See [verification evidence](PROGRESS.md#verification) and [package recovery/manual acceptance](ARCHIVE_PACKAGES.md). Native Windows/hosted acceptance and D08 override authority remain explicit gates; the broader tasks below are not collectively marked complete.

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T050 | Implement safe package reservation and verified local writes. | T028, T034–T035, T048; D02 | D§16–17 | Stable candidate/company/operation paths handle Windows reserved names, traversal, length and same-day collisions. Write incomplete manifest, JobDetails.txt, exact Resume.json/PDF and optional letter; close/verify sizes and hashes before packageComplete. Different existing content is a conflict. |
| T051 | Implement atomic, idempotent archive synchronization command. | T027, T036–T037, T046; D08 | D§8–10, 15, 17 | Tenant/actor/type/key/request-hash and result IDs persist with bid/version/audit in one transaction. Identical concurrent retries return one result; changed payload/key owner fails 409 without leaking IDs. Lock candidate/job matching so new keys cannot race strong duplicate detection; explicit overrides are audited. |
| T052 | Connect independent local/server save orchestration. | T035, T049–T051; D03, D06 | D§10, 17–18 | Persist UUID/frozen input before side effects, reuse bytes and prepared versions, record each branch immediately, reconcile IDs into metadata. Full success requires all required steps and metadata reconciliation. A package remains a draft until T040's explicit submission action. |
| T053 | Add targeted retries, index repair, and path clipboard results. | T052 | D§15–17, 22 | Local-only/server-only failure retries only missing work with same ID; timeout reconciles unknown state. Permission loss, disk full, crashes, corrupt index, file conflict and account change have evidence. Explicit company-scoped repair preserves files; clipboard warning is nonblocking with selectable relative-path fallback. |

## Milestone 5 Administration analytics and release

Pilot deployment preparation is scoped as follows. External project creation/billing and real-data retention require supplied account details/owner decisions; preparation and synthetic isolated recovery proceed independently.

| ID | Scoped task | Design | Acceptance |
| --- | --- | --- | --- |
| PD01 | Production configuration isolation, hosting build, stable extension identity, v1 compatibility and versioned release packaging. | §14, 20–22 | Production cannot fall back to development config; deterministic identity and public-only artifact; old unversioned v1 remains supported; exact release metadata/hashes. |
| PD02 | Encrypted backup and isolated restore rehearsal. | §20–22 | Recover Auth identities, app/private schemas, immutable snapshots, stored PDF bytes/hashes, command owners/grants/RLS and signing keys from an encrypted backup in a separate test database; record measured recovery and limits. |
| PD03 | Hosted deployment/environment/Auth/migration/rollback/retention runbooks and synthetic smoke tooling. | §20–24 | Exact selected-provider commands, ordered reviewed migrations, role-scoped synthetic smoke, private storage decision, quotas and explicit readiness gates. No real-data purge without accepted policy. |
| PD04 | Clean-checkout CI, tagged extension test release and acceptance evidence. | §21–22 | Fresh npm ci/check/build, migration/RLS/recovery/browser gates, release contents/secret scan, tag and reproducible artifact. Actual hosted deployment/manual results reported without assumptions. |

The operational-interface request is implemented in these scoped increments, reusing the completed foundation, workflow and archive milestones. These do not waive retention, recovery, hosting or native browser release gates.

| ID | Task and dependencies | Design | Acceptance |
| --- | --- | --- | --- |
| OP01 | Scoped reporting contract and database/API projection; depends on FN, CM, BO. | §3–5, 19, 22 | One user-context query supplies metric counts and paginated detail sets; distinct submission cohorts; current RLS; bidder own authorized activity; cross-team/org, revoked and empty scopes tested. |
| OP02 | Four role dashboards, workload, queues, notifications, activity and administration navigation; depends on OP01. | §3, 19–20 | URL filters, matching drill-down totals, due times, independent source failures, existing protected administrative controls and no bidder interview controls. |
| OP03 | Durable redacted failure observations and assignment notifications; depends on OP01–02. | §19–20 | Current target permissions on report/read, independent client outcomes, original operation IDs, owner/supervisor visibility and revocation checks. |
| OP04 | Full §22 acceptance audit and isolated CI; depends on OP01–03 and AP. | §22 | Each of 20 base and 15 archive criteria plus every design gate has passed/failed/not yet verified evidence; fix blockers and identify remaining release prerequisites. |

OP01–OP04 are complete for this operational-interface milestone, with the full matrix in [ACCEPTANCE.md](ACCEPTANCE.md) and passing isolated evidence in [PROGRESS.md](PROGRESS.md). Operational interface/audit completion does not complete T058–T062 retention, recovery, deployment and manual release gates.

| ID | Scoped task | Dependencies | Design sections | Acceptance criteria |
| --- | --- | --- | --- | --- |
| T054 | Build team, user, capability, and policy administration UI. | T014–T015, T018, T039 | D§3–5, 20 | Admins manage invite/deactivate/roles and scoped overrides; leaders manage only own team assignments/policy allowed by backend. No self-escalation; failure recovery and audit links are visible; settings reflect accepted policies. |
| T055 | Implement scoped dashboard aggregates and drill-down API. | T037–T045 | D§9, 19 | Filters apply before aggregation with identical detail scope. Counts reconcile; conversion uses distinct bid submission cohorts, numerator/denominator/as-of dates and N/A for zero. Team workload shows unassigned work; bidder sees own authorized activity. |
| T056 | Build four role dashboards and workload views. | T015, T045, T055 | D§3, 19; P§6 | Admin, leader, member and bidder views show their required actionable queues, candidates, bid/document work, interviews where authorized, feedback and failures. Metrics open exact filtered lists; bidder has no interview controls or hidden data in responses. |
| T057 | Complete service hardening and operational failure views. | T011–T014, T045, T052, T054 | D§20–22 | CSP, explicit CORS, CSRF, rate limits, schema/URL limits and safe rendering are verified. Telemetry uses request/operation IDs and redacted counts/errors, excluding candidate content/tokens. Scoped audit/failure views cover role changes, exports, reviews, submissions, denials and sync backlog. |
| T058 | Implement retention enforcement and authorized purge workflow. | T026, T036, T042, T057; D05 | D§20 | Ordinary archive preserves immutable history; permitted purges are tracked across relational records/private assets under accepted preservation rules. Minimal audit evidence and backup expiry follow policy; local-export cleanup limits are stated. No production purge before periods/authority are approved. |
| T059 | Implement backup/export and prove isolated recovery. | T026, T036, T042; D06–D07 | D§20–21 | Encrypted database and asset backup plus pinned renderer/template/font inputs restore into an isolated environment. Record measured recovery point/time against accepted objectives; user archives are not claimed as platform backup. |
| T060 | Complete CI migration, security, concurrency, and browser gates. | T030–T031, T034, T040, T043, T045, T053–T057 | D§21–22 | CI checks type/lint/shared contracts, all API/RLS allow/deny paths, transaction rollback, migrations from empty, and browser smoke flows. Concurrent replay, different-payload same-key, strong-job races, approval changes and timeout recovery pass. Manual gates are tracked separately. |
| T061 | Write deployment/operator runbooks and package test release. | T054, T057, T059–T060; D01, D07, D10 | D§20–24 | Separate dev/prod config documented without secrets; compatible migrations precede clients with expand/migrate/contract rollback strategy. Web/extension share a tagged commit and contract/renderer versions; supported-client window preserves old unsynced work. Host terms/quotas checked; extension loads locally. |
| T062 | Run release acceptance and record pilot readiness. | T058–T061; C01, G01 and D01–D11 gates resolved as applicable | D§22–24 | Every coverage row below has evidence; manual directory restart/renewal, cross-tab/OS paths, PDF extraction and recovery pass on supported clients. Scoped load targets are measured on agreed device; retention, access, hosting, backup and known limitations have accepted owners/defaults before real onboarding. |
| T063 | Add native Windows integration only if required. | T053, T061; explicit D02 requirement | D§14, 16, 23–24 | Separately scoped helper/installer and native messaging validate allowed extension origin, root containment and reparse-point escapes. Only verified absolute paths are returned/opened; ordinary directory flow remains truthful. This conditional later task is outside initial release unless D02 makes it mandatory. |

## Acceptance coverage

Numbers in the base column refer to P§22; archive numbers refer to P§24.12. This map assigns evidence collection; it is not evidence of passing tests. D§22 supplies additional failure, authorization, and concurrency cases.

| Gate | Base criteria | Archive criteria | Implementation and evidence tasks |
| --- | --- | --- | --- |
| Identity, role restrictions and administration | 1–3, 16, 18 | 14 | T009–T020, T032, T054, T060 |
| Schema, validation, template preview and PDF | 4–7, 10 | 7 | T004, T008, T024–T031, T034, T050, T060 |
| Secure versions and letter history | 8, 10, 12, 17 | 8–9 | T021, T026–T027, T039–T040, T051, T060 |
| Exact prompt copying and shared contracts | 11, 18 | — | T003–T005, T022–T023, T032–T034, T060 |
| Bid, approval, interview and follow-up integrity | 13–17 | 15 | T036–T045, T052, T055–T057, T060 |
| User-triggered capture and concurrent matching | — | 1–5, 10 | T046–T049, T051, T060 |
| Package structure and collision protection | 7 | 6–8, 13 | T007, T048, T050–T053, T060 |
| Truthful partial failure and safe retry | 9, 19 | 9–11, 13 | T031, T035, T051–T053, T060 |
| Clipboard/download completion truth | 7, 19 | 12 | T031, T034, T049–T050, T053, T060 |
| Dashboards, operations and affordable deployment | 15, 20 | — | T045, T054–T062 |

Release evidence includes immutable histories after later edits; multiple tenants and unrelated teams; archived/reassigned/deactivated cases; malformed/empty/unknown/escaped JSON; all nine presets; timeout after server commit; worker termination; denied directory/clipboard permissions; interrupted downloads; corrupt indexes; and changed payload under the same key. Never mark an unavailable browser, service, or manual gate as passed.

Automatic job submission, paid AI calls, email/messaging integrations, executable templates, unrestricted filesystem access, and store publication remain deferred. Current plan work does not authorize deployment, external account provisioning, or product implementation.
