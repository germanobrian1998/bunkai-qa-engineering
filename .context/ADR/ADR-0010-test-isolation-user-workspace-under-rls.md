# ADR-0010 — Test isolation: pre-provisioned role accounts and per-test unique data in the QA workspace, under RLS

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** Project owner, test-user decision of 2026-11-10 in the approved `/test-framework-adaptation` plan (`.context/reports/test-framework-adaptation-plan.md` §2). Revises the 2026-10-02 `/project-discovery` Proposed draft in place (it was never Accepted).
- **Tags:** isolation, parallelization, test-data, fixtures
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Bunkai is multi-tenant by workspace. Row Level Security is enabled on every table and membership checks go through SECURITY DEFINER helpers (`supabase/migrations/0005_rls_helpers.sql`), so a user sees and changes only the workspaces they belong to, with role levels `viewer` < `member` < `admin` < `owner`. A workspace and its owner membership are created atomically by `POST /api/v1/workspaces`.

There is no API to delete users, workspaces or projects, and no transactional reset is available to tests (the app reaches the database only through PostgREST). The first proposal gave each worker a fresh user from `signup`; that is no longer possible because signup requires a 6-digit email OTP before any session or PAT exists (ADR-0009). Four staging accounts already exist in the QA workspace, one per role.

## Decision

1. Use the pre-provisioned staging role accounts: owner, admin, member and viewer in the QA workspace. Variable names live in `.env.example` and `.env.schema` (owner required, the other roles optional). No user is created by a test.
2. Isolate by data, not by user: every test creates its own entities with unique names (`createTestId`, `DataFactory.createWorkspace` in `tests/data/`) and cleans them up. Parallel workers share the accounts, so a name is never reused across tests or workers.
3. RLS remains the tenant boundary. Read-only and smoke checks read the QA workspace without creating data.
4. Multi-role scenarios sign in with the matching role account instead of inviting fresh users; role secrets are wired into CI when the first multi-role test lands.

## Consequences

- **Positive:** no dependency on the signup endpoint or an inbox; parallel-safe as long as names are unique; RLS is exercised through real role accounts; setup cost is one signin per role.
- **Negative / trade-offs:** the accounts are shared, so a test that leaks data or changes account-level state affects every run; the wrong-password specs authenticate against the shared owner account on every run, which can trip a Supabase auth rate limit and lock the account for all tests; staging accumulates test data when cleanup fails, and there is no delete API for some entities; member checks have no list-members endpoint and use `/v1/me` per user or the database.
- **Neutral / follow-ups:** create a dedicated negative-test account so wrong-password specs stop hitting the owner; decide a purge mechanism for orphaned test data before the suite grows; add role secrets to CI with the first multi-role test.

## Alternatives considered

- **Fresh user and workspace per worker via signup** (the original proposal) — dropped: signup requires an email OTP, so no headless provisioning; it also left no cleanup path for users.
- **One shared seeded workspace with fixed names** — parallel tests collide and state leaks across runs.
- **Transactional rollback per test** — not available: the app talks to Postgres through PostgREST, not a connection the test can wrap.
- **Database reset between runs** — possible on a disposable local Supabase, not on a shared staging project.

## References

- Infra map: `bun run context:map infra-context --section architecture`, `--section discovery-gaps`
- Domain map: `bun run context:map business-domain-context --section term-workspace`
- Code: `tests/data/DataFactory.ts`, `tests/components/api/WorkspaceApi.ts`, `.env.schema`
- Target code: `supabase/migrations/0001_tenancy.sql`, `supabase/migrations/0005_rls_helpers.sql`, `app/api/v1/workspaces/route.ts`
- ADR-0009 (auth in tests)
