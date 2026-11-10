# ADR-0009 — Auth in tests: hybrid signin, PAT as Bearer for API and cookie storageState for UI

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** Project owner, in the approved `/test-framework-adaptation` plan (`.context/reports/test-framework-adaptation-plan.md` §2, approved 2026-11-10) and the refresh-rule decision of the same day. Revises the 2026-10-02 `/project-discovery` Proposed draft in place (it was never Accepted).
- **Tags:** auth-in-tests, fixtures, api, e2e
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Every Bunkai test needs an authenticated principal. The product offers these ways to get one (infra map, `bun run context:map infra-context --section architecture`, "Auth flow"):

- **Magic link**: `POST /api/v1/auth/magic-link` emails a link that sets the `sb-*` session cookies. It needs a readable inbox and is subject to Supabase's OTP rate limit.
- **Headless signin**: `POST /api/v1/auth/signin` with email, password and optional PAT parameters (`pat_name`, `pat_expires_in_days`) returns the session cookies, the Supabase session tokens and a freshly minted PAT `bk_pat_*`. The contract is in `api/schemas/auth.types.ts`.
- **Headless signup**: now requires a 6-digit email OTP before any session or PAT exists, so a test cannot provision a user with it (re-verified against staging, 2026-11-10).
- **PAT as Bearer**: accepted only where a handler calls the dual-mode `requireAuth` (`lib/api/auth.ts`). The cookie-only endpoints (15 at verification time) reject Bearer; the list is derived from the handlers.
- **UI login** is a two-step email-first form: `login-email`, `login-continue`, `login-password`, `login-signin`. Success is a landing on `/projects` or `/onboarding` (both render the sidebar) plus `sidebar-search`.

Changing the choice later means rewriting the setups, the auth fixtures, the `api:login` adapter and every spec that assumes a credential shape.

## Decision

We take the HYBRID branch:

1. Obtain identity in tests only through `POST /api/v1/auth/signin` for the pre-provisioned role accounts (ADR-0010). No signup and no magic link in shared setup or in any test.
2. API tests use `pat.token` as `Authorization: Bearer`. `tests/setup/api-auth.setup.ts` writes it to `.auth/api-state.json`; token lifetime comes from `pat.expires_at` through `tests/utils/patLifetime.ts`; `refreshToken` is null.
3. UI tests use the session cookies saved as `storageState` (`.auth/user.json`, written by `tests/setup/ui-auth.setup.ts`). Calls to cookie-only endpoints go through the UI fixture's request context.
4. Refresh is a per-run mint: both setups run on every Playwright invocation, with no staleness check (project owner, option A, 2026-11-10). The PAT is requested with a 1-day expiry, which bounds the rows each run leaves behind. CI starts fresh every run, so session reuse is not applicable by design.
5. UI negative coverage is wrong-password only: an unknown email in the UI continues to the signup step. Unknown email is covered at API level (uniform 401 `unauthorized`).
6. The magic-link flow is out of scope until a dedicated test owns an inbox strategy.

## Consequences

- **Positive:** login is one HTTP call per credential kind, deterministic, with no email and no OTP rate limit; one call yields both credential kinds; the signin contract is typed from the live OpenAPI spec.
- **Negative / trade-offs:** every run mints a PAT that nothing deletes (1-day expiry bounds it); the setups cost a login per invocation even for a single spec; the UI login path is exercised only by the setup and the LoginPage ATCs; a spec must not assume a PAT works on a cookie-only endpoint.
- **Neutral / follow-ups:** the session cookie TTL is not recorded in any repo file; revisit if scopes become enforced or Bearer support spreads to more handlers; a staleness check is a later option if setups become the dominant run cost.

## Alternatives considered

- **Signup per test or per worker** (the original proposal) — dropped: signup now requires an email OTP, so no fresh user can be created headlessly.
- **Drive the magic link in every test** — needs an inbox per test and hits Supabase's OTP rate limit; slow and flaky as shared setup.
- **PAT only** — reaches only the endpoints that call `requireAuth`; the cookie-only endpoints would be untestable.
- **Cookies only** — works everywhere in the UI but gives the API tests no Bearer path and no PAT behaviour coverage.
- **Reuse `.auth/*` across runs with a staleness check** — rejected for now as extra moving parts; per-run mint is simpler and CI is fresh anyway.
- **Mint sessions with the service-role key against Supabase Auth** — bypasses the product's own endpoints and needs a privileged secret in the test environment.

## References

- Infra map: `bun run context:map infra-context --section architecture`, `--section nfr-security`
- Code: `tests/setup/api-auth.setup.ts`, `tests/setup/ui-auth.setup.ts`, `tests/components/api/AuthApi.ts`, `tests/components/ui/LoginPage.ts`, `tests/utils/patLifetime.ts`, `api/schemas/auth.types.ts`
- Target code: `lib/api/auth.ts`, `lib/api/middleware/bearer.ts`, `app/api/v1/auth/`
- ADR-0008 (browser session isolation in this repo), ADR-0010 (test isolation)
