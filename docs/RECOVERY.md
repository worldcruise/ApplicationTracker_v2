# Backup and recovery

The pilot remains synthetic-only. Recovery objectives (proposed RPO 24 hours / RTO one business day), operators, offsite location, key escrow and expiry need owner acceptance. A passing CI rehearsal is evidence for the logical backup implementation, not a hosted disaster-recovery guarantee.

## What must be recovered

The logical backup includes `auth`, `public`, `private`, `supabase_migrations` and `extensions`. This includes immutable candidate/template/resume/letter versions, approvals, submissions, archive receipts, original JSON, **stored PDF bytea** and private document verification keys. Current documents use protected PostgreSQL storage; there is no required public or private object bucket. Renderer source, lockfile and licensed font/assets remain pinned in the matching Git tag. User-selected local archives and unsynchronized extension IndexedDB operations are separate data and cannot be remotely recovered from this backup.

The archive explicitly includes the required **`pgcrypto` and `pg_trgm` extension declarations**, and authenticates their source versions/schemas in backup metadata. PostgreSQL's [schema-filtered pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) does not automatically include dependencies; selecting `extensions` alone omitted the trigram operator class during the search milestone's first restore rehearsal. Both the native operator command and isolated rehearsal now use explicit `--extension` selections. Target packages/compatible versions must be available before restore. Unrelated provider extensions and their configuration tables are not added to this backup scope. Older archives without these declarations need an operator-reviewed dependency recovery plan; do not claim they restore the new search indexes into an empty database.

Retain the source commit, migration checksums, release manifest, project configuration export, exact Auth templates/SMTP/provider/redirect settings, custom role definitions/grants, DNS/Render configuration and signing-key IDs in the access-controlled recovery inventory. Application roles are `NOLOGIN NOBYPASSRLS` and defined in migrations; a dump is not a global-role backup. Never recreate them with login or bypass privileges to make restore easier. Secrets belong in separate secret escrow, not the inventory or Git.

## Native operator backup (no Docker)

Install PostgreSQL **17** client tools (`pg_dump`, `pg_restore`, `psql`) and Node/npm versions in `.node-version` / `package.json`. Use the production session-pooler settings from Supabase **Connect**, port 5432. Do not use transaction pooler port 6543. Populate these variables through a private secret manager or a local ignored env file, never command-line password flags or shell history:

```dotenv
PRODUCTION_SUPABASE_PROJECT_REF=<production-ref>
PGHOST=<production-session-pooler-host>
PGPORT=5432
PGUSER=postgres.<production-ref>
PGDATABASE=postgres
PGPASSWORD=<private-database-password>
PGSSLMODE=verify-full
PGSSLROOTCERT=<path-to-trusted-provider-ca>
BACKUP_ENCRYPTION_KEY=<independent-64-hex-character-key>
```

With those values loaded in the process environment, from the repository root:

```powershell
npm ci
npm run backup:create
npm run backup:verify -- backups/<reported-file>.aes
```

Alternatively Node can load an ignored file directly: `node --env-file=.env.backup.local scripts/backup.mjs create`. The command refuses the known development project, an unspecified project/user, an unexpected database major or unverified TLS. It uses one consistent `pg_dump` snapshot, streaming directly into AES-256-GCM. The metadata header is authenticated, every backup has a random IV/UUID, output uses exclusive creation and is authenticated after writing. An interrupted/failed dump is not published as a completed backup. Keep checksum, time, release and operator evidence. Directory permissions must also be set to the operator on Windows; POSIX file mode is not a Windows ACL guarantee.

Copy the encrypted file to the owner's approved **offsite, versioned, access-controlled store** and verify its SHA-256 after download. Store its encryption key in a different account/secret store with recovery access for the designated custodians. This repository does not provision offsite storage or claim that a local backup is offsite. Schedule and alert on backup age/failure only after that destination, budget, expiry and operator are accepted. Provider-managed daily backups are an additional layer, not proof of independent recovery. Losing both the backup key and its escrow makes this backup unrecoverable.

## Isolated restore and verification

