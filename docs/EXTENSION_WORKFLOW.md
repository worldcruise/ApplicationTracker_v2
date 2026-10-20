# Extension Resume and Profile workflow

Bid package saving is documented in [ARCHIVE_PACKAGES.md](ARCHIVE_PACKAGES.md). It uses frozen reviewed sources/prepared exports and independently records local writing, database synchronization, metadata/index reconciliation and path copying. Saving never submits an application.

EX01–EX03 implement the requested subset of design §14 and PRD §13. The full MV3 workspace uses the same Supabase project, user UUID, `/api/v1` authorization, canonical resume v1 and pinned renderer as the web application. The existing email/password test-account flow is retained; web cookies are not copied into the extension. Saving or exporting never submits an application.

## Build, install and reload

Use Node 24 and npm 11 from the repository root. Hosted development requires no Docker.

```sh
npm ci
npm run check
npm run extension:build
npm run dev
```

On PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`. This working copy also has an ignored portable runtime; if needed, add it for the terminal session before these commands:

```powershell
$env:PATH = (Resolve-Path '.tools/node-v24.22.0-win-x64').Path + ';' + $env:PATH
```

1. Configure the two public Supabase settings in ignored `apps/web/.env.local`, preserving existing values. The current working copy targets the supplied hosted development project. Follow [hosted setup and migrations](HOSTED_SUPABASE.md) and [foundation bootstrap](FOUNDATION.md) on a fresh project. Use an existing confirmed synthetic account with active organization/team membership and an authorized candidate assignment.
2. The extension build defaults to those web public settings and `http://localhost:3000/api/v1`. For a different API, set `EXTENSION_PUBLIC_API_URL` in ignored `apps/extension/.env.local`; optional `EXTENSION_PUBLIC_SUPABASE_URL` and `EXTENSION_PUBLIC_SUPABASE_PUBLISHABLE_KEY` override the web settings. Omit unused overrides rather than setting them empty. Rebuild after configuration changes. Use the same project as the API. Only allowlisted public values enter the bundle; never add a service-role key or user token. Supabase distinguishes [public publishable/legacy anon keys from privileged keys](https://supabase.com/docs/guides/api/api-keys).
3. Open `chrome://extensions` in desktop Chrome, enable **Developer mode**, choose **Load unpacked**, and select **`apps/extension/dist`**. Copy the extension's actual ID from its card.
4. Set `EXTENSION_ALLOWED_ORIGIN=chrome-extension://<actual-id>` in the web application's ignored `.env.local`, then restart `npm run dev`. This exact server-side origin allowlist is required for the shared API. `FEASIBILITY_API_ENABLED` may remain `false`; the new workspace uses `/me` and resource APIs, not the development identity probe. A deployed API needs its corresponding server environment setting too.
5. Click the extension action to open the full workspace tab. Sign in to the existing account, select the organization, then select an authorized candidate. Open **Profile** to inspect the summary, profile status/revision, official versus approved titles and active prompt/template configuration. Follow the web link for editing.
6. After rebuilding, click **Reload** on the extension card, then reload/reopen the workspace. Reloading only the page does not update the worker or manifest permissions. Expect sign-in again after extension reload or browser restart; IndexedDB drafts/operations remain associated with that extension origin. Keep the same unpacked path and Chrome profile. Removing the extension, clearing its data or changing its ID/profile loses access to that local storage.

For source watching, first run `npm run build:packages`, then `npm run dev --workspace @candidate/extension`. Shared changes need the root package watcher or another package build. Restart the extension watcher for manifest, HTML, environment, font or worker-asset changes, then reload Chrome's extension. `npm run build` builds both web and MV3 production artifacts.

The current manifest requests `storage`, `clipboardWrite`, `downloads`, plus the subsequent Quick Check `activeTab`, `scripting`, `contextMenus` permissions and configured API/Supabase hosts. Chrome host patterns do not constrain ports; the bundled CSP and API adapter constrain the configured origins. Scripts, validator, PDF.js worker and licensed hash-checked fonts are packaged locally. There are no persistent content scripts, credential messages, externally connectable messages or browsing-history permission. The subsequent [Quick Application Check](QUICK_APPLICATION_CHECK.md) uses bounded user-triggered injection without credentials.

## Prepare a resume or letter

