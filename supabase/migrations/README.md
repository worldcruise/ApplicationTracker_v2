# Database migrations

The migrations establish foundation permissions/accounts, full candidate profiles and immutable revisions, scoped prompts/templates, immutable resume/letter sources and private frozen PDF storage/export. Bid and interview tables remain minimum permission anchors; their full workflow/submission tasks remain in BUILD_PLAN.md. See [document storage/key prerequisites](../../docs/RESUME_WORKFLOW.md). Add further timestamped SQL migrations here with `npx supabase migration new <name>`.

Every database change, including constraints, RLS policies, grants, helper functions, and command functions, belongs in a migration. Never enable client access to a business table without its scoped backend and database rules.

The default application workflow targets hosted development without Docker. See [hosted migration and verification instructions](../../docs/HOSTED_SUPABASE.md#hosted-migrations-without-docker) for CLI authentication, linking, drift review, dry runs, and explicit application. Isolated CI starts Supabase and verifies replay plus allowed/denied access using rollback-only synthetic fixtures. The web public key does not authorize migrations. These migrations have not been applied to hosted development by the implementation task. Read the [foundation operator runbook](../../docs/FOUNDATION.md) before bootstrap or onboarding.