For a new **empty isolated PostgreSQL database**, created by a qualified operator with required managed roles/extensions available, set the target `PG*` environment, `PGDATABASE=atv2_restore_<unique-id>`, and the original backup key. Exact ownership restoration requires the isolated maintenance **superuser**: hosted Supabase's limited `postgres` role cannot restore `supabase_admin` ownership. The command rejects that insufficient role; never grant superuser to a hosted migration/application role to bypass this limitation.

```powershell
npm run backup:verify -- backups/<file>.aes
npm run backup:restore-empty -- backups/<file>.aes
```

This command authenticates the entire file before starting restore, refuses user tables/existing user schemas and uses a single restore transaction. It removes only the new target's empty default `public` namespace **without CASCADE**, so the archive can recreate its original owner/ACL; dependent objects cause refusal. It never drops or clears an existing database. Required extension packages and cluster roles must be available, not preinstalled user schemas. `restore-empty` is deliberately **not** a replacement for the hosted Supabase recovery procedure: a newly created Supabase project already contains managed tables. Do not delete those schemas or weaken RLS to force this recipe to work.

For a hosted disaster, first isolate/stop writes and preserve the damaged project. Prefer the provider's managed restore-to-new-project workflow, then reconcile the exact application migrations, custom roles and signing keys. A cross-project logical migration also requires the provider's encryption root key and managed Auth settings; use the [official Supabase recovery procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Have the operator adapt/review schema/data restore for existing managed objects, migration history and trigger behavior before executing it. This hosted adaptation has **not** been rehearsed by CI. Do not pipe a full schema restore blindly into a live project.

Before switching traffic, compare all application/Auth/private/migration table counts and row hashes privately, stored PDF SHA-256s against document metadata, history references, key IDs, object counts if object storage is later introduced, ownership, function execution grants and RLS policies. Verify four-role allow/deny access and exact historical export with synthetic accounts; verify login, refresh, recovery and invitation delivery. Reconfigure project URL/public key, server secrets, Auth origins and the paired extension build only after verifying the target. Record backup snapshot age, download/decryption/restore/validation time and actual recovery point/time. CI does not measure download, provider recreation or operator response.

A restore to a **different project reference** also needs an explicit, authorized identity/project handoff. Current extension journals deliberately bind to the original project/account; changing a build URL does not authorize replay into another project, even if an email matches. Preserve the old profile/root and reconcile original operation IDs with restored receipts. Automatic cross-project journal migration is unsupported; local-only pending work requires a reviewed recovery tool/operator procedure before it can synchronize. Do not clear or rewrite actor/project bindings to bypass this boundary. Provider restore within the same project and a new-project disaster recovery are distinct manual tests.

The CI rehearsal is called at the end of `npm run test:foundation:http`. It encrypts the populated real synthetic Auth/application database, restores into a new `atv2_restore_*` database using the isolated cluster's `supabase_admin` maintenance role, compares every included row plus owners/grants/RLS, verifies stored PDFs/private keys and rechecks administrator/bidder/unrelated-user access. It uses an ephemeral key which is never uploaded. Only redacted counts/hashes/timings are evidence; no plaintext database, session, password or private key is an artifact. Existing cluster roles are reused, so this is not proof of global-role reconstruction or a new hosted Auth service. The first attempt using the limited `postgres` role failed on managed ownership; it did not lead to a production privilege change.

## Rollback and retention

Deploy migrations before the compatible web/extension release. Never edit an applied migration or use `db reset` against hosted data. Keep the current additive v1 database contract while 0.1.x/0.2.x clients are supported. Roll back application code to the last compatible commit; repair schema with a new forward migration. A point-in-time/database restore loses writes after its recovery point and requires an explicit incident decision, reconciliation of package operation IDs and immutable submissions, and a new isolated validation pass. Do not replay another account's queue or turn archive saving into submission during reconciliation.

No purge or backup expiry is invented here. D05 periods, preservation holds, purge authority, minimum audit evidence and local-export cleanup remain pending. Real candidate onboarding stays blocked. Ordinary archiving preserves history; deactivation is not erasure. Following an approved erasure request, track live database/private assets, provider backups/offsite expiry and user-directed archive cleanup separately, and prevent restored backups from reintroducing erased data before traffic resumes. Implement and test T058 under the accepted policy before changing to real data.
