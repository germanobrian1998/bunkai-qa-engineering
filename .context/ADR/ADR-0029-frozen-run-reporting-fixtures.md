# ADR-0029 — Frozen discovered fixtures for run-reporting tests

- **Status:** Proposed
- **Date:** 2026-11-21
- **Deciders:** Project owner, during `/test-automation BK-225` Phase 2 (2026-11-21), after the project-limit blocker
- **Tags:** test-data, fixtures, isolation, run-reporting
- **Supersedes:** —
- **Superseded by:** —

---

## Context

Run-reporting tests (first user: BK-225, Manual vs Automated mode) need projects with specific mixes of runs: human, agent and CI executors, and passed, failed and aborted outcomes. One boundary case (BK-1967, BK-1983) needs 51 automated and 10 manual finished runs in one project, to cross the 50-row page.

The first draft of this ADR planned one generated project per test. That cannot run. The owner's workspace "QA Bunkai" is on the community plan, which allows 3 projects, and all 3 are used. `POST /v1/workspaces/{id}/projects` returns 422 `project_limit_reached`. The API also has no delete path for runs or projects (ADR-0010), and staging shares one Supabase project with the other environments.

The projects that `/sprint-testing` built for BK-225 on 2026-11-17 already hold the mixes the TCs need. `qa-bk-225-fixture-20261117` holds 51 automated and 10 manual finished runs.

## Decision

Run-reporting tests will read fixed, pre-built fixture projects. They will not create projects or seed runs.

1. Each test Discovers its fixture project by its fixed name and checks the run composition it depends on before it acts.
2. If the composition differs from the recorded recipe, the test fails as "fixture broken" and names the project and the counts it found. It never repairs or tops up the fixture.
3. Expected totals in assertions are literals from the recorded recipe, never values read from the response under test.
4. A test that needs a state no fixture holds, and that cannot be built without mutating a fixture, takes `test.skip(true, '<reason>')` for that partition and reports the gap.
5. The one exception is the empty first-use project for BK-1992. It is created once in the Member's own workspace, which has one free slot, and is Discovered after that.
6. PATs minted by tests are revoked in `afterAll`.

## Consequences

- **Positive:** no new permanent data per run, and no dependency on the project limit. Setup is cheap because nothing is seeded.
- **Negative / trade-offs:** tests share mutable data. A manual edit, or another test or person adding runs to a fixture project, fails these tests until someone restores the fixture. This breaks the per-test isolation of ADR-0010 §2 for run-reporting. A fixture has to be rebuilt by hand if it is ever lost.
- **Neutral / follow-ups:** record each fixture recipe in the BK-225 automation plan. Revisit this ADR when the plan limit or a delete or archive path changes.

## Alternatives considered

- **One generated project per test** (the first draft) — rejected: blocked by the community 3-project limit, and it leaks permanent data on every run.
- **Raise the workspace plan or limit** — rejected by the owner: it depends on an external change and grows the leak.
- **Top up shared fixtures** — rejected: adding runs changes the counts other tests assert.
- **Seed through the database** — rejected: the test DB role is read-only, and `runs` has no anon or authenticated grants.

## References

- `.context/PBI/epics/EPIC-BK-221-automation-ci-ingestion/test-specs/BK-225/automation-plan.md` §4 Test Data Strategy
- ADR-0010 (test isolation), ADR-0009 (auth in tests)
