# Bid and interview operations

BO01–BO04 implement design §§18–19 using the existing hosted Supabase clients, candidate facts and frozen documents. A bid is one opportunity for one candidate. Different opportunities have independent owners, status, approvals, submissions and interview round numbering.

## Start and prerequisites

Use Node 24/npm 11 from the repository root:

```sh
npm ci
npm run check
npm run build
npm run dev
```

Open http://localhost:3000/sign-in, then Workspace → Open bids and follow-ups. Candidate → Bids links to that candidate's opportunities. Direct routes are /bids, /bids/:id, /interviews and /tasks; preserve the organizationId query parameter. Authorized frozen documents remain under /documents.

This working copy's ignored apps/web/.env.local already contains hosted public settings. Do not replace unrelated settings or put privileged keys in NEXT_PUBLIC variables. On this Windows computer the optional portable runtime is:

```powershell
$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH
npm.cmd run dev
```

An operator must apply the reviewed versioned migrations, including 20261019000500 through 20261019001000, before using these operations against hosted development. Follow [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md) for CLI login, link, dry-run and push; no Docker is required for that workflow. This milestone did not modify the hosted project. Active synthetic accounts, organization/team memberships and candidate assignments are required. Source generation/review and exact PDF storage require the existing [document signing configuration](RESUME_WORKFLOW.md); select stored, reviewed document IDs, not unsaved local PDFs.

## Bid preparation, review and actual submission

Save target company, title, job description, URL, external ID, job location, owner, team, priority, follow-up/contact timestamps, notes and business outcome through the bid form. Team is derived from the candidate's owning team and cannot be changed through a bid edit. Only managers may reassign an existing owner; the database checks active eligible organization/team/assignment scope. The candidate must remain unarchived. Existing history stays readable after archival within current permission scope.