1. In **Resume**, enter target company, target job title and job description, then choose a visible immutable template version. Target company is separate from historical employers. Click **Assemble prompt preview** to freeze authorized candidate facts, scoped prompts, template and job details. **Copy Prompt** writes exactly the displayed text; its result is independent of all saving results. If clipboard access fails, the unchanged preview remains selectable.
2. Paste the generated canonical v1 content object in **Original resume JSON**. Validation reports field paths and preserves the original text, including malformed JSON and unsupported fields. Schema metadata belongs outside the content object. Use the factual-review controls to map entries to verified facts and attest supported paraphrases. Unsupported/conflicting claims stay unresolved; correcting candidate facts belongs in the web workspace. Explicitly permitted Unverified drafts carry a visible watermark and cannot approve submission.
3. **Preview resume PDF** renders locally with the shared engine. The frozen preview displays its hash, profile/template/schema/renderer versions and timestamp. PDF.js receives a copy of the frozen bytes. **Download exact PDF** and the folder export use those bytes without regenerating. A new job/template selection clears the displayed preview; older frozen operations remain available below.
4. **Generate PDF & Save** runs PDF generation followed by independent local export and database synchronization. Select a dedicated synthetic folder through **Choose test folder**, or use Chrome Downloads when no folder was selected. Folder access is rechecked before writing; renewal requires an explicit user gesture. A denied stored-folder permission is reported as a failed local branch, not silently replaced with a successful download. **Save source version** can synchronize without a local PDF.
5. Enter **Cover letter text**, optionally supply an existing authorized bid UUID, complete its separate factual review, then preview or **Save cover letter**. Save renders and exports the letter and appends immutable text/source history plus an exact PDF artifact when configured. Editing creates another operation/version. The bid reference does not record submission.
6. Follow **Full web candidate workspace** or **Authorized document history** for editing and historical retrieval. Archived candidates cannot create/synchronize new content. Their authorized historical versions remain in the web history.

Exact cross-device retrieval requires applied document migrations, matching private server/database signing-key registration, successful original-byte storage, reachable service and current permission. See [render attestation and history prerequisites](RESUME_WORKFLOW.md). Missing signing configuration can leave a saved source with failed artifact synchronization; keep the original operation and retry after configuration. Local PDF success is retained. Reproduction without stored bytes additionally needs the exact renderer/dependencies, fonts/assets and PDF metadata. A hash mismatch fails rather than substituting a new document.

## Recovery and authorization

Wait for **Draft saved locally** before closing. IndexedDB retains per-account/organization/candidate draft text, frozen snapshots, operation UUIDs, payloads, PDF bytes/hashes and independent validation, generation, local-export, database-sync and clipboard outcomes. Cross-workspace locks serialize operations; draft revision checks reject concurrent overwrites. If local storage fails, keep the workspace open and preserve your text before reloading.

An interrupted/unknown synchronization keeps its original UUID and payload. Reopening marks an unconfirmed pending write unknown. Use **Reconcile / retry original synchronization**: the client checks the current user, active membership and current resource permission, looks for that original operation, and retries only as needed. It does not automatically replay queued mutations. Resolve uncertain work before starting a new operation. Switching accounts or organizations neither displays nor replays another scope's work; signing back in restores only that scope. Auth tokens use trusted `chrome.storage.session`, not IndexedDB, local/sync storage or exported metadata. The event-driven worker only opens the workspace and records native download completion from persisted IDs; it performs no authenticated synchronization.

Chrome download initiation is pending, followed by complete/interrupted events and reopen reconciliation. An already running download can finish while the page is closed; that completion can update its original account's local outcome without starting any new work. [Chrome's Downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads) reports transfer state; completion does not promise that a user will keep the file forever. Folder success additionally requires stream close and hash readback. Different existing bytes are never silently overwritten. The selected folder's display name is not an absolute OS path.

Export-only bidders see safe scoped summaries when permitted and authorized prepared documents. They do not get unrestricted profiles, configuration, source JSON, generation, letter editing or interview feedback. A manager must link a reviewed frozen document to an authorized bid; a current candidate/bid `document.export` grant and membership are also required. Every prepared preview/export reauthorizes retrieval and verifies the stored hash. Prepared download results are persisted separately and can be rechecked after reopen. A revoked grant denies subsequent retrieval even if its metadata was previously listed. Previously exported bytes remain user-controlled. “No prepared documents in your current authorized scope” is a scope statement, not proof of global absence.

