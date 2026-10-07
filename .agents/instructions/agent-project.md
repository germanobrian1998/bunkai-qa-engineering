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
| Unauthenticated endpoint creates pre-confirmed users and mints a PAT with every scope by default | HIGH | `app/api/v1/auth/signup/route.ts` | Confirm whether it is meant to be exposed outside QA environments; test abuse cases (open registration, scope defaults) |
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
