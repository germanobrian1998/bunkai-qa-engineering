# ADR-0018 — Test login budget under the product's sign-in throttle

- **Status:** Accepted (by the owner, 2026-11-17)
- **Date:** 2026-11-17
- **Deciders:** Project owner, 2026-11-17. Drafted by `/project-discovery` (Phase 2 UPDATE, 2026-11-17).
- **Tags:** auth-in-tests, fixtures, rate-limit, ci
- **Supersedes:** ADR-0009, for the §Consequences claim that login has no rate limit only. Its hybrid signin, credential kinds and per-run mint stand.
- **Superseded by:** —

---

## Context

This decision was discovered, not made in a session: the code already worked around the constraint, but no ADR recorded why. The project owner confirmed it on 2026-11-17.

Since 2026-11-13 (target commit `97363b95`, BK-1828), the product throttles password sign-in and code confirm (target `lib/auth/rate-limit.ts`, migration `supabase/migrations/0103_auth_rate_limit.sql`):

- Per network source: 10 attempts per 60 s and 60 per hour (`CREDENTIAL_SOURCE_WINDOWS`).
- Per account: 10 attempts per 15 min (`CREDENTIAL_ACCOUNT_WINDOWS`).
- Counts live in Postgres (`bunkai_rate_limit_consume`). The source is a salted digest of the request's network origin. A rejected attempt returns the published `rate_limited` outcome (429) with a retry hint.

ADR-0009 (Accepted 2026-11-10) mints credentials on every Playwright run. Its Consequences say login has "no OTP rate limit". That holds for the OTP, but the password sign-in it relies on is now throttled. This repo already adapted in code: `tests/setup/role-sessions.setup.ts` signs each workspace role in once, sequentially, and cites the windows. ADR-0009 does not record this.

Per run, the shared setups sign in about six times from one source: the UI setup, the API setup, and one per workspace role (Owner, Admin, Member, Viewer). Two runs inside one minute from the same network source (a local re-run, parallel CI jobs, a retry) can exceed the source window. More than about five runs in 15 minutes for the same account can exceed the account window. Either case surfaces as an intermittent 429 in setup, not as a product defect.

## Decision

Keep the per-run mint (ADR-0009 point 4) and treat the throttle as a fixed budget the suite must stay under:

1. Every sign-in in shared setup stays sequential and happens once per account per run. No spec signs in on its own except the LoginPage and AuthApi ATCs that test login itself.
2. A 429 `rate_limited` in a setup is reported as an environment failure (budget exceeded), never as a product failure, and is not retried inside the same window.
3. CI jobs that hit the same environment do not run setups in parallel from one runner network source.
4. If the budget becomes the limiting factor, the next step is reusing `.auth/*` across runs with a staleness check (the alternative ADR-0009 deferred), before adding more role accounts.

## Consequences

- **Positive:** setup failures caused by the throttle are classified correctly in regression triage; the auth fixture topology stays as ADR-0009 defines it.
- **Negative / trade-offs:** back-to-back local re-runs inside a minute can still fail; CI parallelism against one environment is capped by the source window.
- **Neutral / follow-ups:** confirm with the product team whether the rate-limit buckets are shared between environments that share a database; re-check the windows whenever `lib/auth/rate-limit.ts` changes.

## Alternatives considered

- **Reuse cached credentials across runs now** — fewer sign-ins, but adds the staleness check ADR-0009 rejected as extra moving parts; kept as the escape hatch (Decision point 4).
- **More role accounts to spread the per-account window** — eases only the account window, not the source window, and adds provisioning work.
- **Ask the product for a test bypass of the limiter** — removes the constraint but tests a path production does not run; a new security posture the product owns.

## References

- ADR-0009 (auth in tests), ADR-0010 (test isolation)
- Infra map: `bun run context:map infra-context --section nfr-security`, `--section backend`
- Code: `tests/setup/role-sessions.setup.ts`, `tests/setup/ui-auth.setup.ts`, `tests/setup/api-auth.setup.ts`
- Target code: `lib/auth/rate-limit.ts`, `supabase/migrations/0103_auth_rate_limit.sql`, `app/api/v1/auth/signin/`
