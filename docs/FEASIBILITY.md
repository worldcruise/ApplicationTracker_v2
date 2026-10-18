# Phase 0 feasibility evidence

Updated 17 October 2026. Scope: the explicitly requested F001A–F001C probes, using only synthetic data. All three code increments and available automated checks are complete. **Live Chrome/hosted-user acceptance remains pending**, so T006–T008 are not marked complete. Business authorization and canonical validation prerequisites remain in the build plan.

| Probe | Implementation/check status | Live Chrome status |
| --- | --- | --- |
| F001A extension Auth | Code/tests/build pass. User selected an existing email/password test account; hosted Auth confirms email enabled and OAuth providers disabled. | Pending: no browser exposed and no live account credentials entered. PKCE/provider redirect gate is not exercised by password sign-in. |
| F001B directory handle | Code/tests/build pass. Picker, IndexedDB schema v1, reopen query and explicit renewal implemented. | Picker, real handle structured cloning, permission renewal/restart and cross-tab behavior unverified. |
| F001C PDF bytes/preview/export | Code/tests/build pass; actual two-page PDF generated, parsed and rendered with PDF.js, then both page images inspected. Preview/export preserve the same frozen bytes/hash. | Extension canvas/CSP/worker loading and actual directory/download behavior unverified. |

The public settings endpoint reports hosted signup enabled (`disable_signup=false`), whereas invite-only onboarding is the proposed design default. The probe uses existing accounts only and does not offer signup or change hosted settings; an authorized owner must resolve onboarding configuration before production.

## Evidence rules

Mocked Auth/Chrome/permission APIs establish implementation behavior only. Fake IndexedDB tests serializable records, not real FileSystemDirectoryHandle cloning. Node PDF.js rendering does not establish extension CSP compatibility. Empty database/table results do not prove authorization. A local PDF save is not database synchronization or application submission.

## F001A implementation and automated evidence

The extension build copies only the public Supabase URL/publishable key from the existing web `.env.local`, unless explicit `EXTENSION_PUBLIC_*` overrides are configured. Real values stay in ignored local files/build artifacts; source examples remain placeholders. The manifest requests `storage`, the configured Supabase/API hosts, and a CSP with exact connection origins. Chrome host permissions do not scope ports, so loopback CSP is the narrower network boundary.

The full workspace signs in with `signInWithPassword` and verifies identity through `getUser`. It does not offer signup, create accounts, copy web cookies, or expose tokens to content scripts, URLs, messages, DOM, archives, or logs. `chrome.storage.session` is restricted to `TRUSTED_CONTEXTS`; Chrome clears it on restart/reload. UI Auth operations use a cross-workspace Web Lock, with SDK auto-refresh timers disabled. Supabase 2.118 uses its current lockless coordination internally; the deprecated custom SDK lock option is not used. Necessary state is in session storage, not worker globals.

`GET /api/v1/feasibility/identity` verifies the actual bearer token with the same Supabase project's Auth service and returns only the user UUID/project reference and an explicit identity-only marker. It is disabled unless enabled in development and always returns 404 in production. It requires an exact configured Chrome-extension origin; no wildcard CORS or cookie credentials. It does not query application tables or replace membership, assignment, capability or RLS checks. Only this safe GET may retry once after a 401/refresh; no write is replayed.

The user specifically selected an existing email/password account. This direct supported Auth flow does not use a PKCE callback. The design's proposed PKCE/state/allowlisted-redirect proof remains a separate T006 gate, requiring an enabled OAuth/provider decision or an explicit accepted replacement. No `identity` permission, signup UI, OAuth provider, redirect allowlist, or account was created for this probe.

## F001B directory implementation

`showDirectoryPicker({ mode: 'readwrite' })` is called directly from a button on the full workspace page, before asynchronous storage work. The handle is saved in IndexedDB database `candidate-phase0`, schema migration version 1, record `archive-directory`. Each workspace reopen reads that handle and calls `queryPermission`; it never prompts automatically. **Renew permission** calls `requestPermission` directly from the user's gesture. Every PDF write rechecks permission. Permission denied, prompt required, cancelled selection, unsupported context and failed checks have distinct messages; failed checks never mean no prior selection.

Connections close after transactions; no database connection, folder selection or operation result depends on a service-worker global. The worker remains a bounded action-click → open-workspace handler. It does not own Auth, file handles, polling, or PDF tasks.

## F001C PDF and frozen snapshot implementation

The shared resume engine provides a synthetic-only single-style renderer using pdf-lib 1.17.1/fontkit 1.1.1. Canonical v1's six content keys are unchanged; identity, schema version and render metadata stay outside the content object. The fixture contains Unicode `Zoë García`, five fictional employers, long bullet paragraphs, and education. No real candidate content is read.

Noto Sans Regular/Bold are bundled from the official repository, pinned to revision `ffebf8c1ee449e544955a7e813c54f9b73848eac`; [license and asset hashes](../packages/resume-engine/assets/fonts/manifest.json) are retained alongside [OFL 1.1](../packages/resume-engine/assets/fonts/OFL.txt). Builds verify those hashes. No runtime font download or remote executable script is used. Unsupported font glyphs fail explicitly rather than being replaced; this is not proof of CJK, Arabic, emoji or every writing system.

