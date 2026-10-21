# Deployment evidence register

Date: 20 October 2026. Source branch: `codex/pilot-release`.

**No hosted production deployment has occurred. No real data is authorized.** The operator has not supplied a production project reference, Render workspace/service/domain, budget approval, management authentication or retention authority. A public development key is not management authorization. `supabase projects list` returned missing CLI authentication; Docker/PostgreSQL client tools are unavailable on this computer.

| Check | Result / evidence |
| --- | --- |
| Production/development separation | Code rejects the known development reference and requires explicit matching production URLs. No project has been created/linked/migrated. |
| Proposed runtime/configuration | Render native Node `render.yaml`, guarded build/start, exact origin and pinned public extension identity committed. Blueprint provider validation needs an authenticated workspace. |
| PD01 isolated regression | [41d04d4](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39513804221): 27 migrations, 276 SQL, 56 app unit tests, both builds, 2,141 API assertions, 86 headless browser checkpoints pass. |
| Final isolated pilot verification | [7b8ef7f passing run](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39519454292): 27 migrations, 276 SQL assertions, 58 unit tests, 2,153 Auth/API assertions and 86 headless browser checkpoints. All 11 reusable pilot smoke checkpoints pass against the real isolated backend. |
| Backup implementation / actual isolated restore | AES-GCM backup restores **73 tables**, **15 stored PDFs / 220,336 bytes**, private signing keys, owners, grants and RLS. Every PDF matches its immutable SHA-256/byte count; administrator access and bidder/unrelated denials pass. Backup **3.939s**, restore **0.964s**, excluding hosted provisioning/download/operator validation. Initial limited-role/default-public-schema restore failures were fixed without production privilege changes. |
| Clean-checkout production build / release ZIP | Independent CI job passes fresh `npm ci`, guarded production web/MV3 builds, deterministic **11-file** ZIP/Python CRC/hashes, **39** client-file secret scans and **three** real Chromium identity/IndexedDB restart checkpoints. Fictitious public configuration is isolated test input, never a deployed project. Test ZIP SHA-256 `246360538720f4c7c079eb1a2563fd33a558ee2f77a77f4735427b253a4fab4c`; it is **not a production-configured distribution**. |
| Source release / production artifact | Release candidate `v0.2.0-pilot.1` / manifest `0.2.0` has stable unpacked identity `egidlmfmpaelbkicmhoheoonleejbfkg`. Tagged workflow rechecks source. Actual production ZIP/draft release remains disabled until real project/API configuration and operator gates are supplied. |
| Hosted initial synthetic smoke | **Not run**: missing production project/service and authorized synthetic test credentials/team. The reusable script is prepared and will also run in isolated CI. |
| Physical platform / load / retention | Pending manual evidence and owner decisions in [ACCEPTANCE.md](ACCEPTANCE.md). |

Append each actual deployment with UTC timestamp/operator, full source commit/tag, service ID/domain/region/plan, production project reference/major version, reviewed migration inventory, key ID, release ZIP hash, synthetic smoke result, manual Chrome/Windows versions and results, accepted quota/budget/retention/RPO/RTO policy IDs, offsite backup receipt and restore timings. Never record passwords, private keys, Auth tokens, recovery URLs or candidate content.

Recovery commands, validation/cutover and rollback instructions: [PILOT_DEPLOYMENT.md](PILOT_DEPLOYMENT.md), [RECOVERY.md](RECOVERY.md). Remaining prerequisites are release blockers, not implicit passes.

Local checks: root `npm run check` (56 app + two release/recovery tests), subsequent changed-script lint/release tests and `git diff --check` pass. `npm audit --omit=dev --audit-level=high` reports **zero vulnerabilities** after the network-sandbox retry. The prior development-only lint-chain advisory remains documented in README; no unsafe dependency downgrade was performed. Native PostgreSQL/Docker checks run in isolated CI rather than this computer. Documentation local links resolve. No production secrets or real candidate data were committed, and ignored development env values were preserved.
