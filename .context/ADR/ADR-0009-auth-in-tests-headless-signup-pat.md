# ADR-0009 — Auth in tests: headless signup / signin, credential chosen per endpoint

- **Status:** Proposed
- **Date:** 2026-10-02
- **Deciders:** QA architect / lead (open); drafted by `/project-discovery` Phase 2 from the Bunkai TMS code at `upex-bunkai-tms` `main` `e88512e`
- **Tags:** auth-in-tests, fixtures, api, e2e
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Every Bunkai test needs an authenticated principal, and the product offers three ways to get one (infra map, `bun run context:map infra-context --section architecture`, "Auth flow"):

- **Magic link** (the only login the UI offers): `POST /api/v1/auth/magic-link` → Supabase Auth emails a link → `GET /auth/callback?code=…` sets the `sb-*` session cookies. It needs a readable inbox and is subject to Supabase's OTP rate limit (`app/api/v1/auth/magic-link/route.ts`, `app/auth/callback/route.ts`).
- **Headless signup / signin**: `POST /api/v1/auth/signup` creates a confirmed user (`email_confirm: true`, no email) and `POST /api/v1/auth/signin` signs an existing one in. Both set the session cookies on the response AND return the Supabase session tokens plus a freshly minted PAT `bk_pat_*` (`app/api/v1/auth/signup/route.ts`, `app/api/v1/auth/signin/route.ts`, `lib/api/pat.ts`).
- **PAT as Bearer**: accepted only where a handler calls the dual-mode `requireAuth` (`lib/api/auth.ts`). At `e88512e` that is `GET /api/v1/workspaces` and `GET /api/v1/me`; every other authenticated handler reads the cookie session only, so a PAT alone gets a 401 there. PAT scopes are stored but not enforced.

This QA repo's auth plumbing is still the boilerplate default (`config/variables.ts` → `auth.loginEndpoint: '/auth/login'`, `scripts/api-login.project.ts` unadapted), so the choice is open. Changing it later means rewriting the auth fixtures, the `ui-setup` / `api:login` adapters and every spec that assumes a credential shape.

## Decision

We will (proposal):

1. Obtain identity in tests through `POST /api/v1/auth/signin` (existing users from `.env`) or `POST /api/v1/auth/signup` (fresh users, see ADR-0010), never through the magic-link email, in per-test or per-worker setup.
2. Carry BOTH credentials the call returns: the session cookies (saved as Playwright `storageState` for UI tests and for API calls to cookie-only endpoints) and the PAT (for the Bearer-capable endpoints and for tests that exercise PAT behaviour).
3. Cover the magic-link flow only in dedicated tests that own an inbox strategy, outside the shared setup.
4. Keep a per-endpoint credential table in the API test layer, derived from the handlers, so a test never assumes a PAT works where only the cookie does.

Unresolved: whether `signup` is reachable and allowed in each environment (production in particular), and how the session cookies set by the API response map onto the browser domain for `storageState`.

## Consequences

- **Positive:** login stays fast and deterministic (one HTTP call, no email, no OTP rate limit); one call yields both credential kinds; the magic-link risk is isolated in its own tests.
- **Negative / trade-offs:** the suite depends on a public provisioning endpoint that is itself a security finding (`nfr-security` NFR-SEC-011) and may be removed or locked down; the UI login path is not exercised by most tests; the per-endpoint table must track the handlers as more routes adopt `requireAuth`; every signin mints a new PAT row that nothing cleans up.
- **Neutral / follow-ups:** adapt `scripts/api-login.project.ts` and `config/variables.ts` auth endpoints in `/test-framework-adaptation`; revisit when scopes are enforced or Bearer support spreads.

## Alternatives considered

- **Drive the magic link in every test** — needs an inbox per test and hits Supabase's OTP rate limit; slow and flaky as shared setup.
- **PAT only** — reaches only the endpoints that call `requireAuth`; most of the API would be untestable.
- **Mint sessions with the service-role key directly against Supabase Auth** — bypasses the product's own endpoints and requires a privileged secret in the test environment.

## References

- Infra map: `bun run context:map infra-context --section architecture`, `--section nfr-security`
- Target code: `lib/api/auth.ts`, `lib/api/middleware/bearer.ts`, `app/api/v1/auth/`, `app/auth/callback/route.ts`
- ADR-0008 (browser session isolation in this repo), ADR-0010 (test isolation)
