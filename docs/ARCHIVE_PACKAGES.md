# Bid packages and recovery

Sections 16–17 are implemented in the full extension workspace. Saving a package never records an application submission, changes an existing bid's selected documents or approval, or advances its status. A newly created opportunity is a Draft. Actual submission remains the separate protected web action.

## Setup and use

Use Node 24/npm 11 and the existing hosted configuration. Run from the repository root:

```sh
npm ci
npm run check
npm run dev
```

In another terminal:

```sh
npm run extension:build
```

Follow [extension installation and environment configuration](EXTENSION_WORKFLOW.md): configure the ignored extension environment, open `chrome://extensions`, enable Developer mode and load `apps/extension/dist`. After rebuilding, click Reload on that extension and reopen its full workspace page. Hosted development does not require Docker. Use a dedicated synthetic archive directory with a short root path, such as a test directory beneath Documents.

The hosted operator must apply migrations through `20261020000400`, configure the existing server render signing key and matching database registration, and supply an active synthetic account, organization/team/assignment or export grant. See [hosted migration authentication](HOSTED_SUPABASE.md) and [exact document storage prerequisites](RESUME_WORKFLOW.md). The implementation does not apply hosted migrations or configure hosted credentials. Keep all signing/service keys server-side.

1. Sign in with the existing email/password test identity and select an authorized candidate.
2. Generate and factually review a frozen resume in Resume, or select an already stored reviewed prepared document. Open **Bid package saving and recovery**. Refresh frozen sources if a resume or letter was produced after this panel opened.
3. Select the frozen resume and optional frozen letter. Review company, role, original URL, posting ID and complete description. **Use reviewed Quick Check job** copies this account/candidate's reviewed capture draft. **Use selected bid job details** retrieves current authorized details for an explicitly selected prepared bid.
4. Choose the archive root and grant read/write permission. **Freeze & save bid package** reserves the operation and bytes in IndexedDB before either save branch starts. Both branches then run independently. A missing or denied root can leave database-only success; a remote failure can leave verified local files.
5. Inspect all four results and the frozen PDF. Clipboard failure is non-blocking. The **Relative archive path** field is selectable for manual copy; it includes the root display name when available and never claims an absolute Windows path.

Export-only bidders select authorized prepared versions and an existing bid. They receive neither profile snapshots nor interview feedback and cannot create or edit resume/letter content. Original JSON is exported only when it equals the parsed rendered canonical content and contains no duplicate keys; unrendered extra properties or concealed duplicate values block bidder package export. PostgreSQL's [unique-key JSON predicate](https://www.postgresql.org/docs/17/functions-json.html#FUNCTIONS-JSON-TESTING-TABLE) also checks nested objects. Ask an authorized preparer to publish a clean reviewed version. The original JSON is never silently filtered or rewritten. PDF retrieval must match the stored hash. A letter bound to another bid cannot be attached to this package.

## Files and durable state

```text
<authorized root>/
  CandidateName__<full candidate UUID>/
    CompanyName__<company-key SHA-256 prefix>/
      archive-index.json
      YYYY-MM-DD_RoleName__<full operation UUID>/
        JobDetails.txt
        Resume.pdf
        Resume.json
        metadata.json
        CoverLetter.txt          # only when selected
```

Human names are normalized and sanitized for Windows, bounded without splitting Unicode characters, and stripped of illegal/control characters, device names and trailing dots/spaces. Stable suffixes survive truncation. Relative paths are limited to 240 characters and validated before filesystem traversal. Chrome does not disclose the root's absolute path; an exceptionally long root still needs manual Windows acceptance. Existing device-local company links retain their actual paths across candidate renames.

The journal retains the original actor, organization, candidate, device, one UUID, frozen input/hash, all static output bytes and their aggregate checksum, PDF bytes/hash, per-file write state, attempts/errors and independent local/database/reconciliation/clipboard outcomes. Original JSON whitespace and newlines are retained. Job details distinguish page capture time, when known, from the package freeze time. Earlier AP01 journals retain their original formatter. No service-worker global or continuously running worker is required.

An incomplete manifest precedes data writes. Every file stream is closed and its bytes read back and hashed. Existing identical files are reused. Only a matching interrupted prefix backed by this operation's pending-write journal and incomplete manifest is recoverable in place. Different bytes are a conflict and are preserved. `packageComplete` is set only after all required static files are verified. Metadata has its own verified hash in IndexedDB; it cannot contain its own self-referential hash.

Metadata retains original names/job identifiers, schema v1, immutable template version/layout hash, renderer version, font/asset hashes, PDF and file hashes, operation/device IDs, profile revision and eventual bid/source/document IDs. Full candidate snapshots remain in the protected immutable database source versions, rather than being disclosed to bidders in archive metadata. Metadata contains no credentials. Company indexes are advisory and updated with verified readback under a local Web Lock; manifests and file hashes remain authoritative.

Database synchronization resolves original source operation IDs or prepared document IDs to immutable versions. The normal authenticated client and forced RLS remain in use. The API signs its validated matching decision using the existing server-only document attestation mechanism; direct forged commands fail. Candidate locks serialize archive saves and normal bid edits. A snapshot token detects intervening job/submission changes; bounded retries refresh derived matching only, preserving the original payload and operation UUID. Only unchanged posting-URL matches automatically reuse a bid. Fingerprints, similar names/titles and unverified external IDs never automatically merge opportunities. Ambiguous or over-100 observation history requires explicit review/selection. Reusing a bid does not change its content or history.

