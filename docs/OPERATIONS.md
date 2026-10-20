# Operational workspace

Open `/workspace` after sign-in, or `/dashboard?organizationId=<authorized UUID>`. The organization selector, current role and database permissions determine available work. Admins manage users, teams, roles, activation, bidder grants and approval policies in the workspace. Leaders open candidate Overview to manage their teams' assignments. Members work through assigned candidates; bidders see their own currently authorized bid activity, prepared exports and follow-ups. A dashboard link never authorizes a mutation.

## Reports and scope

`GET /api/v1/dashboard` calls the invoker-context `operational_dashboard` function using the current user's token/cookies. It uses one SQL snapshot and one materialized row set for counts and the selected detail page. No client aggregation or truncated list supplies a total. Pages contain 25 records, ordered by due date, update time and UUID. Every read rechecks RLS; concurrent business changes can legitimately change a later page/report. The as-of value is a read timestamp, not a historical database snapshot that survives subsequent requests.

Supported URL filters: `teamId`, `ownerId`, `status`, `company` (literal case-insensitive substring), `from`, `to`, `windowDays`, `metric`, `page`. Company and status filter bids before aggregation. Candidates use their owning team, owner or active profile assignment; company/status filters additionally require a matching visible bid. Interview/task rows must have a matching visible bid. Owner means **bid owner** for bid/interview/task filtering; workload groups the resulting tasks by **assignee**. Candidate assignment and unassigned counts are distinct non-archived candidates. Bid history remains visible after candidate archiving under current permissions; active bids follow the documented status definition rather than silently discarding historical records.

Metrics are versioned as `operations/1` in shared contracts. Active bids exclude Rejected, Withdrawn, Expired and Closed; pending offers are also shown separately. Ready for Review is the approval queue. Awaiting response includes Submitted and Awaiting Response. Document work is Resume Preparation or Needs Changes; it does not claim every unstarted document is represented by a bid. Overdue means an open task due strictly before the report clock. Upcoming means Scheduled within `[asOf, asOf + windowDays)`; cancelled rounds are excluded. Pending feedback means Feedback Pending, or Completed without a feedback revision. Zero unassigned tasks is explicit because the database requires an assignee.

Submission cohorts use inclusive UTC calendar start/end dates (default the preceding 30 days through today), displayed as an exclusive timestamp interval. A distinct bid enters a cohort if an immutable actual submission event falls in that interval and is not in the future. Repeated submissions count once within the cohort. Interview invitation evidence is an explicit Interview Invited bid transition or a round with a scheduled timestamp; cancelled historical rounds still establish an earlier invitation. Offer evidence is an explicit Offer bid transition. Neither completed rounds nor their outcomes automatically change overall bid outcomes. Show numerator, denominator, cohort and as-of time, N/A for zero denominators and the incomplete-outcomes caveat. Cohort dates filter conversions; current workload/action queues retain current work. Bidder reports omit profile, interview and feedback metrics and interview conversion; only currently authorized bids owned or created by that bidder enter their report.

## Notifications, activity and failure reports

Existing workflow notifications cover bid changes/reviews, interviews, feedback and workflow failures. New assignment notices and processing notices have unique event/recipient keys. Mark-read commands verify the current recipient and target. Current revocation can remove a historical notice from the inbox. The activity endpoint returns paginated action/actor/subject/request IDs and timestamps under the existing audit RLS; changed profile/document values are excluded.

Processing is a **dated client report**, not proof of submission or current local filesystem state. `POST /api/v1/processing` accepts only event/operation/candidate/bid IDs, stage, state and an enumerated safe code. PostgreSQL derives actor/team and verifies the target. Immutable events use stable IDs on retry; changed same-ID requests conflict. The overview selects the latest event per actor/operation/stage under owner/supervisor RLS. Recovery appends a new event and removes that stage from the unresolved list. Other actors' reports never become bidder activity merely because a candidate grant exists.

