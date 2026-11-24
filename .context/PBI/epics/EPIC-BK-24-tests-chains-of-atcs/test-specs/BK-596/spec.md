# BK-596: TMS-Test | Rename a Test, archive it and restore it

| Field | Value |
|-------|-------|
| **Priority** | P0 (BK-2140, BK-2144, BK-2147, BK-2150, BK-2152, BK-2153, BK-2158, BK-2161, BK-2163, BK-2164, BK-2178, BK-2179), P1 (BK-2146, BK-2156, BK-2165, BK-2167, BK-2171, BK-2172), P2 (BK-2185, BK-2187) |
| **Phase** | Standalone (ticket-driven regression automation of a Story already QA-tested; ATS BK-2190) |
| **Items** | 20 TCs, 20 ATCs (one `@atc` per TC key, no multi-ATC test) |
| **Dependencies** | None on other tickets. Archived-Tests behaviour in ATC "used in" (BK-2240), finished-Runs-only count (BK-2241) and create-applies-rename-rules (BK-2243) are shipped fixes the expected results already assume |
| **Requires** | Staging only (role accounts). Owner session (`ui-setup`), Member, Admin and Viewer cookie sessions (`role-sessions-setup`); `STAGING_USER_*`, `STAGING_ADMIN_*`, `STAGING_MEMBER_*`, `STAGING_VIEWER_*` set by name, never by value. The Member account must own a workspace (read from `GET /me`) and the QA workspace must hold Admin, Member and Viewer accounts |
| **Source** | Story BK-596 (Epic BK-24, Tests: chains of ATCs), ATS BK-2190, TC source gate PASSED 2026-11-23T21:15:28Z, ROI verdicts signed 2026-11-21 (`.session/decisions/bk596-roi-verdicts-2026-11-21.json`) |

## Summary

Automates the 20 signed Candidate TCs that guard renaming, archiving and restoring a Test: the rename and archive/restore UI journeys, the evidence-never-blanked rules (past Runs, traceability, reports, plan figures), the write guards (frozen when archived, viewer refused, non-member sees nothing, stale version, title length rules, idempotent archive and restore) and the three shipped-defect regressions (BK-2240, BK-2241, BK-2243). Eight TCs are labelled e2e and twelve integration. Every TC generates its own ATCs, Test and Runs through the product API (Generate); no shared sprint fixture is mutated.

## Test Cases

> Bodies live in Jira and are synced under the Story's `test-cases/` (all 20 read, status Candidate, refreshed from Jira this session). Re-sync with `bun run jira:sync-issues get BK-596 --include-comments`.

| TMS ID | Title (short) | Type | Priority | Level |
|--------|---------------|------|----------|-------|
| BK-2140 (TC1) | should show the new name on every Test surface and keep chain, step ids and tags while the version rises by one after a rename (absorbs TC2 BK-2141) | Positive, UI | P0 | e2e |
| BK-2144 (TC5) | should archive after a confirmation naming the Test, its reversibility and its Run count, then show the restore hint | Positive, UI | P0 | e2e |
| BK-2147 (TC8) | should render every step of a past Run and list all Runs in the Run history given an archived Test | Positive, UI | P0 | e2e |
| BK-2150 (TC11) | should keep an archived Test with Runs as evidence in Story traceability, marked Archived | Positive, UI | P0 | e2e |
| BK-2152 (TC13) | should return a restored Test to every offer surface and allow Run start, rename, reorder and tags again | Positive, UI | P0 | e2e |
| BK-2158 (TC19) | should offer no Start Run and refuse POST /runs with 409 test_archived given an archived Test | Negative, UI + API | P0 | e2e |
| BK-2185 (TC46) | should leave an archived Test out of an ATC detail "used in" list and its count (regression of BK-2240) | Regression, UI | P2 | e2e |
| BK-2187 (TC48) | should count finished Runs only in the archive dialog, matching the Run history (regression of BK-2241) | Regression, UI | P2 | e2e |
| BK-2146 (TC7) | should drop the archived Test from the tag filter and keep its siblings in the same order | Positive, API | P1 | integration |
| BK-2153 (TC14) | should keep the Test row and every Run, step and plan membership unchanged across archive and restore | Integrity, API | P0 | integration |
| BK-2156 (TC17) | should refuse a blank name with a required-name error (422) at rename and create (regression of BK-2243) | Negative, API | P1 | integration |
| BK-2161 (TC22) | should refuse rename, reorder and tag changes with 409 test_archived and keep version, title, chain and tags | Negative, API | P0 | integration |
| BK-2163 (TC24) | should offer a workspace viewer no rename, archive or restore control and refuse each call with 403 | Negative, API | P0 | integration |
| BK-2164 (TC25) | should answer 404 and hide the Test from search for a workspace non-member, live or archived | Negative/Security, API | P0 | integration |
| BK-2165 (TC26) | should refuse a rename carrying a stale version with 409 version_conflict and the current version | Negative, API | P1 | integration |
| BK-2167 (TC28) | should accept 199 and 200 characters, 200 multi-byte characters, and refuse 201 at rename and create (absorbs TC29 BK-2168; regression of BK-2243) | Boundary, API | P1 | integration |
| BK-2171 (TC32) | should answer 204 to a second archive and keep the first archive time and actor with no second event | Idempotency, API | P1 | integration |
| BK-2172 (TC33) | should answer 200 with changed false and write no event when restoring a live Test | Idempotency, API | P1 | integration |
| BK-2178 (TC39) | should keep the runs report, the workspace runs index and the run comparison identical after archiving a Test | Integrity, API | P0 | integration |
| BK-2179 (TC40) | should keep open plan progress, milestone readiness and a closed plan snapshot identical after archiving a Test (absorbs TC41 BK-2180) | Integrity, API + UI | P0 | integration |

