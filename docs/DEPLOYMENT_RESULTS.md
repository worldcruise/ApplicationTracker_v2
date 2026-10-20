# Deployment evidence register

Date: 20 October 2026. Source branch: `codex/pilot-release`.

**No hosted production deployment has occurred. No real data is authorized.** The operator has not supplied a production project reference, Render workspace/service/domain, budget approval, management authentication or retention authority. A public development key is not management authorization. `supabase projects list` returned missing CLI authentication; Docker/PostgreSQL client tools are unavailable on this computer.

| Check | Result / evidence |
| --- | --- |
| Production/development separation | Code rejects the known development reference and requires explicit matching production URLs. No project has been created/linked/migrated. |
| Proposed runtime/configuration | Render native Node `render.yaml`, guarded build/start, exact origin and pinned public extension identity committed. Blueprint provider validation needs an authenticated workspace. |
| PD01 isolated regression | [41d04d4](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39513804221): 27 migrations, 276 SQL, 56 app unit tests, both builds, 2,141 API assertions, 86 headless browser checkpoints pass. |
| Backup implementation | Local AES-GCM encryption/authentication/corruption/overwrite checks pass. Populated restore evidence pending subsequent CI; [RECOVERY.md](RECOVERY.md) identifies hosted/global-role/escrow limitations. |
| Clean-checkout production build / release ZIP | Pending PD04 independent CI job; fake public configuration there is explicitly isolated test input, never a deployed project. |
| Hosted initial synthetic smoke | **Not run**: missing production project/service and authorized synthetic test credentials/team. The reusable script is prepared and will also run in isolated CI. |
| Physical platform / load / retention | Pending manual evidence and owner decisions in [ACCEPTANCE.md](ACCEPTANCE.md). |

Append each actual deployment with UTC timestamp/operator, full source commit/tag, service ID/domain/region/plan, production project reference/major version, reviewed migration inventory, key ID, release ZIP hash, synthetic smoke result, manual Chrome/Windows versions and results, accepted quota/budget/retention/RPO/RTO policy IDs, offsite backup receipt and restore timings. Never record passwords, private keys, Auth tokens, recovery URLs or candidate content.

Recovery commands, validation/cutover and rollback instructions: [PILOT_DEPLOYMENT.md](PILOT_DEPLOYMENT.md), [RECOVERY.md](RECOVERY.md). Remaining prerequisites are release blockers, not implicit passes.