Web resume/letter and bid journals, and extension package journals, persist redacted reports before sending. Reporting never changes business outcomes and does not replay business writes. A failed reporting request retains its original event. Opening the relevant workspace/dashboard retries only its current actor/organization's reports; current Auth and resource checks still apply. Completely offline/unopened devices and invalid drafts without an operation remain unknown centrally. Inspect the original local journal; a green/empty central list is not proof that all devices are synchronized. Current source, export, database, reconciliation and clipboard states remain independent. No service worker needs to stay alive.

The setup administration panel currently bounds each roster at 100 entries and says so. Candidate assignments are managed through the paginated directory/Overview. Larger administrative roster pagination and mixed team roles/arbitrary capability overrides remain prerequisites if that scope is required; the existing four-role and bidder-grant boundaries are unchanged.

## Security and setup

Apply all versioned migrations with the hosted workflow in [HOSTED_SUPABASE.md](HOSTED_SUPABASE.md). New migrations add reporting, immutable processing observations/notifications and a private per-user API rate counter. Ordinary API calls retain user context. The protected counter allows 1,000 API requests per user per UTC minute, shared across web processes, then returns 429/`RATE_LIMITED` with `Retry-After: 60`. This is a defensive ceiling, not acceptance of D11 load targets. It is not provider-wide Auth/edge abuse protection, nor a limit on all direct authorized Supabase reads. Retain original operation IDs after throttling and reconcile before retrying writes.

The web uses a fresh request nonce for scripts and dynamic rendering throughout, following the [official Next.js CSP pattern](https://nextjs.org/docs/app/guides/content-security-policy). General JavaScript eval is development-only. PDF.js/React layout permits inline styles; scripts do not use an unsafe-inline exception. Connection sources are the configured Supabase origin and self (development also permits local hot-reload WebSockets). Workers/assets are local. Response replacement preserves cookies, no-store and security headers. HTTPS/domain/HSTS and upstream abuse controls must be verified at the selected deployment host. CSP does not replace validation, CSRF or RLS.

Run with Node 24/npm 11:

```sh
npm ci
npm run dev
# Production verification / local start
npm run check
npm run build
npm run start --workspace @candidate/web
# Build and reload the unpacked extension
npm run extension:build
```

Keep `apps/web/.env.local` and extension build settings ignored. See [FOUNDATION.md](FOUNDATION.md) for bootstrap/invitation credentials and [ARCHIVE_PACKAGES.md](ARCHIVE_PACKAGES.md) for signing keys, stored bytes and Chrome archive setup. Hosted development does not require Docker. Isolated CI starts a separate synthetic Supabase stack and refuses the hosted environment file.

## Manual checks

1. Sign in under each of the four synthetic roles in two organizations/unrelated teams. Verify the role heading, organization switch, allowed links and forbidden direct requests; revoke an assignment/grant while the other browser stays open and refresh.
2. Set all report filters, open each metric and compare the exact detail total. Traverse multiple pages, reload/copy the filtered URL, and compare source bids/submissions using that user's scope. Test a zero submission cohort and multiple rounds/submissions of one bid.
3. Open overdue work in the user's time zone and a scheduled interview across a daylight-saving change. Mark feedback separately from the overall bid outcome. Review a self-owned package and confirm independent approval is still required.
4. Trigger an original-operation synchronization timeout and a denied archive write/clipboard copy. Confirm independent journal rows, then the dated dashboard report once connected. Recover the same operation; include recovered stages and confirm history remains. Switch accounts before retrying and confirm no queued business work/report is delivered as the other actor.
5. Mark a notification read, revoke its target, and verify it cannot be reopened/marked by another user. Disconnect one dashboard source and confirm other panels remain usable with an explicit error/stale label.

Full status and release prerequisites are in [ACCEPTANCE.md](ACCEPTANCE.md). CI Chromium/OPFS evidence does not certify Windows directory pickers, physical gestures, disk-full/power-loss behavior, backups or deployment quotas.
