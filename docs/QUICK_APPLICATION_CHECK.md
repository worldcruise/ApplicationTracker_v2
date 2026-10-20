# Quick Application Check

QC01–QC03 implement read-only history checking from design §15 and PRD §24.1–5/9/11: shared capture, review, independent database/archive lookup, matching evidence and scoped index repair. They do not create bids, merge jobs, save complete archive packages or record submission. Those write workflows remain T050–T053. Existing Resume/Profile production and bid/submission controls continue separately.

## Setup and Chrome use

Use Node 24/npm 11 and the existing hosted web configuration. Apply the reviewed `20261020000100_application_history.sql` and `20261020000200_history_submission_snapshots.sql` migrations through the [hosted migration workflow](HOSTED_SUPABASE.md); it adds generated company keys/indexes and an invoker-context read function. Normal requests use the authenticated user and existing forced RLS. No service key belongs in the extension.

```sh
npm ci
npm run check
npm run extension:build
npm run dev
```

On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. Load `apps/extension/dist` at `chrome://extensions`, or click **Reload** after rebuilding, then reopen the workspace. Configure `EXTENSION_ALLOWED_ORIGIN=chrome-extension://<actual-id>` in ignored `apps/web/.env.local` and restart the web server as described in [EXTENSION_WORKFLOW.md](EXTENSION_WORKFLOW.md). Expect sign-in again after extension reload; scoped drafts remain in IndexedDB.

1. Sign in to the existing synthetic account, choose its organization and an authorized candidate, then visit a job page. The most recently selected/focused authorized workspace supplies the candidate context. Select company text and press **Ctrl+Shift+F**, or choose **Check Application History** from its selection context menu.
2. Both events call the same capture workflow. It captures bounded selected company text, the top page URL/title and available job description. It prefers common job-description elements or JobPosting JSON-LD, with a main/article-text fallback. Extracted text is a suggestion, never an authoritative profile fact. Restricted pages/frames or missing extraction open a manual-entry path.
3. The full workspace opens **Quick Application Check** with the captured fields. Review/correct company, title, URL, description and optional external posting ID. The original page title and capture warnings remain visible. No lookup runs until **Check application history**. An unassigned capture requires explicit attachment to the signed-in account/candidate; a capture bound to another scope is not replayed there.
4. Database and local tasks start together using `Promise.allSettled`. Each source updates immediately when it settles. The panel distinguishes company history, exact jobs, possible duplicates/evidence, source state, checked time and authorized bid statuses. Use **Open existing bid** for a strong match or **Open previous authorized bid history**. A local package does not supply a current server status.
5. **Cancel check** dismisses the result without creating or submitting anything. Reviewed draft text persists for its account/organization/candidate/capture. Editing context clears prior results; reopening requires an explicit new lookup instead of presenting cached results as fresh.

The new manifest permissions are `activeTab`, `scripting` and `contextMenus`, alongside the existing trusted storage/clipboard/download permissions and configured API/Supabase hosts. There is no broad job-site host grant, browsing history permission, nonexistent `commands` permission, persistent content script or external messaging surface. Only a user-triggered bounded extraction function runs in the page; it receives no Auth token, user identity or extension storage access. Known authentication query/fragment parameters are removed before capture persistence; reviewed URLs containing them are rejected.

