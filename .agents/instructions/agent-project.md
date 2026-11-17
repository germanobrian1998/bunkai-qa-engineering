---
id: project
title: 'Project-specific instructions'
load_when: 'anything specific to this project: its own conventions, guardrails, environments or vocabulary not covered by another section'
triggers: []
paths: []
---

# Project-specific instructions

> Project-owned overlay. The boilerplate delivers this file once and never overwrites it; every other file in this folder is synced from upstream. Write this project's own rules here, one heading per topic, instead of editing `AGENTS.md` or a synced section. Knowledge about the system under test belongs in a project context skill (`<aspect>-context`), not here.

Add `triggers:` regex sources to the frontmatter above when a rule here should be routed by keyword (the hook reads them), and keep every `NEVER` / `MUST` line reachable: cite `Rule #N`, binding: `/<skill>`, or enforced: `bun run <script>` (checked by `bun run instructions:check`).

## Project context skills

One row per skill this project authored: the `<aspect>-context` skills `project-context` mode `context-skill` creates, and any other skill the project added. The skill router in `agent-skills-and-mcps.md` is synced, so `bun run up` overwrites a row written there; this file is never overwritten. Add each skill's trigger phrases to `triggers:` above as regex sources too, so the hook routes this file when a prompt names them. `bun run instructions:check` fails a row whose `.agents/skills/<slug>/SKILL.md` does not exist.

| Skill | Trigger | Purpose |
|---|---|---|

## Auth strategy in tests

Resolved by `/test-framework-adaptation`; decision record: `.context/ADR/ADR-0009-auth-in-tests-headless-signup-pat.md`.

- Branch: HYBRID. `POST /api/v1/auth/signin` returns session cookies, the session tokens and a PAT; the contract lives in `api/schemas/auth.types.ts`, never in a doc.
- API tests send the PAT as `Authorization: Bearer` (state in `.auth/api-state.json`, written by `tests/setup/api-auth.setup.ts`); lifetime comes from the response, via `tests/utils/patLifetime.ts`. There is no refresh token.
- UI tests reuse the cookie `storageState` (`.auth/user.json`, written by `tests/setup/ui-auth.setup.ts`). Endpoints that accept only the cookie session reject the PAT: call them through the UI fixture's request context. Rule #1: credentials by variable name only.
- Refresh: one mint per Playwright invocation, no staleness check (user decision 2026-11-10). The setups run on every invocation and CI starts clean each run, so session reuse is N/A by design.
- UI login is a two-step email-first form; `tests/components/ui/LoginPage.ts` owns the test ids. An unknown email in the UI continues to the signup step, so UI negative coverage is wrong-password only; unknown email is an API-level ATC in `tests/components/api/AuthApi.ts`.
- NEVER sign up users or drive the magic link inside a test: signup requires an email OTP before any session or PAT exists. Rule #12: an `@atc` id is a Jira Test key listed in `kata-manifest.json`, never invented.

## Test users and data

Decision record: `.context/ADR/ADR-0010-test-isolation-user-workspace-under-rls.md`.

- Roles are the pre-provisioned staging accounts in the QA workspace. Variable names: `.env.example` and `.env.schema` (owner required, the other roles optional). Rule #1 applies.
- Tests create and clean up their own data with unique names (`createTestId`, `DataFactory.createWorkspace` in `tests/data/`). Parallel workers share the accounts, so a name must never be reused across tests.
- Open risk: the wrong-password specs authenticate against the shared owner account on every run, which can trigger an auth rate limit; a dedicated negative-test account is the follow-up.

## OpenAPI source

- Source: the staging spec URL, which is `OPENAPI_SPEC_PATH`; synced with `bun run api:sync` (flags in `scripts/sync-openapi.ts`). Output: `api/openapi.json`, `api/openapi-types.ts`.
- Components import only the `@schemas/*` facades in `api/schemas/` (`auth.types.ts`, `workspace.types.ts`), never `@openapi`. The spec exposes no list-members endpoint: member checks go through `/v1/me` per user or the database.
- The local product checkout can lag staging: sync from the URL, not from the checkout.

## First entity and smoke

- First entity: Workspace, `tests/components/api/WorkspaceApi.ts` (read helpers only until `/test-automation` adds the write ATCs, e.g. BK-572).
- Smoke: `tests/integration/workspace/smoke.test.ts`, tag `@critical` (never `@smoke`), run with `bun run test:smoke` (run `TEST_ENV=staging` for the staging gate). Auth ATCs: BK-311 and BK-312 (`AuthApi`), BK-313 and BK-314 (`LoginPage`).
- MCP: `environments.*.db_mcp` and `api_mcp` in `.agents/project.yaml` name the single `dbhub` / `openapi` servers; Allure report name is set in `allurerc.mjs`.

## Open Discovery Gaps (framework adaptation)

Plan and dated results: `.context/reports/test-framework-adaptation-plan.md` (local, gitignored). Task evidence: `odd/tasks/framework-adaptation.md`.

- T7b: `bun run vars:check` fails on Jira catalog refs the Jira site does not yet satisfy (missing custom fields, a missing Story workflow transition); the full gate and `bun run repo:check` stop there until a Jira admin fixes the catalogs (`bun run jira:check` names each one). Not a framework defect.
- The `sdet` double-environment gate needs the local app on `localhost:3000` at a current product branch.
- CI: the role secrets are mapped in `regression.yml`, `smoke.yml` and `sanity.yml` (names in their `env:` blocks). The repo is public, so the Allure report ships as the `allure-report-<env>` run artifact, not on GitHub Pages; `scripts/ci/publish-allure-pages.ts` is unused, and the report portal (`PORTAL_URL`) is the private option.
- Session TTL is not recorded in any repo file.