## Automation Plan

**Order**: WP1 foundations (config, types, data) first, then API components (`TestsApi` before everything else, it carries 10 ATCs), supporting API components, the three Steps modules, the UI components, the integration test files, and the e2e test files last. Integration files go before e2e because they exercise the same Test lifecycle at lower cost and prove the Steps seeding before any browser is involved.

**Shared fixtures**: all data is generated per file by `TestSeedSteps` (module, user story, acceptance criterion, ATCs, Tests, finished and running Runs, plans, milestone) inside the arena named by `TestLifecycleSteps` (Discover the workspace, project and environment, Generate when absent). Each test owns its Test; nothing is mutated that another test reads. Teardown archives what the file created.

**Blocked by**: nothing hard. Four decisions are open (see Open questions): the TC40 read path for plan and milestone figures, the UI halves of six integration TCs, the arena (workspace and project) choice, and the staging data pollution policy.

**Preconditions for the whole scope**: staging role sessions written by `role-sessions-setup` (one sign-in per role per run, never a login per test); the Member account owns a workspace with at least one project or room to create one; the Admin and Viewer accounts belong to the shared QA workspace; `bun run kata:manifest` regenerated after Code.

## Merged TCs

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| BK-2141 (TC2) | BK-2140 (TC1) | Same precondition and action; chain, step id and tags unchanged assertions live in BK-2140 |
| BK-2168 (TC29) | BK-2167 (TC28) | Multi-byte rows are Examples rows of the TC28 outline |
| BK-2180 (TC41) | BK-2179 (TC40) | Closed-plan snapshot is an extra Then of TC40 |

## Out of scope (listed, never planned)

The 30 Deferred TCs of BK-596 (0 Manual): BK-2141, BK-2142, BK-2143, BK-2145, BK-2148, BK-2149, BK-2151, BK-2154, BK-2155, BK-2157, BK-2159, BK-2160, BK-2162, BK-2166, BK-2168, BK-2169, BK-2170, BK-2173, BK-2174, BK-2175, BK-2176, BK-2177, BK-2180, BK-2181, BK-2182, BK-2183, BK-2184, BK-2186, BK-2188, BK-2189. BK-2141, BK-2168 and BK-2180 are the merges above. Nothing here creates, edits or scores a TC, and nothing calls Jira.

## Technique per TC

| TC | Technique | Partitions / boundaries planned (all from the TC body) |
|----|-----------|---------------------------------------------------------|
| BK-2140 | EP + State Transition (live, renamed) | One valid new title different from the current one; version V to V+1 |
| BK-2144 | EP (single partition: live Test with finished Runs) | Run count 2 stated in the dialog |
| BK-2147 | EP (single partition: archived Test with finished Runs, one failed step) | Two Runs |
| BK-2150 | EP (single partition: archived Test with Runs) | Both ATCs of the chain |
| BK-2152 | State Transition (archived to live) | Restore, then rename out and back |
| BK-2158 | EP (single partition: archived never-run Test) | `POST /runs` |
| BK-2185 | EP on ATC state | 2 rows: ATC live, ATC archived |
| BK-2187 | EP on Run mix | 2 rows: running only (0 finished), finished only (2) |
| BK-2146 | EP on tag | 2 rows: tag shared with siblings, tag carried by the Test alone (see OQ4) |
| BK-2153 | State Transition | archive, restore; row, Runs, steps and memberships equal baseline after each |
| BK-2156 | EP (every blank class) x call | 6 rows: rename with empty, 3 spaces, 2 tabs, 2 NBSP; create with empty, 2 NBSP |
| BK-2161 | Decision Table (writer x archived state) | 3 rows: rename, reorder, tags |
| BK-2163 | Decision Table (action x Test state) | 3 rows: rename live, archive live, restore archived |
| BK-2164 | EP on Test state | 2 rows: live, archived |
| BK-2165 | State Transition (version V to V+1, stale V) | Single case |
| BK-2167 | BVA (199, 200, 201) x EP on length unit (ASCII, accented, emoji) | 8 rows from the TC: rename ASCII 199, 200, 201; rename accented 200; rename emoji 200, 201; create emoji 200, 201 |
| BK-2171 | State Transition (second archive by a different actor) | Single case |
| BK-2172 | State Transition (restore on live) | Single case |
| BK-2178 | EP (single partition) | Three reads, every page |
| BK-2179 | EP (single partition) | Open plan, milestone, closed plan |