`archive_operations` preserves immutable actor/key/request-hash/results. Receipt lookup optionally checks the frozen request hash and always rechecks current access. A separate immutable device observation records the first locally verified file/metadata hashes and its claimed `checkedAt`. It is explicitly a device report, not proof of present file existence or submission. Its payload is also persisted before delivery and reused after a lost response.

D08's verified-alias/provider-ID/reposting override authority remains a separate decision gate. This increment supplies conservative matching and explicit existing-bid selection; it does not introduce an unaudited force-new-duplicate capability or claim broader T046/T051 completion.

## Recovery

| Result | Action |
| --- | --- |
| Local succeeded, database failed/unknown | Retain the directory. Use **Reconcile / retry original package synchronization**. It queries the same receipt before replaying the same frozen key. |
| Database succeeded, local failed | Restore/renew the original root's permission; use **Retry local package only**. The database receipt and frozen PDF are reused. |
| Workspace/browser closed with a pending step | Sign in as the original actor, select the candidate and recover the saved operation. Pending is unconfirmed, not proof of failure. No write or permission prompt runs automatically on reopen. |
| Metadata/index or device observation pending | Use **Reconcile package metadata and index**. A damaged/missing index needs the explicit selected-company repair in Quick Check; set its company/context to this package first. Unreadable packages prevent destructive index replacement. |
| Authentication, organization, assignment or export grant revoked | Reauthenticate or restore authorized scope. Another account's queue is never replayed; a bidder role cannot replay cached editor source operations as generation authority. |
| Conflicting bytes | Inspect and retain them. Do not overwrite or repeatedly retry a conflict. An intentional new copy gets a new operation and directory after the original unknown database result is reconciled. |
| Clipboard denied | Files/database results remain independent. Select **Relative archive path**, copy manually, or click **Retry relative path copy**. |

Transient unknown database results retain an exponential, jittered suggested retry time. Workspace retries are explicit; there is no background business-write replay or continuous scheduler. Permission/validation/conflict failures are not automatically retried. Do not use a new create key to bypass an unknown response. An explicit new package copy creates another archive directory and receipt, while strong database duplicate handling still reuses the opportunity.

Source operations that were never synchronized still obey the existing current-facts creation guard. If candidate facts changed before their first source save, synchronization can require fresh factual review and a new source/package; retain the original local-only package unchanged. Already persisted frozen versions remain retrievable under current permissions. Archiving a historical version does not approve it for a new submission; the existing fresh-facts and exact-document approval gates still apply.

Web Locks coordinate tabs in the same extension/browser profile. They are not distributed filesystem locks across Chrome profiles or devices. Use separate device roots; server idempotency and matching still operate across clients. Folder moves, deleted IndexedDB, externally edited files, disk failures and operating-system interruption can require explicit relinking or restoration. Do not infer an absent archive from a failed source or use a download event as proof that an archive directory exists. Ordinary PDF downloads remain a separate export fallback, not a complete package save.

## Verification and remaining manual acceptance

`npm run check` covers Windows names, atomic concurrent reservations, original bytes, fresh journal instances, actor isolation, interrupted data/metadata prefixes, file conflicts, scoped index repair, denied permission, independent branch results and original receipt recovery after timeout. The isolated CI harness applies rollback-only SQL tests and exercises real Auth/API/RLS, concurrent distinct operations, immutable replay, optional letters, hidden shared-document links, bidder restrictions and current revocation. Production builds and pinned PDF regressions remain required.

The unpacked Chromium harness uses actual IndexedDB and Origin Private File System handles. It exercises local-only saving while the API is held/failed, exact file hashes/text, lost responses after real commit, browser-process restart, another account, receipt reconciliation, repeated saves and an injected interrupted real-file write. OPFS is not certification of a user-picked native Windows directory or physical power loss. The final run and counts are recorded in [PROGRESS.md](PROGRESS.md).

Run the following on desktop Chrome/Windows with synthetic data and record Chrome/OS versions:

1. Choose a native test root. Save twice without changing input, including from two workspace tabs. Verify one operation directory/index entry, exact original JSON, all required files and optional letter, and a Draft bid with no submission event.
2. Close the workspace midway through writing; also restart Chrome. Reopen and sign in. Check the persisted handle without prompting, renew explicitly if required, and retry the original operation. Confirm file hashes and source IDs stay identical.
3. Deny/revoke directory permission. Confirm database success remains visible while local saving fails. Restore the original root and retry local only. A different root must not silently receive an old operation.
4. Block only the archive API (not Auth), save locally, then restore it. Simulate losing the response after server commit and reconcile the original UUID. Confirm no additional bid or submission is created. Confirm local and database results become visible independently.
5. Deny clipboard access. Confirm successful saving and a selectable relative path remain available. Change a file or damage the company index; confirm conflict/unknown, no overwrite, and explicit company-only repair behavior.
6. Sign out or change accounts/organizations with pending work. Revoke an assignment/export grant using an administrator. Confirm retries stop and the other account sees no queued operation. For a bidder, verify generation/edit/profile-history/interview-feedback access remains denied.
7. Edit the candidate and publish a later custom-template version. Retrieve and inspect the original package/PDF/source again; bytes and version IDs must remain unchanged. Apply the existing template/history regression instructions as well.

Hosted-user testing, native Windows picker/renewal, physical browser/OS interruption, cross-profile writers and two-device retrieval remain manual prerequisites. Exact cross-device retrieval requires the applied document schema, stored original PDF bytes and reachable service/current export grants. Initial storage needs matching server/database signing configuration. Reproduction without stored bytes requires the recorded renderer, dependencies, fonts and assets and must reproduce the exact hash; a mismatch blocks export. Local IndexedDB/files are not a platform backup. Native Windows folder opening, a filesystem helper and automatic application submission remain deferred.
