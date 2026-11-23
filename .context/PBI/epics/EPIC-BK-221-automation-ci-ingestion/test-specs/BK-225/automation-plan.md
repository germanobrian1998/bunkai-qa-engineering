# Test Automation Plan: BK-225

> Ticket: BK-225 — TMS-Run Reporting | Filter runs by manual or automated execution mode
> Type: e2e (5 TCs, two of them hybrid UI + API) + integration (2 TCs)
> Sprint: n/a (regression automation of a QA-tested Story)
> Created: 2026-11-21
> Status: approved, revised 2026-11-21 for frozen fixtures (ADR-0029); implemented
> Code rule: no comments in code (Critical Rule #18). Only toolchain directives and one-line WHY a reader would get wrong. Page IDs, endpoints and counts live in this plan and the atc/*.md files, not in the code.

## 1. Ticket Summary

- What to test: the seven signed Candidates BK-1963, BK-1967, BK-1974, BK-1975, BK-1982, BK-1983, BK-1992 (spec.md).
- Acceptance criteria covered: AC2 / 2.1, 2.2, 2.5; AC3 / 3.1 to 3.4, 3.7; AC4 / 4.4; Business Rule V.2; charter and BK-1990 (BK-1983); BK-1991 (BK-1992).
- Endpoint under test: `GET /api/v1/projects/{id}/runs/report` (Bearer `atc:read` or cookie). Response `RunReportPage`: `items[]` (`id`, `executor_mode`, `status`, `started_at`, ...), `totals {passed, failed, manual, automated}`, `scope {has_runs, has_automated}`, `next_cursor`. Query: `date_from`, `date_to` (YYYY-MM-DD, real calendar dates), `module_id`, `status` (repeatable: passed, failed, aborted; never running), `executor` (repeatable: human, agent, ci), `limit` (1..50), `cursor`. No `mode` parameter exists. Errors: 400 bad cursor or non-UUID project, 403 missing scope, 404 missing/foreign project, 422 validation.
- Screen under test: `/projects/{projectSlug}/runs` (client view `ProjectRunsReportView`).
- Code evidence (read-only, `origin/staging` of `../upex-bunkai-tms`; the checked-out branch is behind and has none of BK-225): `lib/runs/run-mode.ts` (`executorsForMode`, `resolveModeFilter`), `lib/runs/report-view.ts` (empty-state precedence, copy), `lib/runs/report-validation.ts` (`isCalendarDate`, BK-1990), `app/api/v1/projects/[id]/runs/report/route.ts` (`requires: ['atc:read']`, P0002 to 404), `components/runs/ProjectRunsReportView.tsx`, `components/runs/RunModeBadge.tsx`.
- Types: `api/openapi-types.ts` already holds `RunReportPage`, `RunReportTotals` (with `manual`, `automated`), `RunCreateBody`, `RunSubmissionBody`. `bun run api:sync` is NOT required to start; run it once at the beginning of Code to confirm the committed types match staging (not run by this plan). New facade `api/schemas/runs.types.ts` (+ `index.ts` export) is needed.
- Dependencies (other tickets): none to wait for. Run data comes from frozen fixtures built during sprint testing (section 4, ADR-0029).

## 2. Architecture Decisions

> ADR promotion check (adr-doctrine section 1): D2 (frozen discovered fixtures instead of per-test data) passes the three gates and is recorded as ADR-0029. Everything else is ticket-local.

### Component Strategy

Manifest check (kata-manifest.json, generated 2026-11-19): api components ActivityApi, AuthApi, BugApi, InviteApi, WorkspaceApi; ui LoginPage, MembersPage; steps MemberRemovalSteps. None of `RunsApi`, `RunsReportPage`, `RunFixtureSteps` exists. None of the seven ATC IDs exists in `atcs[].id` (existing: BK-311, BK-312, BK-313, BK-314, BK-1656, BK-1657, BK-1664, BK-1665). The manifest forbids two methods with one `@atc` ID (`findDuplicateAtcIds`), so there is exactly one method per TC key.

| Decision | Value | Rationale |
|----------|-------|-----------|
| D1 Components | New: `RunsApi` (report ATCs and `getReport`), `RunsReportPage`, `RunFixtureSteps`. `WorkspaceApi` gains `findProjectBySlug`. Reused: `AuthApi` (`provisionToken` extended with an optional `name`, so BK-225 tokens are revocable apart from BK-572 ones). No `ProjectApi` or `AuthoringApi`: nothing is created, so there is no authoring chain | One component per resource (KATA layer 3) |
| D2 Run data policy | Frozen discovered fixtures (ADR-0029). No project is created and no run is seeded. Each test Discovers its project by fixed name, checks the composition it depends on (`RunFixtureSteps.assertComposition`, every executor x outcome count) and fails "fixture broken: <project> holds <counts>, expected <counts>" on drift. It never tops up. Expected totals are literals from the recipes in section 4. A state no fixture holds is `test.skip(true, reason)` for that partition. The one creation is the empty project of BK-1992, made once by hand in the Member's own workspace | The Owner workspace is on the community plan (3 projects, all used): `POST /projects` answers 422 `project_limit_reached`. Supersedes the first draft of ADR-0029 (generated projects). Cost: shared mutable data, a manual change to a fixture fails the tests until restored |
| D3 Credentials | One Owner cookie session (`.auth/role-owner.json`) reads `GET /v1/me` and mints workspace-bound `atc:read` PATs (name `kata-bk225-fixture`, 1 day), revoked in `afterAll`. The Member cookie session (`.auth/role-member.json`) reaches the Member-workspace projects (API and, for BK-1992, the browser through `test.use({ storageState })` plus the `bk_active_ws` cookie) | `POST /tokens` is cookie-only; no `run:execute` or `atc:write` is needed because nothing is written |
| D4 Project config | Add `**/runs/report/**` to the role-project matchers and to `BASE_IGNORE` in `playwright.config.ts` (the `e2e-roles`, `integration-roles`, `smoke-roles-ui`, `smoke-roles-api` projects), exactly as `workspace/members` is handled today. All seven files live under `tests/{e2e,integration}/runs/report/`. Config edit is part of the first implementation commit | The role state file only exists in the role projects (staging only). Without the ignore the same files would also run in plain `e2e`/`integration` and fail on a missing file |
| D5 Verification surface | Three oracles for totals: (1) the API response, (2) the UI chips, (3) the fixture recipe (literal counts recorded in `tests/data/constants.ts`, verified by `assertComposition` and by the DB MCP). The signed "database count" is performed at Code time through the read-only DB MCP and attached to the PR evidence; test code has no DB client and the runs table exposes no grants to `anon` or `authenticated` (checked with the DB MCP, read-only), so a data-API oracle is not possible | Lying-test guard: no expected value is derived from the response under test |
| D6 Setup mutations | Provisioning calls are `@step` helpers named `provision*` (not `@atc`), same exception as BK-572 D4: no signed TC owns them | Preconditions, not business outcomes under test |
| Fixture | `{ test }` for the five e2e files (UI action + API oracle); `{ test }` plus the `playwright` fixture in `beforeAll` (to open the cookie and Bearer contexts through `RunFixtureSteps`) for all seven files | Fixture selection rule |
| Waits | `interceptResponse` / `waitForApiResponse` around the click that triggers the report request, `expect(locator)` web-first assertions for the loading state. No `waitForTimeout` | Conditions, never timeouts |
| Params | Max 2 positional parameters; 3 or more go in an object. Import aliases only (`@api/...`, `@ui/...`, `@steps/...`, `@schemas/...`, `@data/...`, `@variables`, `@TestFixture`) | typescript-patterns section 1 and 8 |

### [E2E ONLY] UI Elements (`RunsReportPage`, route `/projects/{slug}/runs`)

Locators inline in the ATC; promote to a `private readonly` arrow function only when a second ATC of the component uses the same locator (`reportRows`, `modeGroup` and `totals` are used by 2 or more, so they become shared arrows at Code time).

| Element | Locator Strategy | Locator Value |
|---------|------------------|---------------|
| Mode group | testid | `report-filter-mode` (attribute `data-mode-state`: all, manual, automated, custom) |
| Mode buttons | testid | `report-mode-all`, `report-mode-manual`, `report-mode-automated` (`aria-pressed`); `report-mode-custom` when custom |
| Executor group | testid | `report-filter-executor`; buttons `report-executor-human`, `report-executor-agent`, `report-executor-ci` (`aria-pressed`) |
| Status buttons | testid | `report-status-passed`, `report-status-failed`, `report-status-aborted` |
| Rows | testid | `report-rows` (tbody), `report-row-{runId}` |
| Mode badge | testid + attribute | `run-mode-badge` inside a row, `data-mode` manual or automated; text Manual or Automated; icon present |
| Executor cell | role (no testid today) | the 5th `td` of the row (columns: Run, Test, Module, Environment, Executor, Mode, Outcome, Ran). Open question O4 asks for a testid |
| Totals | testid | `report-totals`, `report-total-passed`, `report-total-failed`, `report-total-manual`, `report-total-automated` (text "Manual 10", "Automated 51"; `—` while loading) |
| Scope label | testid | `report-scope-label` ("N runs loaded in current scope · more available") |
| Pagination | testid | `report-load-older` |
| Empty states | testid | `report-empty-no-runs` (title "No runs yet for this Project"), `report-empty-no-match`, `report-empty-no-automated` |
| Clear filters | testid | `report-clear-filters` |

### [INTEGRATION ONLY] API Details

| Aspect | Value |
|--------|-------|
| Endpoint(s) | Under test: `GET /v1/projects/{id}/runs/report`. Setup (reads and the PAT only): `POST /v1/tokens`, `DELETE /v1/tokens/{id}`, `GET /v1/workspaces/{id}/projects?slug=` (Discover a fixture project), `GET /v1/me` (active workspace). Paths are relative to `config.apiUrl`, which already ends in `/api` |
| OpenAPI Type(s) | `RunReportPage`, `RunReportItem`, `RunReportTotals`, `RunCreateBody`, `Run`, `RunFinishBody`, `RunAbortBody`, `RunSubmissionBody`, `CreateTokenBody`, `ErrorEnvelope`; facades `api/schemas/runs.types.ts`, additions to `workspace.types.ts` |
| Auth Required | Yes. Owner cookie for token mint and fixture discovery (reads only, ADR-0029); workspace-bound PAT as Bearer for runs and the report; a PAT without `atc:read` for BK-1982 |
| Return Pattern | GET/DELETE `[APIResponse, TBody]`; POST `[APIResponse, TBody, TPayload]`; UI ATCs return `void` |

## 3. ATC Registry

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| (none) | | | No existing ATC covers runs or the report. `AuthApi` and `WorkspaceApi` helpers (`provisionToken`, `revokeToken`, `listWorkspaces`, `listProjects`) are reused as setup |

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| BK-1963 | `RunsReportPage` (UI) | `filterRunsByMode(args: { mode, expectedRows })` | Select Mode Manual or Automated; assert the listed row count equals the fixture literal (11 Manual, 50 on page 1 Automated; ids are not literal under a frozen fixture), badge `data-mode` and text, Executor column, Executor buttons pressed, report request params and no `mode` |
| BK-1967 | `RunsReportPage` (UI) | `loadOlderRunsUnderMode(args: { mode, expected })` | Select Mode Automated, assert totals Manual 0 / Automated 51 before page 2 (totals follow the executor filter, migration 0137), click Load older runs; assert 50 then 53 rows (51 finished + 2 aborted), no manual row, totals unchanged, cursor request still carries the preset params |
| BK-1974 | `RunsApi` (API) | `readReportIsolatedToProject(args: { projectId, expected })` | Call the report for a project; `expected` is `{ status: 200, automated, manual, rows }` (same-workspace partition) or `{ status: 404 }` (foreign workspace) |
| BK-1975 | `RunsApi` (API) | `readReportWithConsistentTotals(args: { projectId, query })` | Call the report with a query; assert shape and `manual + automated == passed + failed` |
| BK-1982 | `RunsApi` (API) | `readReportWithScopedToken(args: { projectId, hasAtcRead })` | Call with the current Bearer; 403 `forbidden` (`missing_capability`) without scope, 200 with the full shape when granted |
| BK-1983 | `RunsApi` (API) | `probeReportParameters(args: { projectId, query, expected })` | Call with an abusive query; assert the exact status and error envelope or the 200 shape |
| BK-1992 | `RunsReportPage` (UI) | `openEmptyProjectUnderMode(args: { slug, workspaceId, mode })` | Open a never-run project, apply Mode (none, Automated, Manual); assert the first-use state, no other empty state, Mode group state |

Convention note: BK-1974, BK-1975, BK-1982 and BK-1983 have one TC but, in the first three, partitions with different statuses. The playbook says one parameterized ATC per partition. The manifest forbids two methods with one ID, so each is one method with a literal-discriminated argument (the BK-1665 pattern). Open question O1 asks whether to split these TCs in the TMS instead.

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|-----------|--------|---------|-------------|
| `RunsApi` | `getReport(args: { projectId, query? })` | `[APIResponse, RunReportPage]` | Plain GET used for oracles and discovery. `query` is `Record<string, string[]>` so executors repeat |
| `RunsReportPage` | `goto`, `readTotals`, `readScopeLabel`, `expectRowsMatchIds`, `totalChips`, `totalsRegion`, `rowsLocator`, `applyMode`, `applyStatus` | `void` / values | Navigation, filters and reads used as test-level steps (`@step`) |
| `WorkspaceApi` | `findProjectBySlug(args: { workspaceId, slug })` | `[APIResponse, ListProjectsBySlugResponse]` | Discover a fixture project by fixed slug |
| `AuthApi` | `provisionToken` (extended with `name`) | existing | Mint the `atc:read` PAT |
| `RunFixtureSteps` (Steps) | `openOwnerSession`, `openMemberSession`, `mintBearer`, `discoverProject`, `assertComposition`, `teardown` | see section 4 | Discover-and-verify chain reused by all seven files |

## 4. Test Data Strategy

Frozen discovered fixtures (ADR-0029). Pattern for every row: Discover by fixed slug, verify the recipe, never write. Recipes are literals in `tests/data/constants.ts` (`RUN_FIXTURES`) and were confirmed against the database with the read-only DB MCP on 2026-11-21.

| Fixture (slug) | Workspace | Recipe (executor: outcome counts) | Used by |
|----------------|-----------|-----------------------------------|---------|
| `qa-bk-225-fixture-20261117` | QA Bunkai (Owner) | human: 7 passed, 3 failed, 1 aborted; agent: 20 passed, 6 failed, 1 aborted; ci: 20 passed, 5 failed, 1 aborted (64 runs; 51 automated + 10 manual finished) | BK-1963, BK-1967, BK-1982, BK-1983, sibling of BK-1974 |
| `qa-bk-225-fixture-20261117-manual-only` | QA Bunkai (Owner) | human: 3 passed, 2 failed, 4 aborted; agent: 1 passed, 1 failed; ci: 1 aborted (12 runs, no running run) | BK-1975, project A of BK-1974 |
| `qa-bk-225-fixture-20261117-automated-onl` | QA Member Second (Member) | agent: 2 passed; ci: 1 passed | foreign project of BK-1974 |
| `kata-bk225-empty-runs` | QA Member Second (Member) | no runs. Created once by hand (the only creation, ADR-0029 rule 5), never seeded | BK-1992 |

Literals derived from the recipes (counts of Passed and Failed only; aborted rows are listed, not counted):

| Query on | Passed | Failed | Manual | Automated | Rows |
|----------|--------|--------|--------|-----------|------|
| main, no filter | 47 | 14 | 10 | 51 | 64 (page 1: 50) |
| main, `executor=agent` (BK-1982) | 20 | 6 | 0 | 26 | 27 |
| main, Mode Manual (BK-1963) | 7 | 3 | 10 | 0 | 11 |
| main, Mode Automated (BK-1963, BK-1967) | 40 | 11 | 0 | 51 | 53 (page 1: 50, page 2: 3) |
| manual-only, no filter (BK-1975) | 4 | 3 | 5 | 2 | 12 |
| manual-only, Status Failed | 0 | 3 | 2 | 1 | 3 |
| manual-only, Status Failed + Mode Automated | 0 | 1 | 0 | 1 | 1 |
| manual-only, Status Aborted | 0 | 0 | 0 | 0 | 5 |
| automated-onl, no filter (BK-1974 foreign) | 3 | 0 | 0 | 3 | 3 |

Partitions no fixture can hold (`test.skip(true, reason)`, reported as a gap):
- BK-1975 running run is not counted: no fixture holds a running run and one cannot be added without mutating a fixture.
- BK-1975 legacy run (created before the feature): no API marker tells a pre-feature run apart, and the pre-feature runs found in the database sit in workspaces the Owner does not reach (O2 closed as unavailable).

Credentials: the Owner cookie mints one `atc:read` PAT per spec (plus a `run:execute` PAT for the BK-1982 refusal row), all named `kata-bk225-fixture` and revoked in `afterAll`. Nothing is created, so there is no cleanup beyond the PATs.

### DataFactory additions / Constants additions

`tests/data/constants.ts`: `RUN_REPORT_PAGE_SIZE = 50` and `RUN_FIXTURES` (slug and recipe per fixture). `tests/data/types.ts`: `RunExecutor`, `RunOutcome`, `RunVerdicts`, `RunRecipe`, `FixtureProject`. No `DataFactory` change.

## 5. Test Scenarios

### File: tests/integration/runs/report/gateReportByPatScope.test.ts
Fixture: `{ api }` + `playwright`

#### Scenario 1: PAT scope gate (BK-1982)
Test: "BK-1982: should answer 403 to a PAT without atc:read and 200 with it when the report endpoint is called with each token" (loop over 2 rows: `hasAtcRead` false then true)
Preconditions: the main fixture, composition verified; two PATs (`atc:read`, `run:execute`).
ATCs called: `runs.readReportWithScopedToken` once per row with a Bearer-only fixture holding that PAT.
Test-level assertions: the 200 body `totals` equals `{passed:20, failed:6, manual:0, automated:26}` and `scope` equals `{has_runs:true, has_automated:true}` for the TC's `executor=agent` query (literals).
Teardown: revoke both PATs.

### File: tests/integration/runs/report/rejectInvalidReportParams.test.ts
Fixture: `{ api }` + `playwright`

#### Scenario 1..10: one parameterized test over the TC Examples table (BK-1983)
Test: "BK-1983: should answer <result> when the report API is called with <query> given a project with more than 50 runs"
Rows (literal): `executor=robot` 422; `status=running` 422; `executor=agent&executor=agent` 200 equal rows to `executor=agent`, plus the literals 27 items and totals passed 20, failed 6, manual 0, automated 26; `mode=automated` 200 and all 61 runs available (`totals` passed + failed == 61, first page 50 items); `date_from=2026-07-31&date_to=2026-07-01` 422; `date_from=2026-02-30` 422; `date_to=2026-13-45` 422; `limit=51` 422; `limit=0` 422 (lower bound, `limit` is 1..50 in the backend schema); `limit=50` 200 with 50 items and a `next_cursor`; `cursor=garbage` 400.
Preconditions: the main fixture (read-only, 61 finished runs plus 3 aborted), PAT `atc:read`.
ATCs called: `runs.probeReportParameters` per row.
Test-level assertions: the repeated-executor row compares item ids with a second call `executor=agent` through the `getReport` helper; the `mode` row compares to the unfiltered literal counts.
Teardown: revoke the PAT.

### File: tests/e2e/runs/report/filterRunsByMode.test.ts
Fixture: `{ test }`

#### Scenario 1..2: Mode presets (BK-1963)
Test: "BK-1963: should list only the preset's runs with matching badges and send the preset's executor params when Mode is <mode> given finished human, agent and ci runs" (loop: Manual, Automated)
Preconditions: the main fixture; the page opened on `/projects/{slug}/runs`.
ATCs called: `ui.runsReport.filterRunsByMode({ mode, expectedRows })` with 11 (Manual) or 50 (Automated, page 1).
Test-level assertions: the unfiltered view first lists 50 rows with scope label "50 runs loaded in current scope · more available" (precondition proof); `report-scope-label` reads "11 runs in current scope" (Manual) or "50 runs loaded in current scope · more available" (Automated).
Teardown: revoke the PAT.

### File: tests/e2e/runs/report/paginateRunsUnderMode.test.ts
Fixture: `{ test }`

#### Scenario 1: BVA page size + 1 (BK-1967)
Test: "BK-1967: should show per-mode totals before page 2 and keep Mode Automated applied on both pages given a project with 51 automated and 10 manual runs"
Preconditions: the main fixture.
ATCs called: `ui.runsReport.loadOlderRunsUnderMode({ mode: 'automated', expected })` with `expected = { manual: 0, automated: 51, pageOneRows: 50, rowsAfterPageTwo: 53 }`. Under Mode Automated the totals follow the executor filter (AC 3.2, migration 0137), so Manual reads 0; the 53 rows are 51 finished plus 2 aborted automated runs.
Test-level assertions: before Mode the unfiltered totals read Passed 47, Failed 14, Manual 10, Automated 51; after the ATC the UI chips equal the API totals (`getReport` with `executor=agent&executor=ci`) and the literal `{passed:40, failed:11, manual:0, automated:51}`; the "database count by executor_mode" is checked through the DB MCP (O3).

### File: tests/e2e/runs/report/reconcileModeTotals.test.ts
Fixture: `{ test }`

#### Scenario 1..4: invariant across filters (BK-1975)
Test: "BK-1975: should keep Manual plus Automated equal to Passed plus Failed across API totals, UI chips and the fixture recipe when <filters> are applied" (loop over the 4 Examples rows)
Rows and literal expectations (manual-only fixture, section 4): no filter: passed 4, failed 3, manual 5, automated 2, 12 rows (statuses passed, failed, aborted); Status Failed: failed 3, manual 2, automated 1, 3 rows; Status Failed + Mode Automated: failed 1, manual 0, automated 1, 1 row; Status Aborted: all four zero, 5 rows, status aborted. Two extra rows are `test.skip(true, reason)`: running run not counted (no fixture holds one) and the legacy run (O2).
ATCs called: `runs.readReportWithConsistentTotals({ projectId, query })` then the UI applies the same filters through the page object helpers.
Test-level assertions: totals equal the literals; the four total chips (`report-total-*`) equal the API; no `Aborted` text in `report-totals`; for the legacy-run row (O2) `test.skip(true, reason)`.

### File: tests/e2e/runs/report/isolateProjectRuns.test.ts (BK-1974 200 partition) and tests/integration/runs/report/isolateProjectRunsApi.test.ts (BK-1974 404 partition, `{ api }`)
Fixture: `{ test }` + `playwright` (Owner cookie session in the e2e file; the Member-workspace 404 partition reads with the Owner cookie in the integration file)

#### Scenario 1..2: project scope (BK-1974)
Test: "BK-1974: should <outcome> when the report is read for <partition> given projects of the same and of another workspace"
Rows: project A = manual-only fixture, expected `{ status: 200, automated: 2, manual: 5, rows: 12 }` (the main fixture is the sibling: a leak changes the counts); foreign project = the automated-onl fixture in the Member's workspace, expected `{ status: 404 }` and `error.code`, `message` and `details` equal the answer for a random unused UUID (read with the Owner cookie).
ATCs called: `runs.readReportIsolatedToProject` per row.
Test-level assertions: for A the report ids are disjoint from the sibling's first page; `ui.runsReport` opened on A reads Passed 4, Failed 3, Manual 5, Automated 2 and its `report-row-*` ids equal the API ids of A.

### File: tests/e2e/runs/report/viewEmptyRunsProject.test.ts
Fixture: `{ test }`

#### Scenario 1..3: zero-run precedence (BK-1992)
Test: "BK-1992: should show the first-use state when Mode is <mode> given a project with no runs" (loop: all, automated, manual)
ATCs called: `ui.runsReport.openEmptyProjectUnderMode({ slug, mode })`.
Fixture: `{ test }` with `test.use({ storageState })` of the Member and the `bk_active_ws` cookie set to the Member's workspace.
Test-level assertions: all four chips read 0; the Member's `getReport` returns `scope {has_runs: false, has_automated: false}`.

## 6. Implementation Order

- [x] Type facade `api/schemas/runs.types.ts`; `findProjectBySlug` on `WorkspaceApi`
- [x] `tests/data/constants.ts` (`RUN_FIXTURES`) and recipe types
- [x] `AuthApi.provisionToken` `name`; `RunsApi` (ATCs and `getReport`); register in `ApiFixture`
- [x] `RunFixtureSteps` (discover, verify composition, PAT lifecycle)
- [x] `playwright.config.ts`: role matchers and `BASE_IGNORE` for `**/runs/report/**`
- [x] BK-1982 and BK-1983 integration files
- [x] `RunsReportPage` (helpers and the BK-1963, BK-1967, BK-1992 ATCs); register in `UiFixture`
- [x] The five e2e files
- [x] `bun run kata:manifest`, `bun run types:check`, `bun run lint:check`, run the role projects on staging, DB MCP verification of the fixture recipes
- [ ] TMS TC transitions to Pull Request when the PR opens (`create_pr`); Automated only lands post-merge via `merged`

## 7. Success Criteria

- [ ] All seven TCs automated; each Examples row is a loop row
- [ ] Risk beyond AC covered: invalid and boundary inputs (BK-1983), non-disclosure 404 (BK-1974), uncounted states (BK-1975), zero-run precedence (BK-1992)
- [ ] BVA: page size + 1 (BK-1967), `limit` 0, 50 and 51, impossible dates (BK-1983)
- [ ] KATA compliance: one method per `@atc` ID; no ATC calls an ATC; the UI ATCs share a `private` mode-selection method instead of calling each other; locators inline until used twice
- [ ] Expected values are literals from the TCs; the recipes are recorded literals, never read from the response under test
- [ ] No hardcoded waits, no retries, credentials only through `@variables` (`STAGING_USER_*`, `STAGING_MEMBER_*`), no secret printed (PAT redacted with `redactKeys: ['token']`)
- [ ] No code comments (Critical Rule #18)
- [ ] Fixture drift fails with "fixture broken: <project> holds <counts>, expected <counts>", never a skip; only a state no fixture holds is a skip
- [ ] Tests pass on staging; `bun run kata:manifest:check` clean
- [ ] TMS TC moved to Pull Request on PR open (never "Automated" after local validation)

## 8. Runtime estimate

| Phase | First run | Later runs |
|-------|-----------|------------|
| Role sessions and setup (existing projects) | ~10 s | ~10 s |
| Integration files (2) | ~30 s | ~10 s |
| E2E files (5) | ~100 s | ~60 to 90 s |
| Total | ~3 to 5 min | ~1.5 to 2 min |

## 9. Risks

- Shared staging data: the frozen fixtures are long-lived and shared; a run added or removed by a person or by another test fails the tests loudly with "fixture broken" until the fixture is restored by hand (ADR-0029). The tests never write, so they add no permanent data.
- The BK-1967 and BK-1963 row counts include aborted runs (BK-1967: 53 rows, which include 2 aborted automated runs; BK-1963 Manual: 11); a new aborted run changes them.
- The Runs page resolves the project through the active-workspace cookie; if the Owner's active workspace changes between discovery and navigation the page returns 404. The Steps read `GET /v1/me`; BK-1992 sets the `bk_active_ws` cookie for the Member.
- Local, staging and production share one Supabase project (Master Test Plan): the human sweeps (4 hours) and agent sweeps (60 minutes) can abort a running run in a fixture; the fixtures hold none today.
- UI copy and testids are read from `origin/staging` code, not from the live page: confirm with a `/playwright-cli` snapshot at Code time.

## 10. Review Findings (Phase 3)

Accepted with reasons:
- Multi-outcome ATCs (BK-1974, BK-1982, BK-1983) stay single methods with a literal-discriminated argument: the manifest allows one `@atc` per TC key, and splitting the TCs in the TMS is open question O1.
- 401 coverage gap: no signed TC asks for an unauthenticated read of the report. Routed to `/test-documentation` as a new TC candidate; no ATC is added here.

Round 2 outcomes:
- BK-1974 spans `isolateProjectRuns` (UI, 200 partition) and `tests/integration/runs/report/isolateProjectRunsApi.test.ts` (API, 404 partition); both call `readReportIsolatedToProject`, whose 200 branch now asserts `has_automated` from the recipe (`expected.automated > 0`). The `RunReportPage` scope has no `has_manual` field.
- Row badges assert the icon as presence (`svg, img, [role="img"]`) beside `data-mode` and the label.
- BK-1983 200 branch asserts the same totals and scope properties as BK-1982 (no `aborted` or `running` key); the repeated-executor row passes its 27 items through `expected`.
- The "no Aborted chip" check moved out of the `readTotals` step into the BK-1963 and BK-1967 ATCs as the exact chip list (Passed, Failed, Manual, Automated). BK-1975 has no UI ATC, so it keeps no chip-set assertion.
- Readiness waits use `aria-busy="false"` on `report-totals` instead of placeholder text; `listRowIds` reads the full run id from the id cell `title` attribute through the `getByRole('row')` locator.
- The empty-state copy match is case-sensitive and anchored to "No runs yet for this Project"; the scope label match requires "more available" exactly.

Round 3 outcomes:
- Row identity: `listRowIds` (read of the id cell `title`) is removed. BK-1974 now calls `expectRowsMatchIds(ids)`: `toHaveCount(ids.length)` on the rows, then `getByTestId('report-row-<id>')` visible for every API id. Checking by id replaces reading ids from the UI, so no prefix parsing is needed (`report-row-branch-<id>` shares the prefix).
- Total chips: the ordered text list is replaced by an order-independent check: `getByTestId(/^report-total-/)` count 4, each of the four testids visible with its label regex, and the totals region does not contain "Aborted" (an Aborted chip without a testid cannot pass).
- BK-1975: no second `@atc`. The UI part of TC22 lives at test level in `reconcileModeTotals`: chip count 4 and no "Aborted" text in the totals region, through the page accessors `totalChips()` and `totalsRegion()`, for every Examples row.
- Executor cell: matched per row with string names and `exact: true` (Human, or Agent or CI through `or`), so another column holding the same text does not match. The Executor column header is not associated: the cells expose no header relation without positional selectors.
- Row counts use retrying `toHaveCount` on the rows locator; `countRows` is removed.
- The BK-1982 and BK-1983 200-branch checks share one private helper in `RunsApi` (`expectTotalsAndScope`, no decorator).
- The distinct-PAT check is dropped from the BK-1982 test-level assertions (section 5): it proved nothing about the report, since the 403 and 200 outcomes already show the tokens differ in scope.
- BK-1963 (Mode Manual) keeps `Manual` and `Human` as plain string literals (badge label and executor cell name), never derived from the response.

Recorded gaps:
- BK-1975 has no independent DB oracle in regression. The recipe is read through the endpoint under test (`assertComposition`), and the database count check was a one-off at Code time (2026-11-21), so a drift that the endpoint hides would pass.
- BK-1967 expects 53 rows under Mode Automated: 51 finished automated runs plus 2 aborted automated runs.
