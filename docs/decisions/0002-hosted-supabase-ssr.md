# Hosted Supabase SSR development

Date: 17 October 2026. Scope: H001, explicitly requested hosted development without Docker. Source requirements remain unchanged; this records the technical exception and outstanding gates.

The installed web stack is Next.js 16.4.2 with App Router under `apps/web/src/app`, alias `@/*` to `src/*`, React 19.3.1, and Node 24.22.0. No previous Supabase application integration existed. Use `src/lib/supabase/{client,server,proxy}.ts` and the actual Next 16 entry point `src/proxy.ts`. Pin `@supabase/ssr` 0.12.7 and `@supabase/supabase-js` 2.118.0 (SSR requires JS ^2.114.0; JS requires Node >=22). Both runtime requirements are satisfied.

## Cookie conflict and disposition

Design §4 says the web session uses Secure, HttpOnly, SameSite cookies. The explicitly requested [current Supabase SSR pattern](https://supabase.com/docs/guides/auth/server-side/creating-a-client) includes a browser client that must read and update the same session cookies. The [official advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide#how-do-i-make-the-cookies-httponly) explains that this browser flow needs access to the refresh token. Enforcing HttpOnly on those cookies breaks that flow.

H001 follows the user's specific instruction to implement the official browser/server SSR pattern: Supabase session cookies are JavaScript-readable, SameSite=Lax, path `/`, and Secure in production. HTTP development uses non-Secure cookies; deployed authentication must use HTTPS. This is an explicit exception to the design's blanket HttpOnly statement, not a claim that it was met. Other server-only cookies can still be HttpOnly. A strict HttpOnly-only design would require a separately scoped server-managed authentication architecture and should be decided by Product/Security/Engineering before changing this integration. CSRF checks for future mutations remain required; SameSite alone does not complete that gate.

## Boundaries retained

- Each server/proxy request creates its own client using the publishable key and that request's cookies. No service-role key, shared server session singleton, or privileged database client is introduced.
- Proxy immediately calls `auth.getClaims()`, forwards refreshed cookies to server rendering and the response, and returns a private, uncached response. Response replacement/redirect code must use `preserveSessionResponse` to retain every cookie and cache header. User-context fetches bypass Next's shared data cache; the public shell is dynamic.
- Refreshing or validating a JWT does not grant organization membership, team access, assignments, bidder fields, or any capability. Future `/api/v1` handlers must authenticate and check current database membership/resource permissions; database RLS and grants remain a second boundary. Browser Supabase usage is for Auth; business operations stay behind the shared API. `getClaims()` alone does not detect every unexpired-but-revoked session; use a current Auth lookup where needed, alongside membership checks.
- The existing shell stays public. No nonexistent login route is used as a redirect target, and no protected data/query endpoint is added. T009–T014 remain incomplete. Test identities are synthetic only.
- Hosted development is the default for H001; local Supabase/Docker remains optional. CLI linking/migrations require separate authorization credentials. No remote schema, Auth configuration, RLS policy, or account was changed.
