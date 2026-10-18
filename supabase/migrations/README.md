# Database migrations

No application schema has been created by the scaffold. Add timestamped SQL migrations here with `npx supabase migration new <name>` when implementing the database tasks in BUILD_PLAN.md.

Every database change, including constraints, RLS policies, grants, helper functions, and command functions, belongs in a migration. Never enable client access to a business table without its scoped backend and database rules.

The default workflow targets the hosted development project without Docker. See [hosted migration and verification instructions](../../docs/HOSTED_SUPABASE.md#hosted-migrations-without-docker) for CLI authentication, linking, drift review, dry runs, and explicit application. Validate migrations and allow/deny tests against a dedicated development/test database; optional local Docker can verify replay from empty. The web public key does not authorize migrations. No database change is part of the SSR configuration task.