## Project Assessment (Phase 1)

> Dated assessment of the system under test, written by `/project-discovery` Phase 1. Target: `upex-bunkai-tms` (`.context/project-config.md` → `## Repositories`). Re-run Phase 1 in UPDATE mode to refresh it; the facts below hold for the assessed commit, not for whatever the target holds later.

Assessment Date: 2026-11-17 · Assessed commit: `origin/staging` @ `4ccd8ede` (previous assessment: 2026-10-02, `main` @ `e88512e`)

### Testing Maturity: 2/4
- State: Moderate. The product now ships co-located `bun:test` suites (`*.test.ts` / `*.test.tsx` next to the code under `app/api/`, `lib/`, `components/`), up from none at the previous assessment. Several are DB-backed integration tests that run the real RLS path with a minted user JWT and skip when the Supabase env is absent (`lib/tests/rls-isolation.test.ts`).
- Frameworks: `bun test` (target `package.json` scripts `test`, `test:guarded` through `scripts/guard.sh`). No product E2E suite: the `*e2e*` files under the target `scripts/` test the inherited boilerplate tooling, not the product. This repo (Playwright + KATA) remains the only E2E surface.
- Coverage: unknown (no coverage tooling or threshold).
- QA hooks the product ships: QA guide route `/qa` (`app/qa/`), headless auth endpoints (`app/api/v1/auth/signup`, `signin`, `confirm`), Personal Access Tokens (`app/api/v1/tokens`), QA inspection DB roles (`supabase/migrations/0085_qa_inspector_role_bootstrap_and_function_grants.sql`).

### Documentation State: Good
- README: yes, but it is the inherited boilerplate README, not product documentation.
- API docs: yes. OpenAPI generated from `route.openapi.ts` files, served at `/api/openapi`, rendered at `/api/docs`; freshness enforced by the pre-commit and pre-push `openapi:check` gates.
- Architecture: yes, intent-level (target `.context/SRS/`, `.context/PRD/`, `.context/business/`); migrations carry rationale comments.
- Setup guide: partial (boilerplate `README.md` / `INSTALLER.md`; product env keys in `lib/env.ts`).

### Code Quality
- [x] ESLint: configured (`eslint.config.js`, `@antfu/eslint-config` + Next plugin)
- [x] Prettier: configured for data / style files only (`.prettierrc`, `format:check`)
- [x] TypeScript: strict (`tsconfig.json`)
- [x] Pre-commit hooks: configured (`.husky/pre-commit`: lint-staged, framework gates, conditional `openapi:check`; `.husky/pre-push`: framework gates plus `scripts/openapi-gen.ts --check`)

### CI/CD Maturity: None
- Still no `.github/workflows/` in the target repo. The unit and integration suites and every gate run only in local git hooks, which a contributor can skip. Deployment path (Vercel git integration assumed; `vercel.json` declares crons only) is unverified: `.context/project-config.md` → `## Discovery Gaps`.

### Identified Risks

| Risk | Severity | Evidence (path only) | Mitigation |
|------|----------|----------------------|------------|
| No CI: the product's unit and integration suites run only in skippable local hooks, and no product E2E exists | HIGH | target repo root (no `.github/`), target `package.json` `test` script | This repo's KATA regression is the only enforced gate; run it on every staging deploy; recommend CI to the product team |
| Tenant isolation rests entirely on RLS policies and SECURITY DEFINER helpers | MEDIUM | `supabase/migrations/0005_rls_helpers.sql`, `supabase/migrations/0118_member_write_paths_locked.sql` | Cross-tenant negative tests per role (viewer / member / admin / owner) |
| Supabase env key names differ between `.env.example` and the runtime validator | MEDIUM | `lib/env.ts`, target `.env.example` | Confirm deployed key names before environment setup |
| Destructive two-step migration for auth secrets (expand then drop) | MEDIUM | `supabase/migrations/0011_split_token_secrets.sql`, `supabase/migrations/0012_drop_legacy_token_hashes.sql` | Verify per environment that both steps are applied before testing token / invite / magic-link flows |
| Public signup: fixed since the previous assessment. It now returns `pending_confirmation` and mints the session and PAT only at `/api/v1/auth/confirm` after the email OTP | LOW | `app/api/v1/auth/signup/route.ts` | Keep abuse cases (OTP rate limit, reserved domains, length caps) in regression; tests still never sign up |
| Masked key-shaped strings in a test fixture (not a live secret) | LOW | `lib/billing/checkout.test.ts` | None needed; listed so a secret-scanner hit is not re-investigated |
| Placeholder JWT-shaped strings in docs (truncated examples, not live secrets) | LOW | `docs/architectures/supabase-nextjs/auth-tokens.md`, `docs/mcp/mcp-configuration-guide.md` | None needed |

### Phase Prioritization

- Phase 1: Normal -- UPDATE mode; 43 new migrations add domain terms.
- Phase 2: Extended -- new external integration surface (workspace Jira connections, automated run submission, storage cleanup).
- Phase 3: Extended -- still no CI and an env-key drift; a new cron.
- Phase 4: Normal -- Jira project `BK` holds the product backlog.

### Blockers
- [ ] None blocking Phase 2. The HIGH risk is carried to the MTP seed (`project-context` mode `test-plan`).