The fifteen statuses and allowed edges are preserved from [design §18](DESIGN.md#18-bid-state-and-approval-design). Only the protected transition command changes status. Reasons/evidence are mandatory. On Hold records its prior status, rechecks its package on restoration and routes an invalidated Approved package back to Resume Preparation. Terminal reopening is an explicit administrator action with a reason, returning to preparation; it never overwrites a previous submission.

The user accepted these defaults: approval required, leader/admin review, no self-approval by the bid owner, package creator/editor or selected document author. Historical package editors remain in the contributor set when another editor makes a later change. An administrator may make an audited override with a reason. Cover letters are optional unless team policy requires them. Workspace administration exposes policy changes and separate scoped bid.prepare, bid.submit, document.read and document.export grants. Changing policy invalidates current approvals; old submission policy snapshots remain intact.

Approval records the exact job snapshot/content hash, selected resume/letter document and source IDs, reviewer, decision, time and policy version. Job, ownership or selected-document changes invalidate it; priority, follow-up and operational notes do not change the approved package. Candidate fact changes require **fresh reviewed versions** for pending bids, following the user's D09 decision. An independent reviewer cannot reapprove stale historical versions. Access metadata and private notes do not count as document facts. A candidate-row lock serializes factual verification with profile changes; database checks do not rely on a browser flag.

Choose **Record actual submission** only after actually submitting the application. Supply the actual timestamp and confirmation or explicit attestation. The command revalidates scope, current facts, reviewed documents and required approval and atomically appends a submission event plus status history/audit. It binds the approved IDs, never the newest document. Saving a bid, generating/exporting a PDF, completing an interview, and saving a local archive cannot invoke this action. Reapplications use an explicit audited reopen/new preparation and append another submission event.

Normal requests use the current user's JWT and RLS. Bidder preparation and actual submission require separate capabilities; submission also needs export access to the selected reviewed artifacts. A bid grant does not expose unrestricted candidate profiles, source snapshots or interview feedback. Grant revocation/deactivation applies to existing tokens. Service credentials are not used for ordinary workflow requests.

## Interviews and follow-ups

An interview derives candidate identity through its bid. New rounds require an Interview Invited bid, use unique sequential round numbers per bid and retain an optional same-bid predecessor. A completed Next Round creates a successor record; it does not replace the earlier round.

Enter local date/time, an IANA zone and duration. For a repeated daylight-saving time, explicitly choose an offset/UTC occurrence; nonexistent times fail with a field error. The shared Temporal implementation checks both possible occurrences and round-trips the local time; the database independently checks the supplied UTC/local/zone/offset tuple. This follows the [Temporal zoned-time documentation](https://tc39.es/proposal-temporal/docs/zoneddatetime.html) and uses the pinned [Temporal polyfill](https://github.com/js-temporal/temporal-polyfill), without changing global Temporal.

Lifecycle is Not Scheduled, Scheduling, Scheduled, Completed, Feedback Pending or Cancelled. Outcome is independently Pending, Passed, Next Round, Offer or Rejected. A completed round may still have pending feedback/outcome. Feedback corrections append numbered revisions. Schedule/owner/lifecycle/outcome edits append round snapshots; cancelled rounds remain historical and completed rounds cannot revert to scheduling. The overall bid changes only through its separate explicit action.

Bid follow-up and interview next-action/due dates create typed persisted tasks. Rescheduling cancels an obsolete open task and retains its record; completed tasks remain completed. Due/overdue queues use database timestamps at read time. Assignees or scoped managers complete tasks with version checks. In-app events cover assignment, review/status/revision, interviews, feedback and authorized failed workflow operations; event/recipient keys prevent duplication. Reads recheck current target visibility. Recipients may change only their own read state. There is no email, calendar-provider integration, push scheduler or dependency on extension-worker globals.

## API and recovery

All routes are under /api/v1 with organizationId. GETs and errors are no-store. Cookie mutations require exact Origin; bearer mutations retain token context without cookie fallback.

| Resource | Operations |
| --- | --- |
| /bids | GET scoped company search, status/team/owner/priority/candidate filters and 25-row pages; POST create |
| /bids/:id | GET current bid/access plus histories; PATCH details |
| /bids/:id/transitions | POST explicit review/status/submission/reopen |
| /interviews | GET scoped agenda or bidId rounds; POST new round |
| /interviews/:id | GET current round, feedback and revisions; PATCH schedule/lifecycle/outcome |
| /interviews/:id/feedback | POST append feedback revision |
| /tasks | GET state/mine/overdue/bidId queue |
| /tasks/:id/complete | POST explicit completion |
| /notifications | GET current recipient's visible events |
| /notifications/:id/read | POST mark own event read |
| /workflow-operations/:operationId | GET original actor's visible committed result or null |
| /workflow-policy/:teamId | PATCH administrator policy with team If-Match |

Bid create/edit uses {operationId,input}; transitions use the shared BidTransitionInput; interview save uses {operationId,previousRoundId,input}; feedback uses {operationId,feedback}; task completion uses {operationId}. Supply Idempotency-Key equal to operationId and quoted If-Match (0 for creation, current row version for edits). Shared client/server validation retains form input and returns field paths; the database repeats scope and invariants. Unknown fields fail.

The browser writes the operation ID, actor, organization, original If-Match and frozen payload to IndexedDB **before** sending. Failed local journaling prevents sending. An atomic reservation prevents another tab from replacing pending work; reconciliation clears only its matching operation, so a late old-tab response cannot erase a newer request. A network/service failure retains the request and pauses new mutations. Reconcile checks the original operation result and retries the identical payload only when absent. Account-switch headers prevent executing another actor's pending request. Confirmed database synchronization and local archive saving are independent; this UI does not create an archive.

A stale edit returns 409/currentVersion. The form stays available. Compare the current record in another tab or use the explicitly labeled reload/replace control before resaving; the UI does not silently merge whole job/document packages. History displays the most recent 200 bid events per category; agenda/tasks are bounded to 200 and notifications to 100. These are bounded operational views, not the later analytics/export product. Immutable database records are retained beyond the display limits.

## Verification and manual acceptance

Local npm run check passes all 37 tests, lint and type checks. Web/MV3 production builds pass; the Windows esbuild ancestor-directory sandbox restriction required an approved rerun outside that sandbox. Docker is absent on this computer, so database tests were executed in isolated CI instead. Final [be9727b CI](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39315327524) passes all 20 migrations, 225 SQL assertions, 37 unit tests, 1,228 real Auth/API/artifact assertions, production builds and 47 browser checkpoints, including 15 bid/interview checkpoints.

The CI workflow runs npm run db:start, db:reset, db:test and test:foundation:http against a fresh local Supabase stack with synthetic users in two organizations and two teams. The HTTP harness rejects hosted endpoints and local .env.local; privileged credentials remain only in its ephemeral server/operator process. It includes real reviewed/rendered documents without adding sample tables or weakening RLS. See [PROGRESS.md](PROGRESS.md) for incremental evidence and remaining manual checks.

On a configured hosted development deployment, manually repeat:

1. Create two opportunities for one synthetic candidate. Refresh and compare job details, owners, selected frozen documents, filters and independent round numbers.
2. Try a forbidden edge, member review, owner/editor/author self-review, unrelated team/org and bidder interview/source URLs. Use a reasoned admin override and verify its immutable record.
3. Approve a package, then change its job, document, owner, team policy or candidate facts. Verify invalidation and fresh-document requirements. Old submitted job/doc/PDF hashes must stay unchanged.
4. Save two tabs at the same version. Verify one conflict and retained form text. Simulate a response lost after commit, reload and reconcile the original operation; one submission/event must exist.
5. Schedule America/New_York 2026-03-08 02:30 (reject) and 2026-11-01 01:30 (two explicit choices). Reschedule, complete with pending feedback, append corrections, create a successor and verify the overall bid stays unchanged.
6. Complete an overdue typed task, mark an own notification read, revoke a grant and deactivate a user. Refresh and follow old links to verify current permission enforcement.

Interactive hosted/two-device, keyboard/visual and real Chrome MV3 acceptance remain separate. Hosted migration, accounts/email settings, signing-key registration, private PDF storage/backup, retention/recovery and service availability remain operator prerequisites. No real application was submitted and no automated submission, paid AI, native helper or store publication was added.