Chrome can leave a suggested shortcut unassigned when another command owns it. The panel shows the actual binding; change it at `chrome://extensions/shortcuts`. See the official [Commands API](https://developer.chrome.com/docs/extensions/reference/api/commands), [selection menu API](https://developer.chrome.com/docs/extensions/reference/api/contextMenus), [script injection API](https://developer.chrome.com/docs/extensions/reference/api/scripting) and [temporary activeTab access](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab). Worker tasks are event-driven; captures and scope hints are persisted instead of depending on worker lifetime. Auth tokens stay in trusted session storage and never enter injected code, page URLs or archive metadata.

## Matching rules and source states

`job-match/1` retains original reviewed values. The API recomputes identifiers; it never trusts client hashes. Company keys use Unicode NFKC, whitespace normalization and case folding. A separate punctuation/legal-suffix key finds possible company-name similarities. Similar names are not verified aliases and cannot establish an exact company or silently merge companies. A managed verified-company/alias registry remains D08 work.

URL normalization uses HTTP(S) parsing, normalized host/scheme/default ports, no credentials, fragment removal and a small explicit tracking-parameter allowlist. It preserves schemes, unknown/job-bearing parameters, their raw encoding/order, duplicate parameters and trailing-slash differences. Generic careers/search pages and hash-routed jobs are not strong URL matches. Posting-shaped URLs can be exact under the same conservative company key when available title/description facts have not changed. Changed facts at a reused URL are possible duplicates. Review confirmed repostings explicitly; this check performs no automatic duplicate override or save.

Description fingerprints include the matching version, conservative company, normalized title and description. Fingerprint-only, similar-title and loose-company results are warnings. Existing bid external IDs lack a reviewed provider-namespace contract, so they are displayed as **unverified external-ID evidence**, not silently promoted to exact matches. Unknown provider semantics are not invented.

The indexed database query is restricted to the current organization/candidate and authorized bids. It returns a narrow projection without candidate profiles, private bid notes or interview feedback. It checks at most the latest 100 matching company observations, including current bid contents and immutable actual-submission job snapshots. Later bid changes cannot hide those prior submitted opportunities. A frozen submission supplies its own event timestamp; current content alone does not imply submission. Truncation is **unknown** for unreturned history; it never proves that an exact job is absent. Server/client normalization disagreement also fails as unknown/error. Bidder history contains only currently readable bids; other-team/org and revoked access are denied. “No match” always refers to the successfully checked authorized scope.

| Source observation | Display |
| --- | --- |
| Authorized successful database query, no returned matches and not truncated | Not found in authorized scope |
| Database network/Auth outage, missing migration or service error | Unknown/check failed; no absence claim |
| Current account/membership/resource denied | Permission required; no absence claim |
| Local root permission denied/prompt | Permission required |
| Root/company map missing, root changed, missing/damaged/unsupported index, incomplete package or hash mismatch | Unknown; link/repair/inspection required |
| Other filesystem I/O failure | Check failed |
| Healthy linked index with verified entries | Found; company/exact/possible results remain separate |
| Healthy linked empty index | Not found among indexed packages, with the advisory-index limitation shown |

## Direct archive lookup and repair

Select the intended root with **Choose history archive root**. Use **Link selected company folder** to select a company directly beneath `CandidateName__CandidateID/` within that root. The link is stored by account, organization, candidate and company key; root identity and containment are rechecked. Linking does not scan or assume that missing folders mean no prior archive. Stored handles do not imply permanent permission; renew it explicitly when requested.

Normal lookup reads the linked company's `archive-index.json` and follows its direct package paths. It never enumerates root/candidate/company folders. The versioned index includes scope, matching version, entries and URL/fingerprint/external-ID maps. Each hit must match its `metadata.json` operation and identifiers. Every required `JobDetails.txt`, `Resume.json` and `Resume.pdf`, plus optional `CoverLetter.txt`, is checked for size and SHA-256. Unsupported versions, unsafe paths, another candidate/org, duplicate IDs, incomplete packages or changed bytes prevent a successful claim. The result's **Open Local Archive** control inspects verified filenames/hashes and relative paths inside the extension; it does not open an OS directory or invent an absolute path.

The index is advisory. Newly added, moved or unindexed packages can require repair; successful index lookup is scoped to verified indexed entries. Flat PDF downloads from the earlier export workflow are not complete archive packages and cannot establish archive absence or submission history.

**Repair linked company index** is an explicit maintenance action. It enumerates only that linked company's immediate package directories, verifies their manifests/files and reconstructs maps. It preserves all package contents. If any entry is unreadable/incomplete or operations conflict, it reports entries and does not replace the existing index. Successful index replacement uses a local lock, closes the write and verifies readback. Root relinking/discovery and repairs across all companies are separate actions; there is no silent recursive search.

Inspection is deliberately bounded: 100 packages, 10 MiB per file, 32 MiB aggregate file bytes, 1 MiB metadata and 2 MiB index. Exceeding a bound is unknown/error, never an empty success. Paths reject traversal, absolute segments, Windows reserved names and unsafe characters. Schema v1 remains outside the original resume content object. See `ArchiveManifestV1` and `ArchiveIndexV1` in [shared history contracts](../packages/contracts/src/history.ts) for the exact package format.

## Synthetic fixture and manual acceptance

Create a synthetic candidate in the web app and copy its actual organization and candidate UUIDs. This command creates a **new** ignored root under `output/quick-check/<run-UUID>/`; it accesses no API and never replaces existing files:

```sh
npm run history:fixture -- --organization-id <synthetic-organization-UUID> --candidate-id <synthetic-candidate-UUID>
```

Select the printed root and link the printed company folder. Enter the printed context in Quick Check: expect two local packages, one exact posting URL and one fingerprint-only warning. Database history is independent and may have no authorized matches because the fixture creates no database bids. Use only the generated disposable data for tampering tests.

| Manual test | Expected result |
| --- | --- |
| Shortcut and native selection menu on an ordinary job page | Both open the same review flow with selected company, top URL/title and bounded editable JD; no automatic lookup |
| Shortcut conflict, no selection, restricted Chrome page/cross-origin frame | Actual binding shown; manual company/JD fallback; no successful empty lookup inferred |
| Two companies with punctuation/suffix differences, different job IDs/unknown parameters, generic careers URL, reused URL with changed title/JD | Company and possible evidence stay separate; strong URL only when appropriate; no merge/write |
| Offline API with valid local fixture; missing/denied root with working API | Independent source results; failure cannot erase the successful other branch |
| Reopen/reload, switch account/org/candidate, revoke assignment/grant | Own review draft restores; another scope's capture is not replayed; current API denial takes effect |
| Remove/damage index, change a required file, set packageComplete false | Local unknown/error with no “no match” claim; database result remains separate |
| Repair healthy/damaged selected company; include an unreadable child | Only that company is enumerated; valid index rebuilt; unreadable/incomplete case preserves old index and all packages |
| Move root/company folder, deny/renew permission, restart Chrome | Relink/permission required or unknown; no absolute-path or permanent-permission claim |

Record Chrome/Windows version, date, scope, lookup states and hashes without passwords/tokens. Hosted authenticated acceptance and native Windows picker/permission behavior require the existing hosted migration/accounts and an interactive Chrome session. CI's real browser filesystem fixture uses OPFS, which does not establish native picker permission behavior. Physical OS shortcut/menu activation is separate from handler registration/dispatch testing.

[2780bad isolated CI](https://github.com/worldcruise/ApplicationTracker_v2/actions/runs/39360021772) passes 22 migrations, 241 SQL assertions, 45 unit tests, both builds, 1,358 real Auth/API assertions and 68 browser checkpoints. Nine new unpacked Quick Check checkpoints exercise real page extraction through the trusted workspace module, review/draft persistence, real database lookup, cloned OPFS handles, concurrent completion, source failures and scoped repair. Actual Chrome command/menu registration and both native event-handler dispatch paths are also checked; physical OS gestures and native directory picker behavior remain manual.

Automated evidence and exact passing runs are recorded in [PROGRESS.md](PROGRESS.md). Run `npm run check`, `npm run build` and the guarded isolated CI suite for current results. No hosted database/configuration changes, automatic submission, archive package save orchestration, native helper or browser-store publication are implied.
