# BK-225: TMS-Run Reporting | Filter runs by manual or automated execution mode

| Field | Value |
|-------|-------|
| **Priority** | P0 (BK-1974, BK-1975), P1 (BK-1963, BK-1967), P2 (BK-1982, BK-1983, BK-1992) |
| **Phase** | Standalone (ticket-driven regression automation of a Story already QA-tested, ATR BK-1987) |
| **Items** | 7 TCs, 7 ATCs (no multi-ATC test) |
| **Dependencies** | None on other tickets. Reads data produced through BK-222 (run submission) and the PAT-declared executor of `POST /runs` |
| **Requires** | Staging owner session, workspace-bound `run:execute` PAT minted at runtime, Member role account (BK-1974 foreign workspace), Supabase-backed staging project |
| **Source** | Story: BK-225 (Epic BK-221) |

## Summary

Automates the seven signed Candidate TCs that guard the Mode filter (a preset over the Executor filter), the per-mode totals contract of `GET /api/v1/projects/{id}/runs/report`, its project isolation, its PAT scope gate, its parameter validation (prior bug BK-1990) and the first-use state of a zero-run project (prior bug BK-1991). Three TCs are API-only (BK-1982, BK-1983, plus the API oracle of BK-1975), four drive the project Runs view. Run data is the hard part: no run or project can be deleted and the Owner workspace is at its project limit, so the tests read frozen discovered fixtures (ADR-0029, `automation-plan.md` section 4).

## Test Cases

> Bodies live in Jira. Synced copies sit under the Story's `test-cases/` (the newer-slug file wins for TC10, TC14 and TC22);
> run `bun run jira:sync-issues get BK-225` if they are not on disk. Gherkin Examples: `bun xray test get <KEY>`.

| TMS ID | Title (short) | Type | Priority | Level | Jira tags |
|--------|---------------|------|----------|-------|-----------|
| BK-1963 (TC10) | should list only the preset's runs with matching badges and send the preset's executor params when Mode is Manual or Automated | Positive, UI | P1 | e2e | @high @regression |
| BK-1967 (TC14) | should show full-set per-mode totals before page 2 and keep Mode Automated applied on both pages given 51 automated and 10 manual runs | Boundary, UI | P1 | e2e | @medium @regression |
| BK-1974 (TC21) | should exclude other projects' runs from rows and per-mode totals and answer 404 for a foreign-workspace project | Negative, hybrid | P0 | e2e (hybrid) | @critical @regression |
| BK-1975 (TC22) | should keep Manual plus Automated equal to Passed plus Failed across API totals, UI chips and database counts for every filter combination | Invariant, hybrid | P0 | e2e (hybrid) | @critical @regression |
| BK-1982 (TC29) | should answer 403 on the report endpoint to a PAT without atc:read and 200 with it | Negative/Positive, API | P2 | integration | @medium @regression |
| BK-1983 (TC30) | should reject invalid report parameters and ignore any mode parameter when the report API is probed | Negative/Boundary, API | P2 | integration | @medium @regression |
| BK-1992 (TC32) | should show the first-use state for any Mode given a project with no runs | Edge, UI | P2 | e2e | @medium @regression |

## Out of scope (listed, not planned)

- BK-1973 (TC20): MANUAL by signed verdict (stale totals while a request is in flight).
- The 24 Deferred TCs of the Story, not planned here: BK-1954 to BK-1962, BK-1964 to BK-1966, BK-1968 to BK-1972, BK-1976 to BK-1981, BK-1984. Several are absorbed as Examples rows of the seven above (TC1, TC2, TC11 into TC10; TC18 into TC14; TC15, TC16, TC17 into TC22; TC26 into TC32); the rest stay Deferred.
- No Test is created, edited or scored by this plan. Nothing here calls Jira.

## Automation Plan

**Order** (Playwright runs files alphabetically with `workers: 1`, inside each project):
1. API-only, read-mostly first: `gateReportByPatScope` (BK-1982), `rejectInvalidReportParams` (BK-1983). Both read the main frozen fixture; neither writes (ADR-0029).
2. UI flows next: `filterRunsByMode` (BK-1963), `paginateRunsUnderMode` (BK-1967), `reconcileModeTotals` (BK-1975), `isolateProjectRuns` (BK-1974), `viewEmptyRunsProject` (BK-1992).

