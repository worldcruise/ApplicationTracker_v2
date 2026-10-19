# Candidate management

CM01–CM03 implement design §§3, 6 and 8 on the existing foundation and hosted SSR clients. The unchanged canonical resume schema v1 describes resume content; candidate profiles are a separate aggregate with their own typed input. No sample table, service-key business query, RLS relaxation or hosted mutation is needed for this feature.

## Running against hosted development

Use Node 24/npm 11. Preserve the existing ignored `apps/web/.env.local`, including its hosted public URL and publishable key. Examples remain placeholders. From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000/sign-in`, sign in with an existing authorized synthetic account, then choose **Open candidate directory** in the workspace. The directory lives at `/candidates?organizationId=<organization UUID>`. A signed-in account still needs active application memberships and resource scope.

On this Windows working copy, if Node is absent from PATH, first run:

```powershell
$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH
npm.cmd run dev
```

Apply the three new migrations after the five foundation migrations using the reviewed, Docker-free [hosted migration workflow](HOSTED_SUPABASE.md#hosted-migrations-without-docker). Check the linked project's identity/history, run `npx supabase db push --linked --dry-run`, then apply only to the authorized development target. CLI login/project access and database credentials are separate from the public application key. No hosted migration, account creation or email setting change was performed by this task.

| Migration | Purpose |
| --- | --- |
| `20261018000300_candidate_profiles.sql` | Nullable drafts, Ready constraints, ordered children, date precision, immutable revisions and scoped RLS. |
| `20261018000400_candidate_profile_commands.sql` | Transactional create/edit/archive/restore/title approval, frozen snapshots and audit. Existing candidate rows receive a baseline snapshot with unknown actor; earlier history is not invented. |
| `20261018000500_candidate_scope_directory.sql` | Versioned assignments, scoped member options and directory; revoke the legacy unversioned assignment command. |

## Profile behavior

- **C01 disposition:** the user explicitly selected name, email, location **and phone** for Ready on 18 October 2026. Empty drafts are valid. Supplied email, phone and URL values are validated even in Draft. The original PRD/design transcription remains unchanged.
- Personal information, seniority preference, professional summary, private notes, professional links, work experience, education and certifications persist in real tables. Links normalize to HTTP(S); credentials and executable/local schemes are rejected. Missing facts stay null; no placeholder candidate facts are generated.
- Each work entry retains its official historical title. A proposed presentation title is separate. Admins/own-team leaders approve a saved proposed title under `tailorable` policy; assigned members cannot approve. Changing the official/proposed title or title policy clears the current approval. Earlier revision snapshots retain earlier approvals. Policies are fixed, tailorable or omit; omission never deletes history.
- Work retains source bullets, verified achievements and preferred bullet count. Education retains display policy, optional periods and order. Certifications retain name, issuer, credential ID, verification state, issue/expiry dates. All four child sections support ordering and removal from the current profile.
- Dates retain supplied year/month/day precision as text. Comparison ranges validate real dates and impossible ordering; inferred boundaries are never stored as employment facts. Overlapping work is a warning. Current employment with an end date is rejected until corrected.
- Children retain stable IDs and immutable parent links. Removing an entry soft-removes it from the current profile; it cannot be moved to another candidate. Every successful aggregate change appends an immutable full snapshot and redacted audit event in the same transaction. No routine hard delete or submitted-document mutation is exposed.
- Profile editors can archive/restore within their existing resource scope. Archive retains history and current assignments, hides the record from the default directory and blocks profile/assignment/title changes and new draft bids. Explicit archived/all filters retain authorized read access. Restore returns the prior Draft/Ready state. Existing bids are independent; archival is never a submission.

## Authorization and concurrency

The server resolves current Auth identity, active organization and active team/assignment scope on each request. Ordinary reads use the request's authenticated user client and RLS. Protected writes execute as the existing non-owner NOLOGIN/NOBYPASSRLS command role with fixed SQL, pinned search paths and scope checks. Raw profile children and snapshots remain denied to bidders; their separate, narrow candidate projection is unchanged except that an unknown draft name may be null.

Admins see their organization, leaders their active leadership teams, and members their active assignments. Ownership alone grants no read access. Managers can assign only eligible active members of the candidate's current team. An assignment ending preserves its old row and immediately removes assignment-based access. Candidate/team transfer and mixed-role expansion remain outside this milestone.

Every mutation after creation requires the quoted current aggregate version in `If-Match`. A row lock, version check and one transaction serialize edits, assignments, archive and title approval. A stale request receives 409 `VERSION_CONFLICT` with the current authorized version; it never overwrites the winner. Child validation failure rolls back the entire operation.

The web editor retains its in-memory draft on validation, network or conflict errors. Conflict comparison loads the latest authorized profile. Independent fields merge; concurrently changed fields and whole ordered sections require an explicit mine/current choice. **Use merged draft** does not save: review and press **Save profile**. No blind overwrite or automatic retry is performed. A current archived profile must be loaded instead. Drafts are not persisted in browser storage; leaving/reloading requires discarding unsaved work through the browser/page prompt.

## API subset

All routes are under `/api/v1`, require `organizationId` in the query, use existing response/error envelopes and no-store session responses. Cookie mutations require exact-origin CSRF checks; extension bearer context never falls back to cookies. PATCH is included in the exact-origin CORS preflight. Bodies are bounded to 256 KiB; ordered arrays cap at 100 records. These candidate-specific bounds do not freeze the pending complete OpenAPI/canonical validator limits.

| Method / path | Input / result |
| --- | --- |
| GET `/candidates` | `q`, `status=active|draft|ready|archived|all`, `teamId`, `ownerId`, `assigneeId`, `unassigned=true|false`, `sort=updated_desc|name_asc|name_desc|created_desc`, `page`. Returns `{items,total,page,pageSize}`; page size 25, stable ID tie-break. Search is a literal case-insensitive substring of name/email/location; counts are RLS-scoped. |
| POST `/candidates` | `{teamId,ownerId,profile}`. Admin or own-team leader; returns full profile/version. `profile` uses `CandidateProfileInput` in `packages/contracts/src/candidates.ts`. |
| GET `/candidates/:id` | Full profile for authorized profile roles; bidders retain only the grant-scoped safe projection, with optional `bidId`. |
| PATCH `/candidates/:id` | Complete editable profile content, ordered IDs and current `If-Match`; no approval/identity metadata accepted. |
| POST `/candidates/:id/assignments` | `{userId,assign}` plus `If-Match`. Admin or own-team leader. |
| POST `/candidates/:id/archive` | `{archived}` plus `If-Match`; current profile editor scope. |
| POST `/candidates/:id/title-approvals` | `{experienceId}` plus `If-Match`; admin or own-team leader. |
| GET `/candidates/:id/workspace` | Authorized bid/interview anchors, audit events, revision metadata and eligible assignees. No bidder access. |
| GET `/candidates/:id/revisions/:number` | Frozen profile snapshot, only after checking current profile scope. |

The old `change_candidate_assignment` RPC is no longer executable by application clients. The foundation `changeAssignment` API command now also requires `If-Match` and returns the updated profile. The directory response is now a paginated object rather than a bare array. Existing workspace callers were updated.

## Six-tab workspace and limits

Overview contains saved facts, links, assignments and archive controls. Profile provides structured editing, record order, validation warnings and separate title approvals. Activity shows the most recent 50 events/revisions and opens read-only frozen profile snapshots. Tabs retain the unsaved draft; directory return links preserve filters.

Bids shows the most recent 100 authorized foundation bid rows. Interviews shows up to 100 authorized rounds for those bids. Their full workflows remain later tasks. Resumes explicitly states that immutable resume-version storage is pending; it does not fabricate an empty document history. Saving a profile, approving a display title or archiving a candidate cannot submit an application. Local PDF saving/sync/clipboard operations are untouched.

## Verification and manual acceptance

Run from the root:

```sh
npm run check
npm run build
```

Database tests run in isolated GitHub Actions because Docker/Podman is absent on this computer. The workflow starts/reset an ephemeral Supabase stack, applies all migrations and runs pgTAP; its production HTTP harness then uses real synthetic Auth identities, builds Next/MV3, starts Next and runs API and headless Chromium checks. It never links to hosted development. Browser contexts stay in memory: no Auth storage-state files, traces, HAR, videos or credential logs are written. To reproduce on an isolated Docker-capable CI machine without `.env.local`:

```sh
npm ci
npm run db:start
npm run db:reset
npm run db:test
npx playwright install --with-deps chromium
CI=true npm run test:foundation:http
npm run db:stop -- --no-backup
```

Final [isolated CI at ac7e0f7](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39179355613) passes eight migrations, 132 pgTAP assertions, 31 unit tests, production builds, 379 Auth/API assertions and all 15 candidate Chromium checkpoints. Details and failed-attempt corrections are in [PROGRESS.md](PROGRESS.md). The [official Playwright CI guidance](https://playwright.dev/docs/ci-intro) describes browser/dependency installation; this harness keeps credentials and browser sessions in memory.

Record observed hosted/interactive results separately. Manual checks still required on the supported browser/deployment:

1. Sign in with synthetic admin/leader/member/bidder accounts. Confirm directory and raw profile scope across two organizations/two teams. Direct URL/API access must deny unrelated teams and bidders.
2. Create an empty draft; add the four Ready facts, links, precise/unknown dates, ordered work/education/certification entries. Save and reload. Invalid phone/email/scheme/dates must block saving; work overlap must warn.
3. Open two tabs at the same version, save different data in each and resolve the second tab's conflict. Confirm retained local edits, explicit section choice and a separate save. Check keyboard focus, field errors, narrow screen layout and unsaved navigation prompts.
4. Propose/approve a display title as leader, edit it as assigned member and verify approval clears while official history and the old revision remain unchanged. Member approval and assignment requests must fail.
5. End an assignment while the member has an unexpired session; refresh/read/save must fail. Archive and reload; editing/new preparation must fail, explicit archived search/history must work, and restore must retain the previous status.
6. Exercise actual hosted session refresh, recovery/email delivery and deployment cache behavior using the existing [SSR checklist](HOSTED_SUPABASE.md). Headless isolated checks do not verify hosted configuration, real Chrome extension behavior, session rotation at deployed expiry, accessibility certification or performance targets.
