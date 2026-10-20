# Web and extension pilot releases

Release candidate: **v0.2.0-pilot.1**, extension manifest **0.2.0**, API **v1**, canonical resume schema **1**, renderer **template-engine/2.0.0**. `releases/pilot.json` and the release manifest bind these versions to one commit and ordered migration checksums. Source tags do not prove deployment or manual acceptance. Initial distribution is unpacked desktop Chrome; Chrome Web Store publication and CRX signing are deferred.

## Supported clients and identity

The web/API retains v1 behavior for **0.1.x and 0.2.x**, including old 0.1 clients without the new version header. New calls identify `X-Candidate-Client: extension/0.2.0`; unsupported declared clients receive **426 CLIENT_UPGRADE_REQUIRED** before mutation. Legacy clients remain bounded by current authentication/permissions. Retiring unversioned/0.1 support requires a separate announced decision and an update/recovery window; no retirement date is invented here. Database changes remain additive while these versions are supported. Do not remove fields, commands, idempotency receipts, document versions or old renderer verification keys in a deployment rollback.

Production unpacked identity is pinned by committed **public** RSA SPKI key: `egidlmfmpaelbkicmhoheoonleejbfkg`. No private signing key was generated for distribution or committed; this pins unpacked identity only. Keep the public key and identity on every compatible build. Changing key/ID creates a different extension origin and storage namespace. Existing unkeyed development extensions have different IDs and must not be silently reconfigured to replay development operations into production. Same email in different Supabase projects is not the same account. Keep the old profile/root/journals available for authorized reconciliation.

## Build from the tagged checkout

Use a **clean** checkout, Node 24.22.0/npm 11.19.1, and the public production extension settings from `deploy/production.env.example`. A private ignored `.env.extension.production.local` may contain only:

```dotenv
EXTENSION_BUILD_PROFILE=production
PRODUCTION_SUPABASE_PROJECT_REF=<separate-production-ref>
EXTENSION_PUBLIC_API_URL=https://<production-host>/api/v1
EXTENSION_PUBLIC_SUPABASE_URL=https://<production-ref>.supabase.co
EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production-public-publishable-key>
```

```powershell
git checkout v0.2.0-pilot.1
npm ci
npm run check
node --env-file=.env.extension.production.local apps/extension/scripts/build.mjs
node --env-file=.env.extension.production.local scripts/release-extension.mjs
python scripts/verify-release.py output/releases/0.2.0-pilot.1
```

The direct extension build requires built shared packages; `npm run check` builds them above. Alternatively with these public settings already in the shell use `npm run extension:build` then `npm run release:extension`. Production profile bypasses local development env fallback and refuses the known development project. Packaging requires clean Git state, exact version/key, an allowlisted file set, complete local fonts/assets, no development reference or supplied private credential bytes, and expected public endpoints. It emits ZIP, `release.json` and `SHA256SUMS` beneath ignored `output/releases/0.2.0-pilot.1/`. The manifest includes each file's SHA-256 plus source/migrations/schema/renderer/identity. The ZIP verifier independently checks CRC, paths and file/archive hashes. Protect published assets against overwrite; create a new version/tag for any change.

CI `clean-release` runs from its own fresh checkout and `npm ci`, without `.env.local` or prior build outputs. It builds production-mode web/MV3 with **fictitious public configuration**, packages twice, verifies identical ZIP bytes with Python, starts actual unpacked Chromium with pinned identity and checks an original-account/frozen-operation marker across restart. It blocks external browser requests. Those test ZIPs are not uploaded as a production extension and do not prove hosted connectivity. The database CI job separately tests the actual isolated Auth/API/RLS/workflow and encrypted restore.

## Tag and configured release workflow

After full checks pass, create an immutable annotated tag on the reviewed commit:

```powershell
git tag -a v0.2.0-pilot.1 <verified-full-commit> -m "Synthetic pilot source candidate; see deployment and acceptance gates"
git push origin v0.2.0-pilot.1
```

`.github/workflows/pilot-release.yml` verifies the tagged source through the full isolated workflow. **Production packaging is disabled** until an operator sets repository variable `PILOT_RELEASE_ENABLED=true` and the `pilot-production` GitHub environment's four public production variables above (excluding `EXTENSION_BUILD_PROFILE`, already fixed by workflow). Use protected environment reviewers and branch/tag protections. No service-role, DB password, document key or test password is needed for extension packaging.

Once actual deployment/smoke/manual prerequisites are reviewed, run **Pilot extension release → Run workflow**, entering the existing immutable tag. The workflow verifies that exact tag, builds the configured ZIP and creates a **draft prerelease** with checksums/metadata. No existing release asset is overwritten. Review the public API/project/extension ID and release evidence before publishing that draft to pilot testers. The enabled flag is an operator assertion, not automated certification of manual gates. Tag/code verification can pass while production packaging remains explicitly **not run**.

## Chrome installation, reload and rollback

1. Download all three release artifacts from the approved release, compare ZIP SHA-256 to `SHA256SUMS` through an independently trusted release channel, and run the verifier when Python/source are available. Extract ZIP to a stable directory with `manifest.json` at its root. Never import an unknown backup, session file or private credential.
2. In desktop Chrome open `chrome://extensions`, enable Developer mode, **Load unpacked** and choose that directory. Confirm ID `egidlmfmpaelbkicmhoheoonleejbfkg`, version 0.2.0 and the expected API/Supabase hosts in Details. `Ctrl+Shift+F` conflicts are managed in `chrome://extensions/shortcuts`; a physical Windows gesture test is still required.
3. Open the full workspace through the toolbar. Sign in using the designated synthetic account in the production project. Select its organization/candidate; compare the web link to the production origin. Test every role with current scopes, including denied raw bidder profile/feedback and frozen export-only access.
4. Follow [EXTENSION_WORKFLOW.md](EXTENSION_WORKFLOW.md), [QUICK_APPLICATION_CHECK.md](QUICK_APPLICATION_CHECK.md), [ARCHIVE_PACKAGES.md](ARCHIVE_PACKAGES.md) and the acceptance matrix: exact prompt/JSON/PDF, same-byte historical export, selected Windows archive root/reopen/renewal, capture, denied/cancelled picker/clipboard, offline save/sync split, restart/timeout retry with the original operation ID, and explicit submission only. Native filesystem/power-loss/load evidence cannot be replaced by the headless test.
5. For an update, allow active writes to settle, retain the same directory/ID/profile, replace application files with the verified version and use **Reload** in Chrome. Browser-session Auth may require signing in again; IndexedDB drafts/pending operations remain. Revalidate original account/project/current permissions before sync. Do not uninstall, clear site data or copy another account's queue. Keep the previous verified ZIP and release metadata for rollback.
6. Roll back web to the prior compatible commit and reload the prior extension files with the same identity/profile. Never reverse applied migrations or replay submissions to recover an archive operation. If compatibility/recovery fails, pause writes and follow [RECOVERY.md](RECOVERY.md).

Only record a manual check as passed with exact Chrome/Windows versions, build hash, synthetic account role/scopes and observed result; exclude account secrets and candidate content from evidence.
