# Application Tracker v2 workspace design

21 October 2026. This is a presentation increment on the working localhost-first application. Next.js 16.4.2, React 19.3.1 and Tailwind 4.3.3 are retained. No dependency, authentication provider, API contract, database migration, hosted configuration or extension protocol changes are required.

## Reference review

The implementation uses original components and CSS. No reference source, images, logos, fonts or paid templates were incorporated. Licenses were checked before implementation:

| Reference | Reviewed material / license | Adapted pattern |
| --- | --- | --- |
| [Next dashboard starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | README, page catalogue, accessible demo (redirects to sign-in); [MIT](https://github.com/Kiranism/next-shadcn-dashboard-starter/blob/main/LICENSE). | Grouped sidebar, restrained surfaces, table/filter hierarchy. Its Clerk, billing and data-fetching architecture are not dependencies here. |
| [Shadcn Admin](https://github.com/satnaing/shadcn-admin) | README, published screenshot and live [dashboard](https://shadcn-admin.netlify.app/) inspected in Chrome; [MIT](https://github.com/satnaing/shadcn-admin/blob/main/LICENSE). | Compact navigation, consistent controls, metric cards and responsive spacing. Its Vite/TanStack routing is not adopted. |
| [Twenty](https://github.com/twentyhq/twenty) | README and accessible [product demonstration](https://twenty.com/); [license](https://github.com/twentyhq/twenty/blob/main/LICENSE) is predominantly AGPLv3 with commercial exceptions and specific MIT packages. | Record identity, owner/team columns, detail sections and activity hierarchy. No Twenty source/assets are reused. |
| [Reactive Resume](https://github.com/reactive-resume/reactive-resume) | README and accessible [product/editor presentation](https://rxresu.me/); [MIT](https://github.com/reactive-resume/reactive-resume/blob/main/LICENSE). | Document-centered editing, template thumbnails, preview controls. Our canonical v1 contracts and same-byte rendering remain authoritative. |
| [JobHunt](https://github.com/kaitranntt/jobhunt) | Repository documentation and accessible [product page](https://jobhunt.kaitran.ca/); [MIT](https://github.com/kaitranntt/jobhunt/blob/main/LICENSE). | Company/role-first opportunity cards with secondary status, owner and follow-up information. No drag-to-transition behavior is introduced. |

Accessible public material was reviewed without creating accounts on reference services. Gated live workflows are not claimed as tested.

## Shared system and navigation

`packages/ui` supplies original brand, buttons, text status badges, state panels and authentication shell, plus neutral/indigo tokens, typography, borders, focus rings and form/table styling. Web-specific navigation and responsive workspace composition live in `apps/web/src/components`; the extension keeps its existing layout and API. No external font request is required.

The server resolves current membership using the existing user-context Supabase integration and reads only the current user's display name under RLS. No administrator credential is used by the shell. Daily work, document production and administration are grouped separately. Bidders receive no candidate-directory, interview, prompt/editor or account-approval navigation. Restricted routes and API requests retain their existing independent guards. Pending accounts receive the account-status shell without operational navigation.

Desktop navigation collapses with a local presentation preference. Mobile uses a native modal dialog with keyboard focus containment, Escape dismissal and focus restoration. Ordinary workspace navigation uses document links so existing native unsaved-edit guards continue to run. The top bar identifies the current page/account and keeps Sign out reachable.

Templates and Prompts already belong to candidate context. Their navigation opens an honest candidate selector, then the existing authorized Studio section. Team/permission administration remains in the working workspace panel; settings links to current access. Notifications link to the real dashboard section. There are no fabricated standalone settings, template, prompt or notification APIs.

## Existing workflows

- Sign-in, registration, recovery, password update and account-status screens retain real handlers and actionable messages. The hosted intake toggle remains unchanged; a disabled registration form explains the prerequisite.
- Dashboard priority queues precede their exact scoped drill-down and supporting totals/conversions. Counts, chart bars and lists use the existing report, with no new metric definition or synthetic dashboard values.
- Candidate directory includes authorized Add Candidate, owner/team/status/next-step columns, real filter/pagination controls and an empty state. Candidate workspace retains its six sections, revision/conflict handling and archive behavior.
- Bid/interview results retain indexed search, debounce/Enter, URL filters and paging. Cards separate lifecycle from outcome and show company, candidate, owner, schedule/time zone and references. Server transitions, approval and explicit submission are unchanged.
- Resume Studio uses an actual 3–6–3 grid above 1200 px and stacked panels with section navigation below. Template thumbnails/selection, monospace original JSON, adjacent validation, independent operation outcomes and a same-byte PDF stage remain connected to existing handlers. Zoom scales the preview within its own scrollable stage. Invalid input and immutable history remain intact.
- Existing letter editor/history, scoped prompts, template customization, administration, approvals, notifications and processing panels inherit the same control/surface system. Saving/exporting still does not record submission.

## Verification

Run `npm run check`, `npm run build:web`, `npm run extension:build`, and `npm run resume:verify`. The guarded `npm run test:foundation:http` harness is CI-only and requires isolated local Supabase; never run it against the hosted development project. The new workspace browser suite uses actual isolated Auth/API/RLS and synthetic identities, checks desktop/mobile navigation, persisted collapse, permission visibility, directory entry points, 3–6–3 proportions, invalid JSON retention and overflow. Existing workflow/browser suites continue to exercise actual saving, approval, history and PDF behavior.

Local Chrome review uses the running localhost app. Do not put credentials in screenshots, traces or logs. Initial public-page checks pass at 1440 px and 390 px; registration is unavailable in current hosted configuration. Signed-in hosted acceptance requires designated synthetic accounts; isolated evidence must be reported separately. See PROGRESS.md for final checks and any corrected failures.

Manual review: sign in → Dashboard → Candidates → candidate Profile/Resumes → Studio → validate/generate/preview/export; then Bids and Interviews. Repeat at 390 px using Open navigation. Check approval with Admin and pending/rejected identities, inspect failed sync without losing source, and compare exported PDF hashes with the preview. Keep native Windows archive acceptance and production release gates separate from this visual increment.
