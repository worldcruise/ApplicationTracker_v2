# Registration and account approval — localhost pilot

The web/API runs at `http://localhost:3000` (or the origin printed by `npm run dev`), using hosted development Supabase `xsyxlxpsglhkmvzlmhih`. Docker is unnecessary. Public registration is an account request; email confirmation does not create application membership. See [decision 0003](decisions/0003-registration-approval.md).

## Operator setup

Use Node 24/npm 11, then `npm ci`. Preserve `apps/web/.env.local` and its unrelated values. Required values are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL=http://localhost:3000`; placeholders are in `apps/web/.env.example`. Existing hosted project/public key remain unchanged. No new public secret or client configuration is required.

Review hosted migration history and apply pending migrations in filename order, including `20261021000100_account_registration.sql` after the existing 27 migrations:

```powershell
npm exec --no -- supabase login
npm exec --no -- supabase link --project-ref xsyxlxpsglhkmvzlmhih
npm exec --no -- supabase migration list --linked
npm exec --no -- supabase db push --linked --dry-run --skip-vault
# After reviewing the target, baseline and pending migrations:
npm exec --no -- supabase db push --linked --skip-vault
npm exec --no -- supabase migration list --linked
```

CLI login/project access and the development database password are needed. Do not reset the hosted database, seed CI fixtures, edit applied migrations, or weaken RLS. Reconcile an unknown existing baseline before applying.

### First administrator

If an active Admin already exists, sign in with that account and retain its organization. Otherwise, before enabling public intake, an authorized project owner creates a synthetic email/password Auth identity in Supabase **Authentication → Users**, verifies its email using a controlled mailbox (or the trusted dashboard confirmation option), and records its UUID. Choose a **new** organization UUID. Privately supply `SUPABASE_SERVICE_ROLE_KEY` in this terminal's environment or ignored `apps/web/.env.local`; never use `NEXT_PUBLIC_`, source control, chat or an extension bundle for that credential.

```powershell
npm run admin:bootstrap -- --organization-id <new-organization-uuid> --admin-user-id <confirmed-auth-user-uuid> --name "Synthetic Local Pilot"
```

Bootstrap requires the service credential and a confirmed identity, creates a new organization and its active Admin in one audited transaction, and refuses an existing organization. An uncertain result requires inspecting memberships/audit before retrying. It never promotes a public registrant. Sign in at `/sign-in`; create a team under Organization administration if non-Admin approvals will be used. Existing organizations must be administered/recovered through the trusted membership process, not re-bootstrapped.

Select the existing active organization explicitly for new registrations:

```powershell
npm run registration:configure -- --organization-id <active-organization-uuid>
# To stop new account intake later, preserving existing requests and access:
npm run registration:configure -- --organization-id <active-organization-uuid> --disable
```

This operator-only command uses the same private credential and validates the organization and its active Admin. It stores the target in private database configuration; the browser cannot select another organization. Retargeting affects future requests only. Remove the terminal credential when finished if invitation administration is not needed; normal registration, status and review use public-key/user-context clients and do not need it. Existing document-render secrets remain server-only and independent.

### Hosted Supabase dashboard

These changes must be made by the project owner; repository configuration does not apply them remotely.

1. **Authentication → URL Configuration**: Site URL `http://localhost:3000`; retain exact redirect URLs `/auth/callback`, `/auth/callback?mode=recovery` and `/account/update-password` on that origin. If the launcher selects a fallback port, add its exact callback URLs and use the intended Site URL before sending confirmation mail. The confirmation template below uses SiteURL. No wildcard public origins or extension redirect changes are required.
2. Enable email/password, **Allow new users to sign up**, and **Confirm email**. Set minimum password length to at least 12; keep anonymous sign-in disabled. Existing stronger project password requirements remain enforced by Auth.
3. Set **Confirm signup** email template to `supabase/templates/confirmation.html`. Its fixed `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` URL is exchanged server-side; it does not depend on the original browser's PKCE verifier. The default browser PKCE `/auth/callback` path is also supported. Retain the existing invitation/recovery templates and settings.
4. Confirm SMTP/sender configuration, delivery and provider quotas for your controlled synthetic mailboxes. Supabase's default sender can restrict recipients and signup frequency; configure a verified sender/custom SMTP when needed. A mail-delivery failure is not an approval or successful sign-in. Apply abuse/rate-limit settings in hosted Auth; the high local Mailpit email limit in `config.toml` is for isolated tests only.
5. Keep intake disabled in the database until migrations, first Admin and hosted email confirmation settings are ready. Enable with `registration:configure`, then run `npm run dev` and perform the checklist below.