## Evidence and manual Chrome acceptance

[Isolated CI at f6a9642](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39346365443) applies all 20 migrations and passes 225 pgTAP assertions, 40 unit tests, production web/MV3 builds, all nine template and multipage PDF checks, 1,275 real Auth/API/artifact assertions and 59 headless Chromium checkpoints. Twelve checkpoints load the actual unpacked extension against the production shared API and real isolated Supabase Auth/PostgreSQL/RLS. They cover sign-in/selection/configuration, invalid-text reopen, exact clipboard text, PDF.js preview, downloaded-file SHA equality, a lost response after a committed source save, other-account isolation, revoked assignment, original-operation reconciliation, browser-process restart/sign-in, immutable letter save and export-only download/revocation. The bidder fixture uses the existing protected manager link/grant commands; RLS was not widened.

The harness follows [Playwright's persistent Chromium extension support](https://playwright.dev/docs/chrome-extensions). Positive data paths are real backend requests. Only the lost-response case deliberately replaces a response after the actual commit. Synthetic users and an isolated local service are created in CI; the harness refuses hosted configuration. It does not migrate or test the hosted project and writes no Auth traces/storage-state dumps.

Run these remaining checks in desktop Chrome on Windows with synthetic data. Record Chrome/Windows version, extension ID, date, operation IDs and hashes; keep passwords/tokens out of evidence.

| Check | Expected result / remaining evidence |
| --- | --- |
| Hosted sign-in, selection and Profile | Same known Supabase UUID; only current memberships/assignments; correct configuration and working web link. Requires hosted migrations, accounts and allowlist. |
| Prompt/validation | Copy matches preview exactly, including Unicode/newlines; denied clipboard leaves preview intact; malformed/empty/long JSON remains editable with actionable errors. |
| Same-byte PDF | Inspect pagination/zoom/text and absence of CSP/font/worker errors. Compare downloaded SHA with preview using `Get-FileHash -Algorithm SHA256 -LiteralPath '<synthetic.pdf>'`. Repeat for letters. |
| Closure and unknown synchronization | Close/reopen after locally saved text; retain invalid JSON and frozen bytes. In disposable development, interrupt API connectivity during save, then reconcile the original UUID; one source version, independent local success. |
| Account and scope changes | Switch to another organization/account; no queued work from the first scope. Restore original account; revoke assignment/grant through an authorized admin and ensure synchronization/prepared retrieval is denied. Test expired sessions and offline Auth separately from offline API. |
| Worker/download lifecycle | Stop the extension worker while a disposable large download is pending; reopen/recheck terminal status. Cancel/interruption must stay separate from database success. Repeat extension reload and full Chrome restart; sign-in again, recover drafts. |
| Directory picker | Focus the full extension page; select/cancel a disposable folder, close/reopen, restart Chrome, query permissions without prompting, explicitly renew/deny, move/remove the folder and test readback/collision refusal. Real Windows handle cloning/permission/gesture behavior remains unexecuted here. |
| Concurrent workspaces | Edit the same draft in two tabs: reject stale overwrite with original text retained. Retry one frozen operation in two tabs: no duplicate source or different-byte overwrite. |
| Historical/export-only | Change candidate/template after storing a document; retrieve the original hash from another authorized device. Bidder exports the linked reviewed PDF; source editing/generation and retrieval after revocation are denied. Requires stored bytes and a second device. |

Hosted authenticated testing was not executed: no hosted test session or migration/signing operator credentials were supplied. Interactive Windows, native directory-handle lifecycle, denied-clipboard UI, real worker-stop/OS download interruption and two-device acceptance remain unexecuted. Automated Chromium success is not a Chrome/Windows support certification.

The subsequent [Quick Application Check milestone](QUICK_APPLICATION_CHECK.md) implements reviewed shortcut/context-menu capture, conservative history matching and direct archive lookup/repair. Transactional archive packages remain T050–T053. PKCE/state/redirect integration, absolute paths/OS folder opening, native Windows helpers, paid AI, automatic submission and store publication are not delivered by this milestone. Clearing browser storage removes local recovery state; retention, cleanup, backup and production client-support policies remain explicit release gates.
