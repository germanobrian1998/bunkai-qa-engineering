# Feature: framework-adaptation

- Locator: `odd/tasks/framework-adaptation.md` (Engram mirror: `odd/framework-adaptation/tasks`)
- Branch: `chore/framework-adaptation` (off `main`, strategy `sdet` Plus Branch, PR to `main`)
- Approved plan: `.context/reports/test-framework-adaptation-plan.md` (gitignored report; approved 2026-11-10)
- TDD: off (no project/session TDD config; source: none). Checks per phase: the workflow's own verify commands.
- Delivery strategy: `ask-on-risk`. Delivery decision (user, 2026-11-10): single PR #1 (`chore/framework-adaptation` -> `main`), kept as draft and fed one push per phase; merged by the user only after T8 (full gate) passes. Forecast ~900 authored changed lines (large share is deletions of `Example*` + generated `api/openapi-types.ts` excluded).

## Objective

Make the KATA framework Bunkai-specific so `/test-automation` passes its readiness gate (no `Example*`, clean manifest, green toolchain, `vars:check` exit 0).

## Scope / constraints

- Repo-only writes; `../upex-bunkai-tms` read-only.
- Test users: the 4 existing staging roles (user decision 2026-11-10). No signup in tests.
- Credentials by name only (Rule #1). No invented `@atc` ids (Rule #12).

## Tasks

- [x] T3 Phase 3: `project.yaml` MCP names -> `dbhub`/`openapi`; `tokenEndpoint` -> `/v1/auth/signin`; declare role vars in `.env.schema` + `.env.example`. Route: inline (mechanical, 4 small files). verify: `vars:env:check`, `vars:schema:check`, `test:env:check` exit 0.
  - Evidence 2026-11-10: `vars:env:check` exit 0, `vars:schema:check` exit 0 (50 items), `test:env:check` exit 0, `types:check` exit 0. Role vars in `.env.example` kept commented: `vars:env:check` rejects uncommented non-manifest keys (ORPHAN_KEY).
- [x] T4 Phase 4: `api:sync` from staging; `auth.types.ts`, `workspace.types.ts`, `index.ts`. verify: `types:check`. Route: delegated writer (3 non-trivial files).
  - Evidence 2026-11-10: `api:sync` 110 endpoints, `openapi-types.ts` 14,671 lines (generated, excluded from line budget). `types:check` exit 0, `lint:check` exit 0, no `@openapi` in `tests/components/`. Legacy auth types kept `@deprecated` until T5. `example.types.ts` bridged to local `any` aliases (real spec has no example schemas) until T6 deletes it. Spec gap: no list-members endpoint.
- [x] T5 Phase 5: AuthApi, LoginPage, setups; Jira Test keys for ATCs. verify: api-setup, ui-setup, `api:login staging`. Route: delegated writer (5 non-trivial files).
  - Evidence 2026-11-10 (re-run by orchestrator): `types:check` 0, `lint:check` 0, `kata:manifest:check` up to date (4 components, 8 ATCs); `TEST_ENV=staging` api-setup + ui-setup PASSED (signin intercept works, R3 closed); `.auth/api-state.json` + `.auth/user.json` non-empty; curl `/v1/me` with `API_TOKEN_USER_STAGING` = 200. ATC ids from existing BK-166 Tests: BK-311/312 (AuthApi), BK-313/314 (LoginPage). Legacy auth types removed. Invalid-credential ATCs (BK-312/314) not run yet. `user-session.test.ts` edited only to compile; rewrite in T6.
- [x] T6 Phase 6: WorkspaceApi, fixtures, data, smoke `@critical`, delete examples. verify: smoke passes. Route: delegated writer (8+ files).
  - Evidence 2026-11-10 (re-run by orchestrator): `types:check` 0, `lint:check` 0, `kata:manifest:check` up to date, 0 `Example` in manifest (3 components, 4 ATCs). Staging integration+e2e: 7 specs passed, 0 failed (BK-166 x6 incl. BK-312 wrong password + unknown email, BK-314 wrong password; BK-4 workspace read). `test:smoke`: 2 `@critical` passed. WorkspaceApi = read helpers only (no new `@atc`). Workspace smoke story key BK-4 (`STORY-BK-4` story.md lists GET /workspaces/{id}). Found: unknown email in UI goes to the signup step (check-email `exists:false`), so BK-314 covers wrong password only; /onboarding renders AppSidebar (carried item closed). Open for T8: setups re-run on every invocation (Playwright dependency projects), so "session reuse" signal fails by design of per-run mint.
- [x] T7 Phase 7: `kata:manifest`, `allurerc.mjs`, CI secrets block. verify: `kata:manifest:check`. Route: inline (1 file + CLI).
  - Evidence 2026-11-10: `allurerc.mjs` name `Bunkai QA` (`f71c862`); `kata:manifest:check` up to date; `agents:compat:check` OK; `harness:env:check` OK; `dbhub.toml` single `primary` source on `DBHUB_*`; workflows already `local`/`staging` + `@critical`. GitHub had no secrets: pushed by name via `varlock run | gh secret set` (user decision): `STAGING_USER_EMAIL/PASSWORD`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `XRAY_CLIENT_ID/SECRET`, `AUTO_SYNC`; Variable `TMS_PROVIDER`. Read back with `gh secret list` / `gh variable list`: all 8 present. Not set (absent from .env): `LOCAL_USER_*` (CI targets staging), `SLACK_WEBHOOK_URL` (optional), `STP_EXECUTION_KEY` (set per sprint by /regression-testing), `PORTAL_*`/`R2_*` (private portal not used). GitHub Pages not enabled.
- [ ] T7b Fix `vars:check` (10 Jira catalog refs in `shift-left-testing`). Cause (jira:check 2026-11-10): Jira lacks fields `ai_effort`, `development_token_usage`, `quality_token_usage`; `story.refined` transition absent from `jira-required.yaml` + `jira-workflows.json`. Needs Jira admin. Detail: (1) create custom fields `AI Effort` (select: low, medium, high), `Development Token Usage (K)` (number), `Quality Token Usage (K)` (number), then `bun run jira:sync-fields --force`; (2) Story workflow has no `shift_left_qa -> ready_for_dev` transition (`refined` in the upstream shift-left skill); live options: add one in Jira, or map to the global `Ready For Dev` (id 24) by declaring `refined` in `jira-required.yaml` + `bun run jira:sync-workflows`. Until fixed, branch commits use `--no-verify` (user decision 2026-11-10) with the hook gates run by hand. verify: `vars:check` exit 0.
- [ ] T8 Phase 8: full gate (13 steps).
- [ ] T9 Phase 9: genericness table, `agent-project.md`, ADR-0009/0010 revision, plan COMPLETED.

## Progress / evidence

- 2026-11-10: Phases 0-2 done; plan approved ("sigue la fase 3"). Branch created.
- 2026-11-10: T3 committed `70c413d` (was `226ffb0` before split) (`--no-verify`, hook gates run by hand: types, skills, eslint, prettier, vars:env, vars:schema). Review assess: risk medium, `review_due: false`, reason `under_budget` (71 lines, pending in slice).
- 2026-11-10: review on main..4c22a00 failed `lens_context_budget_exceeded` (generated openapi-types.ts). Unpushed branch re-split with `reset --soft main`: `8fb1704` generated types (+ example bridge), `70c413d` T3, then T4 facades. Review base for the slice = `8fb1704`.
- 2026-11-10: native review lineage `review-9959d91101d2edf3` on `8fb1704..794de95` (267 lines, risk high, auth hot path): APPROVED and acknowledged. 12 advisory findings, non-blocking. Fixed R4 (role vars no longer `@required=forEnv(staging)`). Carried to T5: R3 tokenEndpoint intercept unverified until ui-setup runs; legacy `TokenResponse` removal. Noted: single `dbhub`/`openapi` server for both envs is intended (only one server is declared; earlier per-env names resolved to nothing). Reviewed boundary advances to `794de95`.
- 2026-11-10: review lineage `review-b3f4ecf4eaf33351` on `9607517..b842eb3` (305 lines, high): APPROVED, acknowledged, 12 advisory findings. Fixed: ApiState `expiresIn` now from `pat.expires_at`, `refreshToken: null` (R2/R3/R4 mismatch). Carried to T6: run BK-312/BK-314 (invalid creds; two-step form may stop at Continue for unknown email), onboarding redirect without sidebar, PAT accumulation per run (bounded by 1-day expiry). Reviewed boundary advances to `b842eb3`.
- 2026-11-10: review lineage `review-57245d49ebfecd32` on `b842eb3..0f056be` (1,015 lines, high): APPROVED, acknowledged, 10 advisory findings. Fixed: NaN-safe shared `patLifetimeSeconds` helper (`tests/utils/patLifetime.ts`) used by both setups; WorkspaceApi endpoint doc clarified. Open gap: wrong-password specs (BK-312/314) hit the shared owner account every run; no rate limit in the signin route, but Supabase auth limits could lock it out under heavy CI; consider a dedicated negative-test account. Reviewed boundary advances to `0f056be`.
- Engram mirror: PENDING (auto mode could not review `mem_save`: a hook changes its input).

## Next step

T8 (Phase 8: full gate) after the session-reuse decision; T7b waits on the Jira admin.
