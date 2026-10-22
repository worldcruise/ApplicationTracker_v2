# Database migrations

`20261021000200_workflow_search.sql` adds Application Tracker v2's invoker/RLS Bids and Interviews search and source indexes. Apply in timestamp order after the registration migration; see [search setup and verification](../../docs/WORKFLOW_SEARCH.md). Never reset or blindly repair hosted history.

The migrations establish permissions/accounts, candidate profiles and immutable revisions, scoped prompts/templates, frozen resume/letter storage/export, bid/interview workflows and immutable submissions, operations, registration approval and scoped search. See [document storage/key prerequisites](../../docs/RESUME_WORKFLOW.md). Add further timestamped SQL migrations here with `npx supabase migration new <name>`.

Every database change, including constraints, RLS policies, grants, helper functions, and command functions, belongs in a migration. Never enable client access to a business table without its scoped backend and database rules.

The default application workflow targets hosted development without Docker. See [hosted migration and verification instructions](../../docs/HOSTED_SUPABASE.md#hosted-migrations-without-docker) for CLI authentication, linking, drift review, dry runs, and explicit application. Isolated CI starts Supabase and verifies replay plus allowed/denied access using rollback-only synthetic fixtures. The web public key does not authorize migrations. The existing development project currently has all **29 migrations** applied; verify current history before any later change. Read the [foundation operator runbook](../../docs/FOUNDATION.md) before bootstrap or onboarding; do not repeat the existing first-Admin setup.