Generated bytes, hash, operation UUID, fixture, font hashes and render/template identifiers are appended as immutable `sample-pdf:<uuid>` records. An active pointer commits in the same IndexedDB transaction. Earlier snapshots are retained. Outcome records are separate and merge atomically so local-save/download state does not overwrite another field. Database synchronization remains `not-attempted`; no submission event exists.

PDF.js 6.4.299 uses an explicitly created local module Worker port, avoiding its cross-origin Blob-wrapper heuristic. WASM is disabled and no unsafe-eval or Blob-worker CSP is granted. The preview receives `bytes.slice()` because PDF.js consumes/transfers its input. Exports use the original frozen bytes and verify their SHA-256 before use. Directory writes close the stream and read/hash the resulting file. An identical retry reuses the existing file; different/incomplete bytes at that operation's filename are refused rather than silently overwritten. Web Locks serialize writes for the same operation. Anchor downloads say **Download initiated**, never confirmed saved.

The workspace reopens from its persisted snapshot/outcomes. A page close can leave a `pending` result; retry the same operation to verify an identical file. Interrupted partial files require manual inspection/cleanup; full transactional package recovery is not implemented. If a file is verified but result journaling fails, the UI reports those outcomes separately.

### Generated artifact and measurements

Run `npm run feasibility:pdf` to regenerate [the synthetic sample](../output/pdf/phase0-synthetic-resume.pdf) and ignored page images under `tmp/pdfs/`.

| Measurement | Observed result |
| --- | --- |
| Environment | Windows host; Node 24.22.0, npm 11.19.1. No Chrome version tested. |
| Pages / bytes | 2 / 21,985 |
| PDF SHA-256 | `137e585fe66fdeff6913bbf8829cd98d8fcba91433f7f849375184e9e8ce0b6c` |
| Timed PDF generation | 358 ms in the first successful Node QA run after fonts were loaded; not a browser/D11 performance result. |
| Selectable text | 51 nonempty text items; Unicode name, all five employer labels and Education extracted. No replacement glyphs. |
| Layout | All extracted text within page bounds. Both 1.5× PNG pages visually inspected: no clipping, overlap or missing glyphs. |
| Determinism / byte reuse | Repeated render hash identical with pinned fixture/fonts/metadata. PDF.js consumed only a copy; original export hash unchanged. Download Blob and directory-write tests match that hash. |

## Available verification results

- `npm run check` passes lint with zero warnings, all package/application type checks and **16 tests**: 2 domain, 5 web, 9 extension. Coverage includes trusted storage restore/reset, safe GET retry/identity mismatch, API guards, IDB persistence/immutable collisions/independent state merges, permission transitions/no automatic prompts, exact bytes/readback/retry/collision refusal, and unsupported glyph rejection.
- `npm run build` passes shared packages, Next web/API/proxy, and MV3 extension. `npm run extension:build` passes after each code increment. The existing environment's filesystem sandbox required the bundler to run outside it.
- `npm run feasibility:pdf` passes PDF.js text/layout/render checks and repeated-hash checks. The initial QA script used a PDF.js cleanup method removed in v6; it was corrected to destroy the loading task, then rerun successfully. The earlier removed `isEvalSupported` option was also caught by type checking and removed; current v6 does not expose that option.
- Real local Next HTTP checks, with an enabled development probe and synthetic extension origin: wrong origin → 403; allowed origin without bearer → 401; allowed preflight → 204; production with the flag set → 404. No-store/CORS headers verified. No real token was submitted.
- Hosted Auth public settings were read successfully; email enabled, OAuth providers disabled, signup enabled. This is service/configuration evidence, **not** authenticated identity/RLS evidence.
- Runtime dependency audit reports zero vulnerabilities. The previously documented development-only braces advisory remains tracked.

## Manual Chrome testing instructions

Use desktop Chrome on Windows with only a dedicated synthetic account and disposable test folder. Record Chrome version from `chrome://version`, Windows version, extension ID, date and each actual result below. Do not record passwords, cookies, tokens or private screenshots. Current browser inventory exposed no browser to this session, so every step below is **pending**, not passed.

### Build and open

From the repository root with Node 24/npm 11 available:

```sh
npm ci
npm run check
npm run extension:build
npm run dev
```

Use `npm.cmd` on PowerShell if script execution is blocked. This working copy's ignored portable runtime can be added with `$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH`. No Docker is required.

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist`. Reload the extension after rebuilding. Click its action to open the full workspace tab, not a popup/content-script frame.
2. Verify the displayed public Supabase user/project checks target the existing hosted project; the build reads its public settings from `apps/web/.env.local`. Never add a service-role key. Changing origins/settings requires rebuilding/reloading; manifest/HTML/assets/config changes require restarting the watch command.
3. Copy the **Extension origin** shown in the sign-in card into the web app's ignored `.env.local` as `EXTENSION_ALLOWED_ORIGIN=chrome-extension://<actual-32-letter-id>`. Set `FEASIBILITY_API_ENABLED=true`, then restart `npm run dev`. These are server-only settings; the example defaults the probe to disabled. Do not use the synthetic all-`a` HTTP-test origin.

