# Application Tracker v2: Bids and Interviews search

The repository/folder remains `ApplicationTracker_v2`. This increment changes search and result presentation; bid preparation, reviews, explicit submission, interview lifecycle/outcome and immutable history retain their existing commands.

## Behavior

Open `/bids` or `/interviews` after sign-in. Search candidate/company/job title, IDs, authorized owner names and bid descriptions/notes. Interview search also covers interviewer, type, next action and the **latest authorized feedback revision**. Earlier feedback remains available in history; it does not describe the current search result. Candidate private notes, contacts and unrestricted profile bodies never enter this index. Interview matching does not search bid descriptions/notes.

Typing waits 300 ms; Enter and Search now run immediately. A new request aborts the previous one and guards its response. Filters, text, sort, page size and page live in URL parameters; Back/Forward and reload retain them. Query/filter/sort changes return to page 1. Remove individual chips or use Clear all. Failed requests show Retry search; permissions, loading and no matches have distinct messages. Result rows show the related candidate/company/job and authorized owner/team. No unrestricted snippets, global suggestions or hidden-field highlights are returned.

Text uses case/whitespace normalization without stripping apostrophes or Unicode from stored data. PostgreSQL `simple` full-text lexemes and prefix queries are combined with escaped literal substrings and trigram word matching for identity fields (minimum three characters; threshold 0.4). All query terms must match, possibly across related fields. Significant `+`, `#`, `%`, `_` and backslash terms must also match literally: `C++` does not silently become `C`, and `%` is not a wildcard. Exact identity/ID matches rank first, then identity prefixes/partials, then fuzzy and weighted lexeme matches. Candidate/company/title outrank descriptions/notes. Explicit sort choices replace relevance sorting; the record UUID is the deterministic tie-breaker. Short queries can be broad and do not use fuzzy matching.

Dates are inclusive **UTC calendar days**, implemented as a start-inclusive, next-day-exclusive range. The search UI labels this convention. Scheduled timestamps display in the browser's time zone alongside the stored IANA time zone/offset. Upcoming means lifecycle Scheduled with `scheduled_at >=` the response's `asOf` time, optionally narrowed by date range. Feedback pending means explicit Feedback Pending or Completed with no feedback revision. Follow-up filters use the existing **open workflow tasks**, independently of stored historical follow-up dates: Bids use bid-level tasks, Interviews use that round's tasks. Overdue is strictly before `asOf`; Due through today includes earlier overdue tasks and the remainder of the current UTC day. Completed/cancelled tasks disappear from these filters even when a historical date remains on the record. Completion and outcome remain independent.

## API and authorization

`GET /api/v1/bids?organizationId=<uuid>&search=true` and the equivalent `/interviews` return `{items,total,page,pageSize,asOf,options}` in the usual uncached API envelope. Each item contains the unchanged `record` contract and scoped candidate/company/title/owner/team display fields. Existing clients without `search=true` retain their original response contracts. Page size defaults to 25 (maximum 100). Invalid or duplicate parameters receive actionable 400 errors. Filter names and types are in `packages/contracts/src/workflow-search.ts` and `apps/web/src/lib/workflow/search-input.ts`.

The API resolves current membership, then calls `search_workflow` with the caller's authenticated Supabase client. The RPC is **security invoker** and validates direct requests too. Counts/pages/options come from the same statement snapshot and RLS-scoped relation. Options describe authorized records across the current organization, independently of selected filters, so a user can change a filter without losing other legitimate options. A selected hidden reference produces no hidden names or results.

Bidder interviews are denied by both API and RPC. Candidate names for Bidders reuse the existing `bid.prepare` safe projection under its column-limited, non-owner, NOBYPASSRLS reader; submit-only/export-only grants do not gain profile/name access. Owner names remain subject to the existing self/Admin roster RLS; readable owner IDs are searchable and use a labeled reference rather than broadening roster access. Related records are joined live, so committed candidate renames, changed job details, feedback append and permission revocation affect subsequent searches immediately. Repeating the same query with Enter refreshes current results. No service-role key, cache, search daemon or queued reindex is involved.

## Migration

Apply **`supabase/migrations/20261021000200_workflow_search.sql`** after the existing 28 migrations. It adds functions, `pg_trgm` if absent, GIN full-text/trigram expression indexes and date indexes; it does not rewrite business data, change table RLS, reset the database or alter document snapshots. Source expressions are queried directly; PostgreSQL chooses plans according to selectivity/statistics/RLS. Short/literal-only queries and exact scoped counts/options can require scans. Large-tenant performance/load acceptance is not established by synthetic correctness tests. Creating indexes takes locks; schedule a maintenance window for a large populated deployment.

With Node 24/npm 11 installed and the existing Supabase CLI login available, from the repository root:

```powershell
npm exec --no -- supabase login
npm exec --no -- supabase link --project-ref xsyxlxpsglhkmvzlmhih
npm exec --no -- supabase migration list --linked
npm exec --no -- supabase db push --linked --skip-vault --dry-run
npm exec --no -- supabase db push --linked --skip-vault
npm exec --no -- supabase migration list --linked
npm run dev
```

Reuse the existing link if correct. Check history/drift and the dry-run list before applying; stop on conflicts instead of repairing/resetting. These CLI commands use CLI authentication and do not automatically load Next's `.env.local`. Never pass passwords, keys or connection strings in command arguments. On this workstation the CLI login role works; the separately saved DB-password credential was not validated, and is not required for that login-role path. No new web environment variable is required. Preserve `apps/web/.env.local` and existing public settings. Docker remains optional; isolated CI owns destructive synthetic reset/test operations.

## Verification

Focused unit tests cover parsing/normalization/unsafe parameters. `supabase/tests/150_workflow_search.test.sql` is rollback-only and covers real invoker RLS with two organizations, two teams, all four roles, ranking/typos/related fields, combinations, UTC boundaries, paging/counts, live edits, restricted field inference and direct RPC denial. `test-workflow-search.mjs`, invoked by the guarded isolated CI harness, exercises real Auth/API persistence plus Chromium URL/debounce/Enter/filter/chip/pagination/reload, failures/retry, stale responses, permission messages, interview search, navigation and mobile controls. Existing workflow acceptance still runs.

Current execution evidence is recorded in [PROGRESS.md](PROGRESS.md). Native browser inventory returned no enabled surfaces on this computer; opening the in-app browser reported unavailable. Authenticated local screen inspection therefore depends on the real isolated Chromium suite and the following manual hosted check.

After the migration, sign in at `http://localhost:3000/sign-in`. With synthetic candidates/bids in authorized teams: search a candidate/company/title typo and an ID; combine status, owner/team, priority/date/follow-up filters; page/sort/reload; follow a bid to its interview rounds and search the same company; verify UTC boundaries, current feedback and separate outcome. Repeat in distinct browser profiles for Member, other Team Leader and Bidder. Verify inaccessible names/options/counts never appear and Bidders receive no interview access. Use browser network offline mode to verify error/retry, then restore connectivity. Hosted interactive verification and representative load measurement must be reported separately from CI.
