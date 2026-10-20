# Provider and application limits

Reviewed **20 October 2026** against official sources below. These are published plan examples, not an authenticated account quota/billing acceptance. Record live entitlements, terms, spend alerts and owners at deployment. Prices exclude tax, extras, SMTP, offsite backup and domain charges.

| Provider | Published allowance / operational implication |
| --- | --- |
| Supabase Free | 500 MB database, 5 GB egress, 1 GB object storage, 50,000 MAU; may pause after one inactive week. No automatic backup guarantee for this release. Development/synthetic evaluation only. |
| Supabase Pro proposal | Starts at $25/month; 8 GB database disk/project, 250 GB egress, 100 GB object storage, 100,000 MAU, daily backups retained seven days. Additional projects/compute and overages can add cost. Independently confirm recovery options and budget. |

These figures come from [Supabase pricing](https://supabase.com/pricing). PDF bytes currently consume **database disk and DB backups**, not the object-storage allocation. 50,000 maximum-size 16 MiB documents would exceed ordinary pilot disk allowances by a large margin; capacity planning must use actual document counts/sizes and immutable revision growth.

| Render proposal | Published limit / required action |
| --- | --- |
| Native `standard` / `1c-2g` compute | 1 CPU, 2 GB RAM, $25/month for one running instance. Measure concurrent rendering and peak request memory. |
| Workspace choice | Pro workspace adds $25/month, including 25 GB bandwidth and 1,000 build minutes; Hobby is for solo use and includes 5 GB/500 minutes. Owner chooses appropriate team access/terms; compute billing is separate. |
| Egress / builds | Published bandwidth overage $0.15/GB; build-minute overages and other services add charges. Alert before budget thresholds; confirm actual account schedule. |

Sources: [Render pricing](https://render.com/pricing), [compute-plan mapping](https://render.com/docs/compute-plans), [workspace plans](https://render.com/docs/new-workspace-plans). Legacy `standard` remains accepted in Blueprints. Proposed Supabase Pro + Render Standard + Render Pro workspace starts around **$75/month**, before extras; **not approved or purchased**. This conflicts with a literal PRD free-tier release claim (B20); obtain an explicit owner disposition instead of marking it passed.

Supabase's built-in Auth email service is limited to **two emails/hour**; configure approved custom SMTP and test invitations/recovery. Auth rate limits are separate from application API quotas and may aggregate server-originated traffic; test actual pilot login/refresh bursts. Do not replace ordinary public/user-context SSR clients with privileged keys to avoid rate limits. [Official Auth limits](https://supabase.com/docs/guides/auth/rate-limits)

Application limits: v1 frozen PDF <=16 MiB, <=100 pages; JSON/base64 adds transport/memory overhead. API request quota is shared per user/minute, with 429/Retry-After; administrative setup lists currently cap at 100 entries. No hosted maximum-payload, 25-concurrent-user, 5,000-candidate/50,000-bid load or agreed-device p95/read/render objective has passed yet. Headless synthetic CI timing is not hosted latency evidence. Host request-body/time limits and DB plan execution must be measured before release.

Unpacked desktop Chrome distribution requires developer mode and manual reload; no store auto-update, CRX signing or enterprise-policy deployment is configured. Native picker grants, browser-profile isolation, Windows protected folders/long paths, hard power loss and local disk capacity remain operator tests. Web Locks coordinate one browser profile, not separate devices. Archive roots should be separate per device. Offline work can remain queued, but synchronization always rechecks original account/project/current permissions. Content scripts never receive credentials. Native absolute paths, automatic submission, paid AI and extension PKCE remain deferred.