## Manual test — synthetic accounts only

1. Open `/sign-in`, select **Create account**. Try empty name, malformed email, short password and mismatched confirmation; correct each field. Register a fresh synthetic mailbox with a valid full name and 12+ character password. Expect a check-email message with no session when confirmation is required.
2. As Admin, open **Organization administration → Review account requests**. Before confirmation, verify applicant/name/email/date, `pending`, and `Not verified`; Approve is disabled. Server/database approval also rejects unverified identities.
3. Open the real email link. Expect **Awaiting administrator approval**, **Email: Verified**, **Check approval status**, and **Sign out**. Refresh/re-sign-in should return here. Direct candidate/document/dashboard/admin API calls must deny access; the status endpoint can return only the current user's status. Never put tokens into screenshots/logs.
4. In a separate Admin browser session, reload requests, select an authorized role and active team (required for Team Leader, Team Member and Bidder), optionally add a reason, and Approve. No default public Admin grant exists. Check the applicant's status; it should open the existing workspace with that current role/team. Refresh and sign out/in; membership persists. Candidate access still requires the role's normal assignment/grant scope.
5. Register and confirm a second synthetic account, then Reject with a synthetic reason. Sign in as that user: expect **Account request rejected**, the reason, status-check/sign-out controls and continued data denial. Registering again must not create a fresh request or reset rejection. Use account recovery for an existing email, not repeated signup.
6. Attempt review as a Team Leader/Member/Bidder and an unrelated-organization Admin; expect denial. Try a different organization's team; expect validation failure and no membership or final decision.
7. In two Admin tabs loaded at the same pending row version, submit conflicting decisions concurrently: exactly one decision persists; the other receives conflict. An identical retry returns the same final version without duplicate membership/audit or reviewer changes. Reload before changing any uncertain review input. Existing approved/invited accounts must still sign in with their current scopes.

Run `npm run check`, `npm run build` and `npm run resume:verify`. `npm run test:foundation:http` and `npm run db:test` are isolated-CI tools; the former refuses hosted projects and local `.env.local`. CI tests actual Mailpit confirmation, browser signup/status/Admin approval/rejection, direct RLS, API denials and opposing concurrent reviews. Hosted SMTP, dashboard setup and this computer's browser acceptance require the manual checklist. Current execution evidence and gaps are in [PROGRESS.md](PROGRESS.md).

## Recovery and limitations

- A missing migration/configuration displays registration unavailable; do not substitute an arbitrary organization or service-key application query.
- Signup and its request insert are atomic. A failed trigger fails signup; retain logs only in trusted provider/operator tooling. Do not log passwords, confirmation links or sessions. Duplicate identity handling may be intentionally obscured by Auth to prevent enumeration; the form uses neutral sign-in/recovery guidance.
- Losing a review response is safe: reload status or retry the identical payload/current original version. A different terminal decision is a conflict; there is no public reopen/reset/delete command. Contact the operator for a reviewed future reconsideration workflow. Existing deactivation/membership management applies after approval and remains independent of admission history.
- Disabling app intake does not by itself disable project-wide Supabase Auth signup. Disable both when closing onboarding. An Auth-only identity created outside configured intake has no application access and requires trusted provisioning; it is never promoted automatically.
- Public intake captures new non-invited Auth identities while enabled. Create initial/trusted bootstrap identities before enabling intake; later trusted invitations use the existing invitation API. No backfill or automatic migration of existing users occurs.
- Release rollback should close intake and roll application code forward with a corrective migration. Preserve account decisions/memberships/audit. Do not drop the new Auth trigger/tables or restore an old database over newer decisions to make signup appear successful.
