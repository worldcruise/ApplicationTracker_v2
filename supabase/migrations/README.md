# Database migrations

No application schema has been created by the scaffold. Add timestamped SQL migrations here with `npx supabase migration new <name>` when implementing the database tasks in BUILD_PLAN.md.

Every database change, including constraints, RLS policies, grants, helper functions, and command functions, belongs in a migration. Apply and test from an empty local database. Never enable client access to a business table without its scoped backend and database rules.