BVA check against the Story's limits: title length 199, 200, 201 (BK-2167) and blank (BK-2156). The 1-character accept edge and trimmed-only-spaces-around-201 have no signed TC: OQ6, routed to /test-documentation, not planned.

## Test data classification (Discover / Modify / Generate)

| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Arena workspace, project, environment | Discover (Generate project or environment if absent) | `GET /me`, `GET /workspaces/{id}/projects`, `GET /projects/{id}/environments` | `beforeAll` of each file via `TestLifecycleSteps` | Generated project or environment kept, named with a kata prefix |
| Module, user story, acceptance criterion | Generate | `POST /projects/{id}/modules`, `POST /modules/{id}/user-stories`, `POST /user-stories/{id}/acceptance-criteria` | `beforeAll` per file | Archived in `afterAll` |
| ATCs of a chain | Generate | `POST /atcs` | per test | `DELETE /atcs/{id}` in `afterAll` |
| Test with tags and a chain of 2 ATCs | Generate | `POST /tests`, `PUT /tests/{id}/tags` | per test | `DELETE /tests/{id}` in `afterAll` (a Test cannot be hard-deleted) |
| Finished Runs (one with a failed step), a running Run | Generate through the real path | `POST /runs`, `POST /runs/{id}/steps/{stepId}/mark`, `POST /runs/{id}/finish` | per test | Runs are never removed; they ride on the archived Test |
| Test plans (open, closed) and milestone | Generate | `POST /projects/{id}/test-plans`, `POST /test-plans/{id}/tests`, `POST /test-plans/{id}/close`, `POST /projects/{id}/milestones`, `POST .../milestones/{id}/plans` | per test (TC40) | Plans and milestone archived or left closed |
| Viewer, Admin sessions | Discover | `.auth/role-<role>.json` written by `role-sessions-setup` | `beforeAll` via `TestLifecycleSteps.openRoleSession` | Context disposed |
| Foreign workspace for the non-member case | Discover | The Member-owned workspace; the Viewer is not a member of it | `beforeAll` | Test archived |
| Archive/activity/DB reads of the TCs | Substitute | Product API reads (see automation-plan §4.3): `GET /tests/{id}`, `GET /tests/{id}/runs`, `GET /activity`, `GET /test-plans/{id}/tests` | in ATCs and helpers | None |

## Open questions

- OQ1 (TC40 read path): there is no endpoint, and the framework has no DB client; `bunkai_plan_progress`, `bunkai_milestones_readiness` and `test_plans.progress_snapshot` are reachable only through the plan and milestone pages (UI) or a read-only DB connection. Plan reads them from the pages. If a byte-identical snapshot comparison is wanted, a decision is needed on a DB read component (new dependency, new secret by name).
- OQ2 (UI halves of integration TCs): BK-2146, BK-2156, BK-2161, BK-2163, BK-2164 and BK-2179 carry a UI cross-check in their Expected Results. Plan keeps the ATC at the labelled level and runs the UI half as test-level helper assertions in a hybrid `{ test }` file; confirm, or route a UI-level TC split to /test-documentation.
- OQ3 (arena): data is generated in the Member-owned workspace (isolates the workspace runs index for BK-2178) except the role-based TCs (BK-2163, BK-2171) that need Admin and Viewer in the QA workspace. Confirm the Member may create a project there, and the project cap.
- OQ4 (BK-2146 `smoke` row): the TC's `smoke` row depends on other live Tests of the workspace. Plan replaces it with a second generated tag carried by the Test alone; confirm.
- OQ5 (pollution): archived Tests, ATCs and modules stay on shared staging (no hard delete exists). Confirm the policy, or provision a dedicated QA workspace.
- OQ6 (risk beyond the TCs, for /test-documentation, not planned): 1-character accept edge of the title; title of 201 made of 199 characters plus surrounding spaces (trim before count); X-If-Match on reorder and tags while archived; archive of a Test with a Run in progress (BK-2149 Deferred); the concurrent archive and run start race (BK-2183 Deferred); the plan add refusal for an archived Test (BK-2160 Deferred).
- OQ7 (framework config): the new files need entries in `playwright.config.ts` role lists (`ROLE_SPECS`, `e2e-roles`, `integration-roles`, the smoke-roles projects); that is a framework change routed through /framework-development.

## Acceptance Criteria

- [ ] 20 TCs automated, one `@atc` per TC key, with the parameterized outlines of the technique table
- [ ] Tests pass on staging with role sessions reused (no login per test), retries 0
