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
- CI: role secrets are not wired yet (add them with the first multi-role test); GitHub Pages and the report portal are not enabled.
- Session TTL is not recorded in any repo file.

## Project Assessment (Phase 1)

> Dated assessment of the system under test, written by `/project-discovery` Phase 1. Target: `upex-bunkai-tms` (`.context/project-config.md` → `## Repositories`). Re-run Phase 1 in UPDATE mode to refresh it; the facts below hold for the assessed commit, not for whatever the target holds later.

Assessment Date: 2026-10-02 · Assessed commit: `main` @ `e88512e`

### Testing Maturity: 0/4
- State: None. No unit, integration or E2E test files in the product code (`app/`, `components/`, `lib/`, `supabase/`) and no test script in the target `package.json`.
- Frameworks: none in the target. This repo (Playwright + KATA) is the only automated test surface.
- Coverage: unknown (no coverage tooling).
- QA hooks the product already ships: a QA guide route `/qa` (`app/qa/`), headless auth endpoints for test users (`app/api/v1/auth/signup`, `app/api/v1/auth/signin`), Personal Access Tokens (`app/api/v1/tokens`), dedicated DB roles for QA inspection (referenced in `supabase/migrations/0011_split_token_secrets.sql`).

### Documentation State: Good
- README: yes, but it is the inherited boilerplate README, not product documentation.
- API docs: yes. OpenAPI generated from `route.openapi.ts` files, served at `/api/openapi`, rendered at `/api/docs`.
- Architecture: yes, intent-level (target `.context/SRS/architecture-specs.md`, `.context/PRD/`, `.context/business/`); migrations carry rationale comments.
- Setup guide: partial (boilerplate `README.md` / `INSTALLER.md`; product env keys in `lib/env.ts`).

### Code Quality
- [x] ESLint: configured (`eslint.config.js`, `@antfu/eslint-config` + Next plugin)
- [x] Prettier: configured for data / style files only (`.prettierrc`, `format:check`)
- [x] TypeScript: strict (`tsconfig.json`)
- [x] Pre-commit hooks: configured (`.husky/pre-commit` runs lint-staged + type check; `.husky/pre-push` runs `repo:check`)

### CI/CD Maturity: None
- No `.github/workflows/` in the target repo. Quality gates run only in local git hooks, which a contributor can skip. Deployment pipeline (Vercel git integration assumed) is unverified: `.context/project-config.md` → `## Discovery Gaps`.

### Identified Risks

| Risk | Severity | Evidence (path only) | Mitigation |
|------|----------|----------------------|------------|
| No automated tests in the product | HIGH | target `package.json`, `app/`, `lib/` | This repo's KATA suite is the safety net; prioritize auth, tenancy (RLS) and ATC save in the MTP |
| Public signup endpoint: assessed commit created pre-confirmed users and minted a PAT; later spec requires an email OTP before any session or PAT (re-verified 2026-11-10) | HIGH | `app/api/v1/auth/signup/route.ts` | Test abuse cases (open registration, OTP rate limit, scope defaults); tests never sign up (see `## Auth strategy in tests`) |
| No CI pipeline: gates are local-only | MEDIUM | target repo root (no `.github/`) | Run this repo's regression on deploy; recommend CI to the product team |
| Tenant isolation rests entirely on RLS policies and SECURITY DEFINER helpers | MEDIUM | `supabase/migrations/0005_rls_helpers.sql`, `supabase/migrations/0006_bootstrap_workspace.sql` | Cross-tenant negative tests per role (viewer / member / admin / owner) |
| Supabase env key names differ between `.env.example` and the runtime validator | MEDIUM | `lib/env.ts`, target `.env.example` | Confirm deployed key names before environment setup |
| Destructive two-step migration for auth secrets (expand then drop) | MEDIUM | `supabase/migrations/0011_split_token_secrets.sql`, `supabase/migrations/0012_drop_legacy_token_hashes.sql` | Verify per environment that both steps are applied before testing token / invite / magic-link flows |
| Placeholder JWT-shaped strings in docs (truncated examples, not live secrets) | LOW | `docs/architectures/supabase-nextjs/auth-tokens.md`, `docs/mcp/mcp-configuration-guide.md` | None needed; listed so a secret scanner hit is not re-investigated |

### Phase Prioritization

- Phase 1: Normal -- product intent docs exist; code scope is small and readable.
- Phase 2: Normal -- single app, architecture docs exist as intent; verify them against code.
- Phase 3: Extended -- no CI and an env-key drift: environments and deploy path need human confirmation.
- Phase 4: Normal -- Jira project `BK` already holds the product backlog.

### Blockers
- [ ] None blocking Phase 2. The two HIGH risks are carried to the MTP seed (`project-context` mode `test-plan`).