### A. Existing-account identity and refresh

1. Sign in through the extension form using the existing synthetic email/password account chosen by the user. No signup action should exist. Compare the displayed Supabase UUID with that same account's known Auth UUID; the comparison is by UUID, not matching email or a copied web cookie.
2. Click **Verify shared API identity**. Expect the same UUID/project verified through the bearer endpoint, with application membership/resource access explicitly untested. A web browser session is not created or shared automatically.
3. Click **Refresh and verify**, then check the shared API identity again. Expire/revoke a test session through an authorized test procedure and retry: expect failure/reauthentication, no data access claim and at most one retry of the identity GET. Do not replay mutation requests. Test offline Auth and offline API separately; neither should display successful verification.
4. Open two workspace tabs and exercise refresh/sign-out concurrently. Verify operations serialize, signed-out storage is not resurrected, and a subsequent verification reads the current session. Close the page and stop the service worker, then reopen through the action: the session should be recoverable from Chrome session storage and reverified.
5. Fully restart Chrome, or reload/disable the extension: Chrome's session-storage behavior should require sign-in again. Tokens must be absent from storage.local/storage.sync/IndexedDB, URLs, content scripts, exported files and logs. Inspect privately; do not paste token values.

### B. Directory gesture, persistence and permissions

1. In the Resume view, click **Choose test folder** and select a disposable folder. Expect display name plus read/write `granted`, not an invented absolute path. Cancel a subsequent picker and confirm the prior selection remains intact.
2. Close/reopen the workspace. Expect a stored-handle permission **query**, with no automatic picker/prompt. Record whether actual handle structured cloning and permission persistence succeed on this Chrome/Windows build.
3. Revoke directory access using available Chrome permission controls or restart Chrome. Reopen: `prompt`, `denied`, or a check failure must not be shown as granted/no prior archive. Click **Renew permission** explicitly; allow and deny it in separate attempts.
4. Open a second workspace, recheck permissions, and attempt concurrent saves of the same operation. Remove/move the test directory and test read/write failure. A failed check is unknown/error, not proof that no earlier file exists.

### C. PDF, exact-byte export and failure recovery

1. Click **Generate synthetic PDF**. Confirm the Unicode name, long bullets, both pages, navigation and zoom render in the extension. Inspect the Errors panel for CSP/worker/font failures. The local worker/fonts must load without remote executable code or unsafe-eval.
2. Save to the chosen folder. Expect success only after stream close and hash readback. Download the exact PDF as well; this result must say initiated. Compare both files' SHA-256 with the displayed hash (PowerShell: `Get-FileHash -Algorithm SHA256 -LiteralPath '<downloaded-test-file>'`).
3. Click Save again without regeneration: expect identical-file reuse, same operation UUID/hash, and no silent overwrite. Modify the test file deliberately and retry: expect collision/incomplete-file refusal. Revoke permission and retry: expect failure with no write; database synchronization stays not-attempted.
4. Reopen the workspace: the same active snapshot/hash/outcomes should restore. Generate again: a new operation UUID should append a snapshot while preserving older records. Close during a save and inspect `pending`/partial-file behavior; inspect or remove only the disposable conflicting test file before retrying. No transactional archive recovery is promised.
5. Confirm no save/download action records application submission or performs a database business write. Test local-storage failure separately: a verified file and a failed outcome journal must be reported independently.

## Unsupported behavior and open gates

- No live hosted-user sign-in, browser refresh, real directory handle clone/permission lifecycle, cross-tab Web Lock, or MV3 PDF.js CSP result was observed here. Do not mark D01/D02/T006–T008 accepted from these mocks/builds.
- PKCE/state/redirect integration is not exercised by the user-selected password flow. No OAuth providers are currently enabled. Adopting password sign-in as the production extension flow needs an explicit policy/design disposition.
- No absolute paths, OS-folder opening, native Windows helper, permanent permission, Firefox/Safari/mobile support, or browser-store publication. The `chrome120` bundler syntax target is not a tested client-support guarantee; PDF.js/browser feature support needs actual Chrome testing.
- No arbitrary resume JSON validation/editor, complete provenance/factual review, RTL/CJK/emoji guarantee, production template library, cross-device PDF persistence or published-document workflow. T004/T008/T028 acceptance is not replaced by the fixed fixture.
- No application tables, membership/assignment checks, RLS allow/deny evidence, database synchronization, bid/submission event, automatic submission, or real candidate data. The API probe returns identity only and is always disabled in production.
- Partial files are not silently overwritten; full package recovery, historical snapshot browsing/retention cleanup and automatic background Auth refresh are future work. Clearing extension data removes handles and local snapshots; exported files remain user-controlled.

References: [Supabase password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Chrome session storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [File System Access](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access), [pdf-lib](https://pdf-lib.js.org/), [PDF.js](https://mozilla.github.io/pdf.js/examples/).