**Shared fixtures**:
- `RunFixtureSteps` (new Steps class): opens the Owner and Member cookie sessions, mints `atc:read` PATs, Discovers a fixture project by fixed slug and verifies its recipe with `assertComposition`; it creates and seeds nothing. Drift fails "fixture broken" (ADR-0029).
- Main fixture `qa-bk-225-fixture-20261117` (51 automated + 10 manual finished plus 3 aborted): BK-1963, BK-1967, BK-1982, BK-1983, sibling of BK-1974.
- `...-manual-only` (BK-1975, project A of BK-1974), `...-automated-onl` in the Member workspace (foreign project of BK-1974), `kata-bk225-empty-runs` in the Member workspace (BK-1992, the only project created, once by hand). Recipes: automation-plan.md section 4.

**Blocked by**: Nothing that stops the plan. Four items need a decision before or during Code, listed in the open questions of the report: the legacy "run created before the feature" precondition of BK-1975, the database oracle, a `data-testid` for the Executor cell, and a `@atc` convention for TCs with two statuses.

**Preconditions for the whole scope**: staging only (role accounts and the shared fixture workspace exist there); the Owner has an active workspace with write access; `STAGING_USER_*` and `STAGING_MEMBER_*` set (by name, never by value). Active-workspace caveat: the Runs page resolves the project through the active-workspace cookie, so every project is created in the Owner's active workspace.

## Test-Design Checklist (test-design-doctrine Part 3)

| Line | Answer | Evidence |
|------|--------|----------|
| P1 risk beyond AC | YES | BK-1983 (parameter abuse, charter), BK-1974 (non-disclosure 404), BK-1975 (running/aborted not counted) |
| P2 AC is the floor | YES | The seven TCs add BVA on the page size, invariant triangulation and prior-bug cases above the AC text |
| P3 concrete exploration | YES | Each TC fixes counts and states (51/10, 5 vs 3 runs, 10 query rows) |
| P4 no AC collapsed | YES | AC2 (2.1, 2.2, 2.5), AC3 (3.1 to 3.4, 3.7), AC4 (4.4) each split across several TCs; the other 24 TCs stay Deferred or Manual by signed decision, not by this plan |
| P5 anomaly cases | YES | BK-1983 (impossible dates, repeated executor, unknown `mode`, bad cursor), BK-1992 (zero-run state under Mode) |
| EP | YES | Mode presets, project scope (sibling, foreign), PAT scope present/absent, invalid query classes |
| BVA | YES | BK-1967 (page size + 1 = 51), BK-1983 (`limit` 50 and 51, impossible dates). Reduction to 1 row per limit: values 0 and 49 are covered by the TC's own `limit` partition list, not added here (not signed) |
| BVA-D | N/A | The report rounds nothing; totals are exact counts |
| ST | YES | Run status running/passed/failed/aborted counted or not (BK-1975). Invalid transitions belong to the run lifecycle (other Story) |
| DT | YES | BK-1992 (empty state precedence: zero-run beats Mode) is a decision table of 3 rows, kept as Examples rows |
| PW | N/A | The Mode x Status x Module x Date pairwise of AC 2.3 is TC12 (Deferred), not in this scope. BK-1975 keeps the 4 signed combinations |
| PARAM | YES | One parameterized ATC per TC; Examples rows become `for` loops over a literal table |
| RISK | YES | P0 for isolation and the totals invariant; nothing dropped silently |
| OBS | YES with caveats | Zero-run state: fixture identity (a fresh project). Legacy run created before the feature: unreachable on demand, see open question O2 |
| SEED | N/A | Frozen discovered fixtures built during sprint testing; the tests create and seed nothing (ADR-0029). The Mode derivation under test is the one the fixtures already hold. |

## Merged TCs

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| (none by this plan) | | Absorption of TC1, TC2, TC11, TC15 to TC18, TC26 into the seven TCs was decided at documentation time (Jira Refinement Notes), not here |

## Updated TCs

None.

## Acceptance Criteria

- [ ] 7 TCs automated, each with its own `@atc('<TC key>')`, one method per ID, no ATC calling another ATC
- [ ] Every Gherkin Examples row is a loop row of a parameterized test or ATC
- [ ] Expected values are literals from the TC, never read back from the response under test
- [ ] No code comments except toolchain directives (Critical Rule #18)
- [ ] Tests pass on staging; `bun run types:check`, `bun run lint:check`, `bun run kata:manifest:check` clean
