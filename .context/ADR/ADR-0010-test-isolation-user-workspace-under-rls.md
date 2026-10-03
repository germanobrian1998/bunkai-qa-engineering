# ADR-0010 — Test isolation: mutating tests own a fresh user and workspace under RLS

- **Status:** Proposed
- **Date:** 2026-10-02
- **Deciders:** QA architect / lead (open); drafted by `/project-discovery` Phase 2 from the Bunkai TMS code at `upex-bunkai-tms` `main` `e88512e`
- **Tags:** isolation, parallelization, test-data, fixtures
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Bunkai is multi-tenant by workspace. Row Level Security is enabled on every table and membership checks go through SECURITY DEFINER helpers (`supabase/migrations/0005_rls_helpers.sql`), so a user sees and changes only the workspaces they belong to, with role levels `viewer` < `member` < `admin` < `owner`. A workspace and its owner membership are created atomically by `POST /api/v1/workspaces` (RPC `bunkai_bootstrap_workspace`, `supabase/migrations/0006_bootstrap_workspace.sql`), and users can be provisioned headlessly by `POST /api/v1/auth/signup` (see ADR-0009).

There is no API to delete users, workspaces or projects, and no transactional reset is available to tests (the app reaches the database only through PostgREST). Tests that share one user and one workspace would race on the same rows when run in parallel, and their state would leak between runs. Switching isolation models later means reworking every fixture and the data-setup layer.

## Decision

We will (proposal):

1. Give each Playwright worker (and each test whose mutations would collide inside a worker) its own user from `signup` and its own workspace from `POST /workspaces`, with unique slugs from faker plus the worker index.
2. Rely on RLS as the isolation boundary: a test only ever touches its own workspace, so parallel workers cannot see each other's data.
3. Keep the `.env` test users (`<ENV>_USER_EMAIL`) for read-only and smoke checks that must not create data.
4. Multi-role scenarios invite extra fresh users into the test's workspace through the invite API, taking the accept URL from the response.

Unresolved: the cleanup strategy for accumulated users and workspaces on staging (no delete API), and whether this is allowed outside staging.

## Consequences

- **Positive:** parallel-safe by construction; no ordering dependencies between tests; RLS itself gets exercised by every test; role scenarios are reproducible.
- **Negative / trade-offs:** staging accumulates users, workspaces and PAT rows with no product-level cleanup, so a DB-side purge job (or a periodic reset) becomes a requirement; setup costs extra HTTP calls per worker; the strategy depends on the public `signup` endpoint (ADR-0009) and fails if it is locked down; Supabase Auth limits on user creation are unknown.
- **Neutral / follow-ups:** decide the purge mechanism (service-role script or `[DB_TOOL]`) before the suite grows; record slug and email prefixes so the purge can target test data only.

## Alternatives considered

- **One shared seeded workspace** — simple, but parallel tests collide and state leaks across runs.
- **Transactional rollback per test** — not available: the app talks to Postgres through PostgREST, not a connection the test can wrap.
- **Database reset between runs** — possible on a disposable local Supabase, not on a shared staging project.

## References

- Infra map: `bun run context:map infra-context --section architecture`, `--section discovery-gaps`
- Domain map: `bun run context:map business-domain-context --section term-workspace`
- Target code: `supabase/migrations/0001_tenancy.sql`, `supabase/migrations/0005_rls_helpers.sql`, `app/api/v1/workspaces/route.ts`, `app/api/v1/workspaces/[id]/invites/route.ts`
- ADR-0009 (auth in tests)
