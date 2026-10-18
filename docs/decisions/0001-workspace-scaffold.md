# Workspace scaffold scope and pending decisions

Date: 17 October 2026. Status: scaffold choices accepted through the user's implementation request; product policies remain pending.

The user explicitly selected npm workspaces, Next.js/React/TypeScript/Tailwind for the web, TypeScript Manifest V3 for the extension, four shared packages, and a local Supabase configuration/test boundary. These choices implement T002 and the architecture in design sections 2 and 21. The shells do not expose candidate records or provide authentication, submission, saving, synchronization, or database business features.

## T001 dispositions

The [comparison and decision register](../BUILD_PLAN.md#requirements-comparison-and-decision-register) remains authoritative for statements, owner roles, and affected implementation gates. No source requirement has been edited.

- C01 remains pending with Product before candidate completeness validation. Phone requiredness and Draft/Ready rules do not affect the scaffold.
- G01 remains pending with Product and Engineering before T004 validation semantics. The v1 schema may be copied unchanged into the contracts package as a reference; no validator or completeness policy is implemented by this scaffold.
- G02 and G10 remain required coverage for their feature tasks. G03–G07 are recorded compatible refinements; G08 awaits approval/grant policies; G09 remains a budget/readiness constraint. None is resolved by an empty application shell.
- D01–D02 remain pending with Product/Desktop Engineering and compatibility spikes T006–T008. No archive or browser-support claim is made by a successful build.
- D03–D04 remain pending with Admin/Product/Operations before generation/export grants and approvals. No authenticated role or permission is simulated.
- D05–D07 remain pending with Data/Product/Operations/Engineering/Business before retention, exact-PDF handoff, hosting, backup, and production release. Local Supabase is development infrastructure only.
- D08–D10 remain pending with Operations/Product/Team Leads/Engineering/Initial Administrator before matching, accuracy review, and administrative onboarding.
- D11 remains pending with Product and Engineering before input-limit contract freeze and pilot acceptance. Build-tool requirements are not product input or load limits.

These are owner roles requested by the source design, not assignments to invented individuals. Unresolved decisions block only their named feature gates. T001 is complete as a reviewable record of explicit pending dispositions; the user has authorized the independent T002 scaffold.

## Scaffold boundaries

Shared packages have explicit exports and dependency direction: contracts, then domain/resume-engine, with UI independent of server code. Builds produce local artifacts; application shells consume these workspace packages. No privileged credential is embedded in either client, and no browser host permission is requested before a feature needs it.

Database changes remain migration-only. The scaffold adds configuration and a rollback-only infrastructure test; business tables, grants, command functions, and RLS policies belong to later tasks. A successful infrastructure test will not establish the application authorization model.
