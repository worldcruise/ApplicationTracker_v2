# Resume and document workflow

Implemented increments: RP01–RP03 and TP01–TP03, from design §§10–13 and PRD §§8–12. These web/API features reuse hosted Supabase Auth, request-scoped clients and forced RLS. The extension now reuses this production workflow through EX01–EX03; see [Resume/Profile build, recovery and Chrome acceptance](EXTENSION_WORKFLOW.md). Saving, factual review, storing PDF bytes, exporting and submitting are separate actions. [Bid operations](BID_INTERVIEW_WORKFLOW.md) now implement exact-version application approval and explicit submission recording. Factual review and archive/export remain independent.

## Start and prerequisites

Use Node 24/npm 11 from the repository root:

```sh
npm ci
npm run check
npm run dev
```

Open `http://localhost:3000/sign-in`, sign in with an existing synthetic account, select its active organization and open a candidate's Resumes tab. Links lead to Resume Studio, cover letters and frozen document history. A bidder uses **Open authorized document history** in Workspace. Ordinary requests always carry that user's JWT; no service credential is used for content queries or mutations.

Hosted prerequisites: review/apply the repository migrations through the [Docker-free hosted workflow](HOSTED_SUPABASE.md#hosted-migrations-without-docker), active memberships/assignments, and an authorized synthetic account. The configured project was not migrated or used for live account testing by these increments. CLI login/access and the development database password must be supplied privately by the operator. Local `npm run db:start` is optional; database and production HTTP/browser checks run on an isolated Supabase stack in GitHub Actions.

## Canonical content, prompts and review

Canonical resume **v1 is unchanged**. Its six top-level keys and required entry structures are mandatory. Empty strings/arrays produce content warnings, rather than missing-structure errors. Unknown properties remain in original JSON, warn and are excluded from rendering. Schema metadata, evidence mappings and target-job context live outside the content object. Limits: 1 MiB original JSON, depth 32, 100 entries per array, 1,000 narrative review claims; job description 200 KiB. Prototype keys, unsafe control characters and unsupported schemas fail with field paths. Formatting is blocked on invalid input and never replaces it with a parsed fragment.

Shared validation is compiled ahead of time with [Ajv standalone generation](https://ajv.js.org/standalone.html); no runtime code generation is needed by MV3. `npm run schema:compile` regenerates the checked-in validator; builds reject a stale generated file. Structural validity is distinct from factual review and from four-field candidate Ready validation.

The server freezes the profile revision, selected template, main prompt and enabled global/team/candidate blocks in stable order. The exact returned prompt and hash appear in the preview; Copy Prompt writes exactly that string. It contains minimum professional facts, excluding contacts, links and private notes. Review what will leave the platform before using an external AI service. Custom blocks cannot override protected instructions or backend validation. Global/main publication is admin-only; team publication requires leadership; candidate blocks require editing scope.

Every experience and education item maps to frozen verified records. Employers, official titles and approved accurate display titles cannot be replaced by target-company metadata. Ambiguous repeated records need explicit selection. Narrative paraphrases require selected evidence and an attestation by an authorized profile editor, following the user's explicit reviewer choice. Unsupported numbers/qualifications remain unresolved. Automated checks cannot prove every narrative statement; attestation is human review of the whole claim, never permission to invent facts. Correct unsupported facts in the profile, assemble again and review a new version. This review grants no submission approval.

Structurally valid drafts may be saved unverified after confirmation. Their PDF has an Unverified watermark on every page and cannot be linked for bidder export. Conflicting or unsupported facts cannot become a reviewed version merely by passing JSON Schema.

## Templates

The nine built-ins are ATS Classic, Modern Professional, Minimal, Technical, Executive, Compact, Academic, Creative and Chronological. They use one measured layout engine with distinct presets. Their thumbnails show the same synthetic sample rendered through each preset; `npm run resume:thumbnails` deliberately regenerates these tracked PNGs. Search/select a preset or duplicate it into personal, candidate, team or organization scope. Customization supports Letter/A4, bounded margins/font sizes, line/paragraph/section spacing, indentation, header alignment/color/link visibility, employment order and section visibility/order/labels. Reset restores the selected base configuration. Publication appends a numbered immutable version with layout/font hashes; optimistic version checks reject simultaneous edits.

Personal scope is private to its owner with the foundation's organization-admin oversight. Candidate/team sharing remains within current assignment/team permissions; organization publication is admin-only. An owner cannot bypass lost candidate/team access. Historical documents retain their frozen template even when current sharing or layout changes. Additional font families, free-form header arrangements and explicit manual page-break controls are not implemented; bundled licensed Noto Sans and measured automatic pagination are used. Arbitrary scripts, remote fonts/assets and executable templates are rejected. These limitations do not silently change the broader PRD controls.

## PDF, letters and independent outcomes

Validated content, frozen profile and evidence mapping, template configuration, pinned licensed font files and a fixed timestamp feed [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument). Text is measured, wrapped and paginated without truncation or automatic shrinking. Unsupported glyphs fail with a Unicode code point; no substitution is made. Long documents warn after three pages and stop at the 100-page safety limit. ATS Classic retains renderer `ats-classic/1.0.0`; configured templates and letters use `template-engine/2.0.0`.

PDF.js previews a copy of the exact generated bytes. Export checks their SHA-256 and downloads the same bytes. The accessible text view comes from the layout or stored PDF text. Template/content/review changes invalidate a draft PDF. Failed validation/generation/synchronization retains the original input and existing frozen operation. Local downloads report **Download initiated**; the browser cannot prove that a file was retained.

Cover letters have a dedicated plain-text editor, optional existing bid reference, factual review, PDF/text export and immutable version history. Text is limited to 200 KiB. Editing a historical version starts a new draft and requires review against the current profile. The original body, candidate/profile revision, template snapshot, provenance and PDF receipt remain unchanged. A source-only save has no PDF claim.

Resume and letter journals persist actor/org/candidate identity, operation UUID, frozen payload, render timestamp, PDF bytes/hash and independent validation, PDF generation, local export, database synchronization and clipboard outcomes in IndexedDB. Journal failure blocks durable operations. A restore failure never overwrites existing storage with an empty draft. Interrupted synchronization becomes **unknown**: reconcile by operation UUID or retry the original payload/key. Changed payload or actor under an existing key fails. Content requests carry the expected local actor in `X-Operation-Actor`; the backend rejects a changed account before replaying the operation. An unknown operation cannot be edited or replaced in the UI. Successfully downloading a PDF never changes database synchronization to success.

## Exact frozen PDF storage and export-only access

Source versions retain raw and parsed content (or letter text), schema/profile/template versions, full protected snapshot, provenance and render timestamp/hash/pages. Immutable `documents` rows retain source references, renderer, font/assets and PDF hash; separate RLS-protected `document_blobs` retain exact PDF bytes, bounded to 16 MiB. Authenticated roles have no direct blob-table SELECT. Protected storage inserts metadata/bytes/audit in one transaction. No user overwrite/delete is provided.

**Store exact resume/letter PDF** is explicit after saving a rendered source. The server reproduces the frozen source and compares its recorded receipt, then attests the source ID, organization, document kind, PDF hash, template, renderer, pages and filename with HMAC-SHA256. The database verifies that signature using a private key reader with no RLS bypass. Client hash claims alone cannot seal an arbitrary PDF. See [PostgreSQL HMAC](https://www.postgresql.org/docs/17/pgcrypto.html) and [Node createHmac](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptocreatehmacalgorithm-key-options).

An operator must configure this optional capability before use:

1. Apply migrations through the hosted workflow; verify the target project and pending SQL first.
2. Create a random 32-byte key in your private secret-management system, encoded as 64 lowercase hexadecimal characters. Set server-only `DOCUMENT_RENDER_SIGNING_KEY` and `DOCUMENT_RENDER_KEY_ID=primary` in the web deployment's secret environment (or ignored `apps/web/.env.local` for development). Never prefix these with `NEXT_PUBLIC_` or put them in archive metadata, shell history, logs or Git.
3. Privately supply the authorized operator `SUPABASE_SERVICE_ROLE_KEY` for this one-time registration command. It uses the configured project URL; the command prints only success/key ID:

   ```sh
   npm run documents:configure
   ```

4. Restart the web process with the same signing key/ID. Remove operator credentials from the ordinary development environment when no longer needed for administration. Business queries still use the user's context. Rotation uses a new key ID; an existing ID cannot be overwritten with another secret.

No hosted key was generated or registered here. Missing server key/registration is a prerequisite failure; source history and local PDFs remain usable. Database keys are private and excluded from client/metadata output. Protect database backups and application secrets according to the pending operational policy.

Document history lists safe metadata under current RLS. Admin/team leaders may link a reviewed frozen document to an existing authorized bid for the same candidate. This immutable link does not grant access by itself. A bidder needs current `document.export` on the corresponding candidate or linked bid and current organization/team membership. `document.read` permits metadata only. Grants are managed through existing protected foundation commands; revocation applies to unexpired sessions. Export authorizes the prepared PDF, including its rendered contact information, without exposing the unrestricted profile or source JSON.

`export_frozen_document` is executed by a dedicated non-owner, NOBYPASSRLS role with **no resume/profile-history SELECT privilege**. It rechecks resource permission, verifies stored-byte hash, returns only the PDF and fixed metadata, and records an export audit. Export-only callers never invoke generation or receive raw snapshots, provenance or interview feedback. Preview and download both reauthorize retrieval; previously downloaded data cannot be revoked from a user's device.

Stored bytes support exact retrieval on a different device without local IndexedDB or the current template. Required prerequisites are applied schema, successful byte storage, current export permission, reachable service, and preserved database/backup bytes. Reproduction when no bytes were stored additionally requires the exact pinned renderer implementation/dependencies, fonts/assets and PDF metadata/serialization. A different hash blocks a claim of identical recovery; no replacement is substituted. Long-term renderer availability, storage budget/quotas, retention, encrypted backups and measured recovery remain D05–D07 operational gates. No object-storage bucket, deployed backup policy or production SLA is implied by this implementation.

## APIs and checks

All routes use `/api/v1`, `organizationId`, current Auth/membership context, no-store responses, existing error envelopes and cookie-CSRF checks. Named database mutation commands provide the second authorization boundary.

| Route | Purpose |
| --- | --- |
| `GET /templates?candidateId=…`, `POST /templates/versions` | Visible immutable versions and scoped publication (`If-Match`). |
| `GET /prompts?candidateId=…`, `POST /prompts/versions` | Scoped prompt versions/publication. |
| `POST /prompt-assemblies`, `GET /prompt-assemblies/:id` | Frozen exact prompt and inputs. |
| `POST /resume-validations`, `POST /resume-renders` | Shared validation/review and independent PDF generation. |
| `GET/POST /resume-versions`, `GET /resume-versions/:id[/pdf]` | Immutable source history and pinned hash-checked reproduction. |
| `POST /cover-letter-renders`, `GET/POST /cover-letter-versions`, `GET /cover-letter-versions/:id[/pdf]` | Independent letter generation, immutable text history and reproduction. |
| `GET/POST /documents`, `GET /documents/:id/pdf` | Authorized stored metadata, attested storage and exact-byte export. |
| `POST /documents/:id/links` | Manager-authorized immutable document/bid link. |

Version POSTs use the original operation UUID in `Idempotency-Key`. Lists are bounded (50 source/letter versions, 100 documents). Historical ID endpoints retrieve authorized older versions even outside the recent list. Published template versions remain queryable through the scoped template API. Complete OpenAPI, archive/submission/approval workflows and release load gates remain their build-plan tasks.

```sh
npm run check
npm run resume:verify
npm run build
```

The renderer verification generates ignored synthetic samples/contact sheets, checks every page's text bounds, Unicode, empty values, long multipage content, unsupported glyph failure and deterministic hashes. GitHub Actions applies migrations on an isolated fresh Supabase instance, runs pgTAP, real Auth/API allow/deny tests and headless Chromium. It never links to the hosted project. See [PROGRESS.md](PROGRESS.md) for exact passing commits/counts rather than interpreting pending checks as verified.

Manual hosted/interactive acceptance remains unexecuted: use synthetic users in all four roles across two organizations/teams; repeat template scope/version conflicts, invalid JSON retention, paraphrase review, PDF navigation/text extraction, denied clipboard, failed/unknown save with reload/original retry, historical source and exact stored-byte retrieval after profile/template edits, export-only scope and immediate revocation. Compare downloaded SHA-256 across two devices. Test storage/key configuration failures and deliberate receipt/hash mismatch. Unpacked MV3 Auth/API/PDF/download behavior now passes isolated Chromium acceptance; interactive Windows worker-stop/directory behavior remains a manual gate in [EXTENSION_WORKFLOW.md](EXTENSION_WORKFLOW.md).
