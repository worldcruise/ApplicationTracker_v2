# Project instructions

Application display name: **Application Tracker v2** in UI, page titles and documentation. Keep the repository/folder name `ApplicationTracker_v2` and existing internal package identifiers.

Read [docs/PROGRESS.md](docs/PROGRESS.md), [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md), [docs/DESIGN.md](docs/DESIGN.md), and the relevant requirements in [doc/PRD.md](doc/PRD.md) before working. Original sources remain in `doc/`; implementation context lives in `docs/`.

- Use the documented architecture: TypeScript monorepo, Next.js web and `/api/v1`, Chrome Manifest V3 extension, Supabase Auth/PostgreSQL, and shared contracts and resume engine.
- Current Stage 1 is localhost-first web/API with hosted development Supabase project `xsyxlxpsglhkmvzlmhih`, without Docker. Follow [docs/LOCAL_PILOT.md](docs/LOCAL_PILOT.md); public hosting, domains and production provisioning are deferred. Retain completed features and treat extension authentication as a separate later workflow.
- Preserve canonical resume schema v1. Keep schema metadata outside its content object; introduce changes through explicit versioning.
- Implement one scoped build-plan task at a time, respecting dependencies and acceptance criteria. Record requirement conflicts and unresolved decisions; do not silently choose or rewrite requirements. Continue work that does not depend on their resolution.
- Enforce permissions in both backend and database, including organization, team, assignment, and bidder field scope. Use authenticated user context for ordinary requests.
- Use versioned migrations for every database change, including constraints, policies, functions, and grants.
- Preserve immutable document versions, approvals, submissions, and history. Later edits must not alter earlier submitted snapshots.
- Track validation, PDF generation, local saving, database synchronization, and clipboard results independently. Preserve operation IDs and frozen payloads across retries.
- Never treat saving a package as submitting an application. Submission requires an explicit authorized action and its own immutable event.
- Keep secrets out of source control, client bundles, logs, and archive metadata. Privileged credentials stay server-side.
- Use only synthetic candidate data in development, fixtures, examples, and tests.
- Run checks relevant to the task. Report results and checks that could not run, with reasons; do not claim unverified behavior.
- Update `docs/PROGRESS.md` after each completed task with evidence, decisions, blockers, and the next scoped task.

Automatic application submission, paid AI integration, native Windows integration, and store publication remain deferred as documented. Do not begin implementation when the active request is limited to implementation context.
