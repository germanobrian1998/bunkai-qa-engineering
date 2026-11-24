# Test Automation Plan: BK-596

> Ticket: BK-596: TMS-Test | Rename a Test, archive it and restore it (Epic BK-24)
> Type: e2e (8 TCs) and integration (12 TCs)
> Sprint: current sprint of the Story (ticket-driven regression automation)
> Created: 2026-11-23

## 1. Ticket Summary

- What to test: rename, archive and restore of a single Test. Archive is a use-visibility operation: it hides the Test from every surface that offers it for use and never touches what already happened (Runs, history, traceability, reports, plan figures).
- Acceptance criteria covered by the 20 signed Candidate TCs: AC-01 (1.1, 1.2), AC-02 (2.1), AC-03 (3.1, 3.2, 3.3), AC-04 (4.1, 4.2, 4.3, 4.6), AC-05 (5.1), AC-06 (6.1), AC-07 (7.1), AC-08 (8.1, 8.2), AC-10 (10.1, 10.2), AC-11 (#1), E2 (stale version), and the divergences 1 (BK-2240) and 3 (BK-2241). Coverage matrix: `.context/reports/COVERAGE-MATRIX-BK-596.md`.
- Dependencies: none on other tickets. Expected results already assume the shipped fixes BK-2240, BK-2241 and BK-2243.
- Out of scope: the 30 Deferred TCs (listed in spec.md), anything not signed.

## 2. Architecture Decisions

> ADR promotion check: the arena choice (Member-owned workspace for single-role TCs) and the "generate, never mutate shared fixtures" contract are ticket-local. The DB-read substitution (product API in place of a DB client) is a candidate for an ADR only if the framework later adds a DB client; not promoted now.

### Component Strategy

| Decision | Value | Rationale |
|----------|-------|-----------|
| Tests API component | NEW `TestsApi.ts` (`tests/components/api/`) | Manifest has no Tests component (`components.api[]`: ActivityApi, AuthApi, BugApi, DisplayNameApi, InviteApi, RunsApi, WorkspaceApi). Owns 10 ATCs |
| Runs API component | EXTEND `RunsApi.ts` | Manifest entry `RunsApi` (ATCs BK-1974, BK-1975, BK-1982, BK-1983) already owns Run reads; add BK-2158, BK-2178 and the Run-generation helpers |
| Activity reads | REUSE `ActivityApi.listActivity` | The product API proxy of the `activity_log` reads; add one filtering helper |
| Workspace and project discovery | REUSE `WorkspaceApi.listProjects`, `findProjectBySlug`; `AuthApi.getCurrentUser` | Manifest entries `WorkspaceApi`, `AuthApi`; no new discovery code |
| Supporting API components | NEW `AtcsApi.ts`, `StructureApi.ts`, `SearchApi.ts`, `PlansApi.ts` | Seeding and offer-surface reads, helpers only (no ATC) except none; one resource per file |
| UI components | NEW `TestDetailPage.ts`, `RunDetailPage.ts`, `TraceabilityPage.ts`, `AtcDetailPage.ts`, `PlanFiguresPage.ts` | Manifest `components.ui[]`: AccountPage, LoginPage, MembersPage, RunsReportPage. None covers a Test page, a Run detail, traceability, the ATC detail or plan figures |
| Steps modules | NEW `TestLifecycleSteps`, `TestSeedSteps`, `OfferSurfaceSteps` | Manifest `steps[]`: DisplayNameSteps, MemberRemovalSteps, RunFixtureSteps. `RunFixtureSteps.openMemberSession`, `.openOwnerSession`, `.discoverProject`, `.mintBearer` are reused by composition (instantiated directly); the new modules add what they lack (viewer and admin sessions, generation) |
| Fixture | `{ test: kata }` (hybrid) for the 8 e2e files and the integration files with a UI half; `{ api }` is not enough because every file needs role sessions opened in `beforeAll` | Existing role-session tests (BK-1949, BK-225) import `test` from `@TestFixture` and open role callers in Steps; follow the precedent |
| Session model | File-level `test.use({ storageState: config.auth.roleStatePath('member') })` for UI; API callers come from Steps (`playwright.request.newContext({ storageState })`, cookie only, no Bearer) | `TestFixture.loadTokenFromFile` attaches the owner Bearer from `api-state.json` to `kata.api`; a Member cookie plus an Owner Bearer is ambiguous, so assertions use the Steps sessions' `ApiFixture`. Raise at Code time if `kata.api` is needed |
| Test files | `tests/e2e/test-lifecycle/{verbFeature}.test.ts`, `tests/integration/test-lifecycle/{verbFeature}.test.ts` | Module folder `test-lifecycle` (Tests rename/archive/restore); the BK-225 and BK-1949 plans use the same `<area>/<feature>` shape |
| Test names | `test('BK-xxxx: <Jira summary after "BK-596: TCn: ">')` | TC titles already read "should ... when/given ..." |
| Role gating | Add the new folders to `ROLE_SPECS`, `e2e-roles`, `integration-roles` and the smoke-roles projects in `playwright.config.ts` | Role specs are owned by the `*-roles` projects only; otherwise the default projects run them without role sessions (OQ7, /framework-development) |

### [E2E ONLY] UI Elements

All `data-testid` values come from the TC bodies (source-checked there against the product's `TestArchiveControls.tsx`, `TraceabilityChainView.tsx`, `AtcPreview.tsx`); locators stay inline in the ATC until used twice, then move to a private arrow property of the component (the `RunsReportPage` pattern).

| Element | Locator Strategy | Locator Value |
|---------|------------------|---------------|
| Rename entry, form, input, save, error | `getByTestId` | `test-detail-rename`, `test-rename-form`, `test-rename-input`, `test-rename-save`, `test-rename-error` |
| Archive entry, dialog, Run count, confirm, cancel, plans warning | `getByTestId` | `test-detail-archive`, `archive-test-dialog`, `archive-test-runs`, `archive-test-confirm`, `archive-test-cancel`, `archive-test-plans-warning` |
| Archived banner, restore, badge | `getByTestId` | `test-archived-banner`, `test-detail-restore`, `test-archived-badge` |
| Start Run, tag editor, tag filter, reorder bar, tabs | `getByTestId` | `start-run-button`, `test-tag-editor-open`, `test-tag-filter`, `test-reorder-bar`, `test-tab-runs`, `test-tabs` |
| Traceability | `getByTestId` | `traceability-chain-view`, `traceability-test-archived`, `traceability-atc-archived` |
| ATC usage | `getByTestId` | `atc-usage`, `atc-usage-count` |
| Plan and milestone figures | `getByTestId` | `test-plan-progress`, `test-plan-progress-percent`, `test-plan-progress-passed`, `milestone-readiness`, `milestone-readiness-percent` |
| Run step rows | `getByRole` plus text | No `data-testid` exists for step rows (TC BK-2147 refinement note) |
| Command palette, explorer Tests group, Tests list, chat picker | Not fixed | No test id captured in the TCs; discover with `/playwright-cli` at Code time and record before coding (OQ in §8) |

### [INTEGRATION ONLY] API Details

| Aspect | Value |
|--------|-------|
| Endpoints | `PATCH`, `DELETE /api/v1/tests/{id}`; `POST /api/v1/tests/{id}/restore`; `GET /api/v1/tests/{id}`, `GET /api/v1/tests/{id}/runs`, `GET /api/v1/tests?tag=`, `GET /api/v1/tests/search`; `PATCH /api/v1/tests/{id}/reorder`; `PUT /api/v1/tests/{id}/tags`; `POST /api/v1/tests`; `POST /api/v1/runs`; `GET /api/v1/projects/{id}/runs/report`; `GET /api/v1/workspaces/{id}/runs`; `GET /api/v1/runs/{id}/compare`; `GET /api/v1/activity`; `GET /api/v1/test-plans/{id}/tests`; `GET /api/v1/search`; `GET /api/v1/workspaces/{id}/chat/entities/search` |
| OpenAPI types | `ExpandedTest`, `ChainedAtc`, `ErrorEnvelope`, `RunReportPage`, `WorkspaceRuns`, `ActivityPage`, `ActivityItemTestRenamed`, `ActivityItemTestArchived`, `ActivityItemTestRestored`, `TestPlanMemberTestListResponse`, `TestSearchResult`, `StoryTraceabilityPayload`; re-exported from a new `api/schemas/tests.types.ts` (`@schemas/tests.types`); the committed `api/openapi.json` already contains them, run `bun run api:sync` before Code only if a type is missing |
| Auth Required | Yes. Member cookie session (writes), Admin and Viewer cookie sessions (TC32, TC24), Viewer as non-member of the Member workspace (TC25) |
| Return Pattern | Tuple `[APIResponse, TBody]` (or `[APIResponse, TBody, TPayload]` for writes); error reads use `ErrorEnvelope` and `details.reason` like `RunsApi.readReason` |
| Headers | `Idempotency-Key` (fresh `randomUUID()`) on `POST /tests`, `POST /runs`, `POST /atcs` and plan creates, as `BugApi` does; `X-If-Match` for BK-2165 |

## 3. ATC Registry

### Existing ATCs (Reuse)

None of the 20 TC keys is in the manifest (`components.{api,ui}[].atcs[].id` hold BK-311, BK-312, BK-1656, BK-1657, BK-1664, BK-1665, BK-1963, BK-1967, BK-1974, BK-1975, BK-1982, BK-1983, BK-1992, BK-2100, BK-2101, BK-2105, BK-2106, BK-2107, BK-2117, BK-2118, BK-2119, BK-2122, BK-2134, BK-313, BK-314). No ID collision.

Reused non-ATC members by composition: `RunFixtureSteps.openMemberSession`, `RunFixtureSteps.openOwnerSession`, `RunFixtureSteps.discoverProject`; `AuthApi.getCurrentUser`; `WorkspaceApi.listProjects`, `WorkspaceApi.findProjectBySlug`; `ActivityApi.listActivity`; `RunsApi.getReport` (all pages).

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| BK-2140 | TestDetailPage | `renameFromHeader` | Rename from the Test page: 200, `changed` true, version +1, header shows the new name |
| BK-2144 | TestDetailPage | `archiveFromTestPage` | Open the dialog (title, reversible, Run count), confirm, 204, toast, banner with Restore |
| BK-2147 | RunDetailPage | `readPastRunInFull` | Past Run of an archived Test shows both ATCs, every step, content and recorded status |
| BK-2150 | TraceabilityPage | `expectArchivedTestAsEvidence` | Archived Test with Runs stays under both ATCs with the archived marker, never "No test written yet" |
| BK-2152 | TestDetailPage | `restoreFromBanner` | Restore from the banner: 200, `changed` true, `archived_at` null, Start Run, rename and tag editor offered again |
| BK-2158 | RunsApi | `refuseRunFromArchivedTest` | `POST /runs` for an archived Test: 409, `details.reason` `test_archived` |
| BK-2185 | AtcDetailPage | `expectUsageOfLiveTestsOnly` | ATC detail "used in" omits the archived sibling; count equals live chaining Tests (param: ATC live or archived) |
| BK-2187 | TestDetailPage | `readRunCountInArchiveDialog` | Archive dialog counts finished Runs only, equals `run_count` and the Run history total, cancel keeps the Test live (param: Run mix) |
| BK-2146 | TestsApi | `listTagFilterWithoutArchived` | `GET /tests?tag=` no longer lists the archived Test, total drops by one, remaining order unchanged |
| BK-2153 | TestsApi | `keepRecordsAcrossArchiveAndRestore` | Archive then restore; Test row, Runs, chain steps, plan memberships, tags equal the baseline after each |
| BK-2156 | TestsApi | `refuseBlankTitle(target, title)` | 422 `validation_failed`, `details.reason` `title_required` at rename and at create (param: target kind, blank class); the rename target also re-reads the Test and asserts title and version unchanged |
| BK-2161 | TestsApi | `refuseWriteOnArchivedTest` | 409 `test_archived` on rename, reorder and tags (param: writer) |
| BK-2163 | TestsApi | `refuseWriteByViewer` | 403 `forbidden` for rename, archive, restore as a viewer (param: action) |
| BK-2164 | TestsApi | `hideTestFromNonMember` | 404 identical to a missing Test, search returns an empty list (param: Test state) |
| BK-2165 | TestsApi | `refuseStaleVersionRename` | 409 `version_conflict` naming `current_version` |
| BK-2167 | TestsApi | `applyTitleLengthBoundaries(target, row, title)` | 200 or 201 within 200 characters (code points), 422 `title_too_long` above, at rename and create; the expected status, reason and code-point count come from the literal TC28 row table (`TITLE_LENGTH_ROWS`) |
| BK-2171 | TestsApi | `archiveAgainKeepsFirstArchive` | 204, `archived_at` and `archived_by` unchanged |
| BK-2172 | TestsApi | `restoreLiveTestChangesNothing` | 200, `test.changed` false, `archived_at` null, version unchanged |
| BK-2178 | RunsApi | `holdRunReadsAfterArchive` | Runs report, workspace runs index and run comparison equal their baselines, every page |
| BK-2179 | PlanFiguresPage | `expectFiguresUnchangedAfterArchive` | Open plan figures, milestone readiness and closed plan frozen figures equal the baselines |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|-----------|--------|---------|-------------|
| TestsApi | `createTest` | `[APIResponse, ExpandedTest]` | `POST /tests` with a chain of ATC ids and a title; asserts 201 (setup) |
| TestsApi | `getTest` | `[APIResponse, TestBody]` | `GET /tests/{id}` |
| TestsApi | `renameTest` | `[APIResponse, RenameBody]` | `PATCH /tests/{id}`, optional `X-If-Match`; asserts 200 (setup, rename-back) |
| TestsApi | `archiveTest`, `restoreTest` | `[APIResponse, ...]` | Stimulus and cleanup calls; assert 204 and 200 |
| TestsApi | `setTags`, `reorderChain` | `[APIResponse, ...]` | Setup; assert 200 |
| TestsApi | `listRunHistory` | `[APIResponse, RunHistoryPage]` | `GET /tests/{id}/runs`, one page or all pages |
| TestsApi | `listByTag`, `searchTests` | `[APIResponse, ...]` | `GET /tests?tag=`, `GET /tests/search`, one page or all |
| RunsApi | `startRun`, `markStep`, `finishRun` | tuples | Real-path Run generation (assert 201/200) |
| RunsApi | `readWorkspaceRuns`, `readCompare`, `captureRunReads` | tuples / `RunReadsBaseline` | All pages of report and workspace index plus compare, for BK-2178 |
| ActivityApi | `listTestEvents` | `[APIResponse, ActivityItem[]]` | Feed filtered to `test.*` items of one Test id (delta against a baseline) |
| AtcsApi | `createAtc`, `archiveAtc`, `readAtcUsage` | tuples | Seeding; usage read for BK-2152 |
| StructureApi | `createModule`, `createUserStory`, `createAcceptanceCriterion`, `archiveModule` | tuples | Seeding scaffold |
| SearchApi | `searchWorkspace`, `searchChatEntities` | tuples | Offer-surface reads for BK-2152 |
| PlansApi | `createPlan`, `addTests`, `closePlan`, `listPlanTests`, `createMilestone`, `attachPlans` | tuples | TC40 seeding and the "no membership row added or removed" read |
| TestDetailPage | `goto`, `expectNoWriteControls`, `expectOffersWriteControls`, `expectFrozen`, `expectNoStartRun`, `expectRenameError`, `readRunHistoryRows` | `void` / data | Test-level UI assertions for ATC-owning TCs and the UI halves of integration TCs |

## 4. Test Data Strategy

### 4.1 Classification (summary; the full table is in spec.md)

Generate per test through the product API (Test, ATCs, Runs, plans, milestone), Discover for sessions, workspace, project and environment, Generate the project or environment when absent. No sprint fixture ("BK-596 QA Test A/B/C", siblings, plans) is read or mutated: each TC body's fixture variables map to generated equivalents.

| TC body fixture | Generated equivalent |
|-----------------|----------------------|
| Test A (2 finished Runs, 3 plans, tags, chain ATC A, ATC B) | `seedTest({ atcs: 2, finishedRuns: 2, failedStepInRun: 2, tags, plans })` |
| Test B (never run, live) | `seedTest({ atcs: 1 })` |
| Test C (one running Run, no finished) | `seedTest({ atcs: 1, runningRuns: 1 })` |
| Siblings S1, S2, S3 and ATC C | `seedSiblings({ count: 3, sharedAtc: true, sharedTag })` |
| Fixture story | the generated user story of the file scaffold |
| Foreign workspace Test N | `seedTest` inside the Member-owned workspace, read by the Viewer session |

### 4.2 Feasibility per TC

| TC | Precondition | Pattern | Feasibility | Notes |
|----|--------------|---------|-------------|-------|
| BK-2140 | live Test, chain of 2, tags, known version | Generate | Feasible | Tags via `PUT /tests/{id}/tags` raise the version; read the version just before the rename |
| BK-2144 | live Test with 2 finished Runs | Generate | Feasible | Real path: start, mark every step, finish |
| BK-2147 | archived Test, 2 finished Runs, second has a failed step | Generate | Feasible | Mark one step `failed`, finish with verdict `failed` |
| BK-2150 | Test with Runs under a story whose ATCs it chains | Generate | Feasible | Traceability needs the ATCs bound to acceptance criteria of the generated story (the ATC create body requires them) |
| BK-2152 | archived Test | Generate | Feasible | Offer-surface UI locators unknown (see §8) |
| BK-2158 | archived never-run Test, environment | Generate | Feasible | Environment from discovery |
| BK-2185 | ATC chained by S1, S2 live and S3 archived; ATC live or archived | Generate | Feasible | Archive of an ATC is `DELETE /atcs/{id}` |
| BK-2187 | Test with one running Run; Test with finished Runs only | Generate | Feasible | Start a Run and leave it running |
| BK-2146 | Test and 3 siblings sharing a tag | Generate | Risky | Use a unique generated tag so the baseline is deterministic; `smoke` row replaced (OQ4) |
| BK-2153 | Test with Runs, steps, memberships | Generate | Feasible | DB reads replaced by API reads (§4.3) |
| BK-2156 | live never-run Test, one live ATC | Generate | Feasible | Create rows need `workspace_id` in the body for token callers; cookie default is the active workspace |
| BK-2161 | archived Test with chain of 2 | Generate | Feasible | Reorder body uses `step_ids` |
| BK-2163 | live Test; archived Test for the restore row; Viewer session in the QA workspace | Generate + Discover | Feasible | Test generated by the Member in the QA workspace |
| BK-2164 | Test in a workspace the Viewer does not belong to | Generate in the Member-owned workspace | Risky | Needs a project there; Generate if none (OQ3). Search is project-scoped so aim it at the generated project |
| BK-2165 | live Test at known version | Generate | Feasible | Tag change raises the version |
| BK-2167 | live Test, one live ATC | Generate | Feasible | Titles from `DataFactory.createTitleOfLength`; created Tests archived in `afterAll` |
| BK-2171 | Test archived by the Member; Admin session | Generate + Discover | Feasible | QA workspace |
| BK-2172 | live Test | Generate | Feasible | |
| BK-2178 | Test with finished Runs; baselines of 3 reads | Generate | Risky | Workspace runs index is workspace-wide: concurrent files could move it; arena is the Member-owned workspace, project generated (OQ3) |
| BK-2179 | Test in open plan (in milestone) and closed plan; baselines | Generate through the real path | Risky | Figures readable only on pages (OQ1); closing a plan needs a verdict |

### 4.3 DB reads replaced by product API reads

The framework has no DB client (`package.json` holds none; the `dbhub` MCP is for the planning agent only) and the progress and readiness functions are not callable by a user token (execute is granted to the service and read-only inspector roles only). Test code therefore reads through the product.

| TC body DB read | Replacement |
|-----------------|-------------|
| `tests.archived_at`, `archived_by`, `version`, `tags`, title | `GET /tests/{id}` (`archived_at`, `archived_by`, `version`, `tags`, `title`); `char_length` = `[...title].length` |
| `activity_log` rows by action | `GET /activity?workspace_id=` newest first, filtered by action and entity (`ActivityApi.listTestEvents`), baseline-then-delta |
| `runs` rows of a Test | `GET /tests/{id}/runs` (finished only) and `GET /workspaces/{id}/runs` (all statuses) |
| `test_steps` ids, atc ids, positions | `GET /tests/{id}` chain (`atcs[].step_id`, `atc_id` via `id`, `position`) |
| `test_plan_tests` | `GET /test-plans/{id}/tests` and `plans[]` of `GET /tests/{id}` |
| `bunkai_plan_progress`, `bunkai_milestones_readiness`, `test_plans.progress_snapshot` | Plan and milestone pages (`PlanFiguresPage`): open (OQ1) |

### DataFactory additions (`tests/data/DataFactory.ts`, faker stays inside the factory)

```typescript
static createTestTitle(): string {
  return `Kata Test ${this.createTestId('bk596')}`;
}

static createTitleOfLength(args: { character: string, count: number }): string {
  return args.character.repeat(args.count);
}

static createModuleName(): string {
  return `Kata module ${this.createTestId('bk596')}`;
}

static createAtcPayload(args: { moduleId: string, userStoryId: string, acceptanceCriterionIds: string[] }): CreateAtcPayload {
  return {
    title: `Kata ATC ${this.createTestId('bk596')}`,
    module_id: args.moduleId,
    user_story_id: args.userStoryId,
    acceptance_criterion_ids: args.acceptanceCriterionIds,
    layer: 'API',
    steps: [
      { position: 1, content: faker.lorem.sentence() },
      { position: 2, content: faker.lorem.sentence() },
    ],
  };
}
```

### Constants and types additions

```typescript
export const TEST_LIFECYCLE = {
  titleRequiredReason: 'title_required',
  titleTooLongReason: 'title_too_long',
  blankTitles: {
    empty: '',
    spaces: '   ',
    tabs: '\t\t',
    nonBreakingSpaces: '  ',
  },
  characters: { ascii: 'a', accented: 'é', emoji: '😀' },
} as const;

export const TEST_LIFECYCLE_FIXTURE = {
  workspaceName: 'QA Kata BK-596',
  workspaceSlug: 'qa-kata-bk596',
  projectNamePrefix: 'kata-bk596',
} as const;
```

`types.ts` gains `TestLifecycleArena` (`workspaceId`, `project: FixtureProject`), `SeededTest` (`id`, `title`, `version`, `atcIds`), `CreateAtcPayload`.

## 5. Test Scenarios

All files: staging only; retries 0; `afterAll` calls `TestSeedSteps.teardown()` then `TestLifecycleSteps.release()`; titles are the Jira summaries.

### File: tests/e2e/test-lifecycle/renameTest.test.ts

Fixture: `{ test: kata }` with `test.use({ storageState: config.auth.roleStatePath('member') })`

#### Scenario 1: BK-2140 rename keeps chain, step ids and tags
Test: "BK-2140: should show the new name on the Test header, Tests list, explorer and search and raise the version by one keeping chain, step ids and tags after a rename by a member"
Preconditions: Member session; arena; `seedTest({ atcs: 2, tags: [tag, tagB] })`; baseline `getTest` (version, chain with step ids, tags).
ATCs called: `kata.ui.testDetail.renameFromHeader({ title })`.
Test-level assertions: `getTest` shows title, version = baseline + 1, same chain order, same step ids, same tags; `OfferSurfaceSteps.expectTitleOnSurfaces` (Tests list, explorer, workspace search by the unique title); `ActivityApi.listTestEvents` gained one `test.renamed` carrying old and new name.
Teardown: rename back via `renameTest`; Test archived in `afterAll`.

### File: tests/e2e/test-lifecycle/archiveRestoreTest.test.ts

Fixture: `{ test: kata }`, Member storage state.

#### Scenario 1: BK-2144 archive after confirmation
Test: "BK-2144: should archive after a confirmation naming the Test, its reversibility and its Run count, then show the restore hint"
Preconditions: `seedTest({ atcs: 2, finishedRuns: 2 })`; baseline `test.archived` events.
ATCs called: `kata.ui.testDetail.archiveFromTestPage({ title, runCount: 2 })`.
Test-level assertions: `getTest` has `archived_at` and `archived_by` equal to the Member id (`GET /me`); exactly one new `test.archived` event; banner offers Restore.
Teardown: `restoreTest` is unnecessary (archived Test is the end state); nothing else.

#### Scenario 2: BK-2152 restore returns the Test to every offer surface
Test: "BK-2152: should return a restored Test to every offer surface and allow Run start, rename, reorder and tags again"
Preconditions: seeded Test with a unique tag, in one plan, archived through `archiveTest`; `OfferSurfaceSteps.readOffers` baseline shows absent.
ATCs called: `kata.ui.testDetail.restoreFromBanner()`.
Test-level assertions: `OfferSurfaceSteps.readOffers` shows the Test on workspace search, tag filter, `GET /tests/search` (plan picker), chat picker and ATC "used in"; UI surfaces Tests list and explorer; `expectOffersWriteControls`; `renameTest` to a new title answers 200 `changed` true, and back.

#### Scenario 3: BK-2158 archived Test offers no Start Run and refuses POST /runs
Test: "BK-2158: should offer no Start Run and refuse POST /runs with 409 test_archived given an archived Test"
Preconditions: `seedTest({ atcs: 1 })` archived; environment from the arena; workspace runs baseline.
ATCs called: `member.api.runs.refuseRunFromArchivedTest({ testId, environmentId })`.
Test-level assertions: `kata.ui.testDetail.expectNoStartRun`; workspace runs index has no row for the Test.

### File: tests/e2e/test-lifecycle/viewArchivedEvidence.test.ts

Fixture: `{ test: kata }`, Member storage state.

#### Scenario 1: BK-2147 past Runs stay readable
Test: "BK-2147: should render every step of a past Run and list all Runs in the Run history given an archived Test"
Preconditions: `seedTest({ atcs: 2, finishedRuns: 2, failedStepInRun: 2 })` archived.
ATCs called: `kata.ui.runDetail.readPastRunInFull` once per Run (loop in the test).
Test-level assertions: `listRunHistory` lists both Runs; `testDetail.readRunHistoryRows` lists both; the second Run shows its failed step.

#### Scenario 2: BK-2150 traceability keeps the archived Test as evidence
Test: "BK-2150: should keep an archived Test with Runs as evidence in Story traceability, marked Archived"
Preconditions: generated story, ATCs bound to its criteria, Test with finished Runs, archived through `archiveTest`.
ATCs called: `kata.ui.traceability.expectArchivedTestAsEvidence({ projectSlug, storyId, testTitle, atcTitles })`.
Test-level assertions: `GET /projects/{id}/traceability?story=` still lists the Test and its latest Run under both ATCs.

### File: tests/e2e/test-lifecycle/reportArchiveUsage.test.ts

Fixture: `{ test: kata }`, Member storage state.

#### Scenario 1: BK-2185 ATC usage omits the archived Test (outline over ATC state)
Test: "BK-2185: should leave an archived Test out of an ATC detail \"used in\" list and its count given the ATC is chained by it" (rows: `live`, `archived`)
Preconditions: `seedSiblings({ count: 3, sharedAtc: true })`; sibling 3 archived; for the archived row the ATC archived through `archiveAtc`.
ATCs called: `kata.ui.atcDetail.expectUsageOfLiveTestsOnly`.
Teardown: restore sibling 3; restore the ATC is not available for an ATC created here, so the archived row's ATC is archived last in `afterAll` (the ATC restore route belongs to BK-571; use `POST /atcs/{id}/restore` through `AtcsApi.restoreAtc` if the TC cleanup is kept literal, decide at Code).

#### Scenario 2: BK-2187 archive dialog counts finished Runs only (outline over Run mix)
Test: "BK-2187: should count finished Runs only in the archive dialog, matching the Run history, given a Run still running" (rows: running only, finished only)
Preconditions: Test C (`runningRuns: 1`) and Test A (`finishedRuns: 2`).
ATCs called: `kata.ui.testDetail.readRunCountInArchiveDialog({ expectedRuns })`.
Test-level assertions: `getTest.run_count` and `listRunHistory` total equal the dialog count; the Test is still live (`archived_at` null).

### File: tests/integration/test-lifecycle/refuseInvalidTestTitle.test.ts

Fixture: `{ test: kata }` with Member storage state (UI half for the rename row of BK-2156).

#### Scenario 1: BK-2156 blank titles (outline, 6 rows)
Test: "BK-2156: should refuse a blank name with a required-name error (422) and keep the old name given an empty, space, tab or non-breaking-space-only title at rename and create"
Preconditions: `seedTest({ atcs: 1 })` at known version; one live ATC.
ATCs called: `member.api.tests.refuseBlankTitle({ target, title })`.
Test-level assertions: rename rows: title and version unchanged, no new `test.renamed` event, UI `expectRenameError` for one rename row; create rows: no new Test with that title in the workspace (`searchTests`).

#### Scenario 2: BK-2167 length rule (outline, 8 rows)
Test: "BK-2167: should accept 199 and 200 characters, also 200 multi-byte characters, and refuse 201 with a too-long error (422) at rename and create"
Preconditions: `seedTest({ atcs: 1 })`; one live ATC.
ATCs called: `member.api.tests.applyTitleLengthBoundaries({ target, row, title })`, one test per `TITLE_LENGTH_ROWS` entry.
Test-level assertions: accepted rename stores `[...title].length` equal to the count; refused rename leaves the title unchanged and no new `test.renamed` event; created Tests archived in `afterAll`; original title restored.

#### Scenario 3: BK-2165 stale version
Test: "BK-2165: should refuse a rename carrying a stale version with a 409 version conflict and the current version given a Test changed after it was read"
Preconditions: Test at V; `setTags` raises it to V+1.
ATCs called: `member.api.tests.refuseStaleVersionRename({ testId, staleVersion })`.
Test-level assertions: title unchanged, no `test.renamed` event; tags reset to `[]` at the end.

### File: tests/integration/test-lifecycle/guardTestWrites.test.ts

Fixture: `{ test: kata }` with Member storage state (UI halves).

#### Scenario 1: BK-2161 frozen when archived (outline, 3 rows)
Test: "BK-2161: should refuse rename, reorder and tag changes with a 409 archived error and keep the version, title, chain and tags given an archived Test"
Preconditions: Test with 2 chained ATCs and tags, archived by the Member; baseline version, title, chain, tags.
ATCs called: `member.api.tests.refuseWriteOnArchivedTest({ writer })`.
Test-level assertions: version, title, chain order, tags unchanged; no new events; UI `expectFrozen` (no rename control, tag editor, reorder bar; banner present).

#### Scenario 2: BK-2163 viewer refused (outline, 3 rows)
Test: "BK-2163: should offer a workspace viewer no rename, archive or restore control and refuse each call with 403 given a live or archived Test"
Preconditions: QA workspace arena; Test generated by the Member; for the restore row archived by the Member first; Viewer API session and Viewer browser context.
ATCs called: `viewer.api.tests.refuseWriteByViewer({ action })`.
Test-level assertions: Test row unchanged (`getTest` by the Member), no new events, Viewer UI `expectNoWriteControls`.
Teardown: Member restores the Test archived for the restore row.

#### Scenario 3: BK-2164 non-member (outline, 2 rows)
Test: "BK-2164: should answer 404 and hide an archived Test from search for a workspace non-member, the same as for a live Test"
Preconditions: Test in the Member-owned workspace, live or archived; Viewer session (not a member of that workspace).
ATCs called: `viewer.api.tests.hideTestFromNonMember({ testId, title, projectId, state })`.
Test-level assertions: the palette returns nothing for the title (UI helper, locator discovered at Code time).
Teardown: Member restores the Test when archived for the row.

### File: tests/integration/test-lifecycle/repeatArchiveRestore.test.ts

Fixture: `{ api }` is not used; Steps sessions (no browser)

#### Scenario 1: BK-2171 second archive
Test: "BK-2171: should answer 204 to a second archive and keep the first archive time and actor with no second event given an already archived Test"
Preconditions: QA workspace Test archived by the Member; baseline `archived_at`, `archived_by`, event count.
ATCs called: `admin.api.tests.archiveAgainKeepsFirstArchive({ testId, firstArchive })`.
Test-level assertions: exactly one `test.archived` event for the Test.

#### Scenario 2: BK-2172 restore live
Test: "BK-2172: should answer 200 with changed false and write no event when restoring a live Test"
Preconditions: live Test.
ATCs called: `member.api.tests.restoreLiveTestChangesNothing({ testId, versionBefore })`.
Test-level assertions: no `test.restored` event.

#### Scenario 3: BK-2153 nothing destroyed
Test: "BK-2153: should keep the Test row and every Run, step and plan membership unchanged across archive and restore"
Preconditions: Test with 2 finished Runs, 2 chain steps, 3 plan memberships (`PlansApi.createPlan` x3, `addTests`).
ATCs called: `member.api.tests.keepRecordsAcrossArchiveAndRestore({ testId })`.
Test-level assertions: `GET /test-plans/{id}/tests` lists the Test for each plan after each action.

### File: tests/integration/test-lifecycle/hideArchivedTestFromOffers.test.ts

Fixture: `{ test: kata }` with Member storage state (workbench tag filter UI half).

#### Scenario 1: BK-2146 tag filter (outline, 2 rows)
Test: "BK-2146: should drop the archived Test from the tag filter and keep its three siblings in the same order"
Preconditions: `seedSiblings({ count: 3, sharedTag })` plus a Test A carrying the shared tag and a unique tag; baseline `listByTag` for each tag (list and total).
ATCs called: `member.api.tests.listTagFilterWithoutArchived({ tag, testId, baseline })`.
Test-level assertions: workbench tag filter shows the same remaining rows (`test-tag-filter`).
Teardown: Test A restored then archived with the rest in `afterAll`.

### File: tests/integration/test-lifecycle/keepPastNumbersAfterArchive.test.ts

Fixture: `{ test: kata }` with Member storage state.

#### Scenario 1: BK-2178 run reads unchanged
Test: "BK-2178: should keep the runs report, the workspace runs index and the run comparison identical after archiving a Test given a Test with finished Runs"
Preconditions: arena project and workspace; Test with finished Runs; `RunsApi.captureRunReads` baseline (every page, limit 50 plus cursor).
ATCs called: `member.api.runs.holdRunReadsAfterArchive({ baseline, ... })` after `member.api.tests.archiveTest`.
Teardown: `restoreTest`.

#### Scenario 2: BK-2179 plan figures unchanged
Test: "BK-2179: should keep open plan progress, milestone readiness and a closed plan snapshot identical after archiving a Test given a Test held by open and closed plans"
Preconditions: Test with a finished passed Run; open plan holding it, attached to a milestone; closed plan holding it (closed through `closePlan`); `PlanFiguresPage` baselines.
ATCs called: `kata.ui.planFigures.expectFiguresUnchangedAfterArchive({ baseline })` after `archiveTest`.
Test-level assertions: `listPlanTests` of both plans still lists the Test (no membership row added or removed).
Teardown: `restoreTest`.

### PR1 deviations (BK-2156 and BK-2167)

- One ATC per TC id (the `kata:manifest:check` rule): `refuseBlankTitle(target, title)` owns BK-2156 and `applyTitleLengthBoundaries(target, row, title)` owns BK-2167. `target` is a rename-or-create discriminated input; the BK-2167 expectations come from the literal TC28 row table `TITLE_LENGTH_ROWS` in `tests/data/constants.ts`, never from a caller-chosen status.
- Only a test that needs a rename target or the UI page seeds its own Test (per-test seeding on demand); the create rows seed nothing. So there is no end-of-run title restore; created Tests are archived in teardown, including any Test a create produced even when the ATC threw: the create target's `onCreated` callback records the id from the 2xx response before any assertion runs.
- "No Test created" on a refused create is proven by the 422 plus no new `test.created` activity event in the arena, comparing the set of event ids before and after the call with no title filter. A title filter on the attempted raw title could never fail, because the server trims the title, so a wrongly created Test would carry the trimmed title and never match; the unfiltered comparison is safe because writes are serial and the arena is dedicated. `listTestEvents` keeps its optional title filter for other consumers. An accepted create is also read back by id and its stored title length is asserted against the row count. This replaces `searchTests`, because a blank title is not searchable.
- The arena is a workspace owned by the Owner test user, found or created by `TestLifecycleSteps` (name and slug in `TEST_LIFECYCLE_FIXTURE`), with the Member, Viewer and Admin role users invited and accepted into it with their roles and the project `kata-bk596` inside it, so the tests run as a real Member and later slices reuse the Viewer and Admin. Its scaffold is found or created level by level, in order (module, user story, acceptance criterion, ATC), each by its stable name from the project's module tree read (`GET /v1/projects/{id}/modules`) and the ATC search, so a run that stopped half way is completed by the next one instead of hitting a duplicate module path, and a re-run creates none; only the Test is seeded per test.
- The BK-2156 UI half covers client-side validation only: it asserts the required-name message and that no PATCH to the Test left the page; the server refusal is proven by the API rows.
- The create-body, `environmentId`, tag and Run baseline items are not built in PR1; later slices add each with its consumer.

## 6. Implementation Order

Work packages (each ends with `bun run types:check`, `bun run lint:check`, `bun run kata:manifest`, and a work-unit commit; the ~400-line figure is an advisory heuristic only):

- [ ] WP1 Foundations: `playwright.config.ts` role lists (via /framework-development), `api/schemas/tests.types.ts`, `api/schemas/index.ts`, `tests/data/DataFactory.ts`, `tests/data/types.ts`, `tests/data/constants.ts`
- [ ] WP2 `TestsApi.ts` (10 ATCs: BK-2146, BK-2153, BK-2156, BK-2161, BK-2163, BK-2164, BK-2165, BK-2167, BK-2171, BK-2172) and `ApiFixture.ts` registration
- [ ] WP3 Supporting API: `AtcsApi.ts`, `StructureApi.ts`, `SearchApi.ts`, `PlansApi.ts`, `RunsApi.ts` extension (BK-2158, BK-2178, helpers), `ActivityApi.ts` helper, `ApiFixture.ts` registration
- [ ] WP4 Steps: `TestLifecycleSteps.ts`, `TestSeedSteps.ts`, `OfferSurfaceSteps.ts`
- [ ] WP5 UI components A: `TestDetailPage.ts` (BK-2140, BK-2144, BK-2152, BK-2187), `RunDetailPage.ts` (BK-2147), `UiFixture.ts` registration
- [ ] WP6 UI components B: `TraceabilityPage.ts` (BK-2150), `AtcDetailPage.ts` (BK-2185), `PlanFiguresPage.ts` (BK-2179), `UiFixture.ts` registration
- [ ] WP7 Integration A: `refuseInvalidTestTitle.test.ts`, `guardTestWrites.test.ts` (BK-2156, BK-2167, BK-2165, BK-2161, BK-2163, BK-2164)
- [ ] WP8 Integration B: `repeatArchiveRestore.test.ts`, `hideArchivedTestFromOffers.test.ts`, `keepPastNumbersAfterArchive.test.ts` (BK-2171, BK-2172, BK-2153, BK-2146, BK-2178, BK-2179)
- [ ] WP9 E2E A: `renameTest.test.ts`, `archiveRestoreTest.test.ts` (BK-2140, BK-2144, BK-2152, BK-2158)
- [ ] WP10 E2E B: `viewArchivedEvidence.test.ts`, `reportArchiveUsage.test.ts` (BK-2147, BK-2150, BK-2185, BK-2187)
- [ ] Run the suite on staging; the TMS TCs move to Pull Request on PR open (`create_pr` transition), never to Automated before merge

Dependency graph: WP1 -> WP2 -> WP3 -> WP4 -> {WP5 -> WP6} -> {WP7, WP8} -> {WP9, WP10}. WP7 and WP8 UI halves need WP5 and WP6; their API halves can land first if a pack must be split.

## 7. Success Criteria

- [ ] All 20 TCs automated; every Expected Result of the TC body asserted, with the DB reads replaced as in §4.3
- [ ] Risk-beyond-AC captured as open questions (spec.md OQ6), no TC added
- [ ] BVA automated for the title length (199, 200, 201; accented and emoji at 200 and 201) and the blank classes
- [ ] KATA compliance: ATCs never call ATCs; chains live in Steps; max 2 positional params; locators inline until used twice; import aliases only
- [ ] Fixture correct: each file opens role sessions in `beforeAll` and never logs in per test
- [ ] No hardcoded waits, retries 0, each test generates its data, no comments in code, no `customfield_NNNNN`
- [ ] Tests pass on staging
- [ ] `bun run repo:check` green, manifest regenerated

## 8. Open items at Code time

- Locators for the command palette, the explorer Tests group, the Tests list and the chat picker are not in any TC; record them with `/playwright-cli` before WP5, or narrow the BK-2152 and BK-2140 surface checks to the API reads and raise it.
- Plan and milestone page routes and the Run detail route are not in the TCs; discover them the same way.
- OQ1 to OQ7 of spec.md are the decisions the plan waits on; WP1 to WP4 do not depend on them.
