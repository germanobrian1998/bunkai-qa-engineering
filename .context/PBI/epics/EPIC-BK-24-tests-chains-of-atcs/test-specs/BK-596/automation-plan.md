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
| Start Run, tag editor, tag filter, reorder handle, tabs | `getByTestId` | `start-run-button`, `test-tag-editor-open`, `test-tag-filter`, `test-reorder-handle-<position>`, `test-tab-runs`, `test-tabs` |
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
| BK-2146 | TestsApi | `listTagFilterWithoutArchived({ row, tag, testId, baseline })` | `GET /tests?tag=` (all pages) no longer lists the archived Test, count drops by one, remaining order unchanged; remaining count from the literal `TAG_FILTER_ROWS` row; the API half is the only proof that archived Tests are dropped |
| BK-2153 | TestsApi | `keepRecordsAcrossArchiveAndRestore({ testId })` | Archive then restore; Test row, Run ids, chain step ids, plan ids and each plan's memberships (`id`, `added_at`, `added_by`), tags (sorted) equal the baseline after each |
| BK-2156 | TestsApi | `refuseBlankTitle(target, title)` | 422 `validation_failed`, `details.reason` `title_required` at rename and at create (param: target kind, blank class); the rename target also re-reads the Test and asserts title and version unchanged |
| BK-2161 | TestsApi | `refuseWriteOnArchivedTest({ testId, row, stepIds })` | 409 `conflict` with `details.reason` `test_archived` on rename, reorder and tags; expectations come from `FROZEN_RENAME_ROW` and `FROZEN_WRITE_ROWS` |
| BK-2163 | TestsApi | `refuseWriteByViewer({ testId, row })` | 403 `forbidden` (status and `error.code` only; the reason is BK-2091) for rename, archive, restore as a viewer; expectations come from the literal `VIEWER_WRITE_ROWS` table |
| BK-2164 | TestsApi | `hideTestFromNonMember({ testId, title, projectId, row })` | 404 identical to a missing Test (request id ignored), search answers 200 with an empty list; expectations come from the literal `NON_MEMBER_ROWS` table |
| BK-2165 | TestsApi | `refuseStaleVersionRename({ testId, staleVersion, currentVersion })` | 409 `conflict`, `details.reason` `version_conflict`, `current_version` = `currentVersion`, the live version read after the tag change |
| BK-2167 | TestsApi | `applyTitleLengthBoundaries(target, row, title)` | 200 or 201 within 200 characters (code points), 422 `title_too_long` above, at rename and create; the expected status, reason and code-point count come from the literal TC28 row table (`TITLE_LENGTH_ROWS`) |
| BK-2171 | TestsApi | `archiveAgainKeepsFirstArchive({ testId, firstArchive })` | 204, `archived_at` and `archived_by` unchanged |
| BK-2172 | TestsApi | `restoreLiveTestChangesNothing({ testId, versionBefore })` | 200, `test.changed` false, `archived_at` null, version unchanged |
| BK-2178 | RunsApi | `holdRunReadsAfterArchive({ baseline, scope })` | Module-scoped runs report, workspace runs index rows of the Test and run comparison equal their baselines, every page |
| BK-2179 | PlanFiguresPage | `expectFiguresUnchangedAfterArchive({ baseline, scope })` | Open plan figures, milestone readiness and closed plan frozen figures (0 percent, closed before the Run finished) equal the baselines |

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
| RunsApi | `readModuleReport`, `readWorkspaceRuns`, `readCompare`, `captureRunReads` | tuples / `RunReadsBaseline` | All pages of the module-scoped report; the workspace index (rows of the Test and the run count) down to the Test creation time; plus compare, for BK-2178 |
| ActivityApi | `snapshotTestEvents`, `listNewTestEvents` | `string[]` | Event ids of the feed filtered by action list and optional Test id; the delta read returns the ids not in a known snapshot. The only implementation, used by every spec |
| AtcsApi | `createAtc`, `archiveAtc`, `readAtcUsage` | tuples | Seeding; usage read for BK-2152 |
| StructureApi | `createModule`, `createUserStory`, `createAcceptanceCriterion`, `archiveModule` | tuples | Seeding scaffold |
| SearchApi | `searchWorkspace`, `searchChatEntities` | tuples | Offer-surface reads for BK-2152 |
| PlansApi | `createPlan`, `addTests`, `closePlan`, `listPlanTests`, `createMilestone`, `attachPlans`, `archiveMilestone` | tuples | TC40 seeding, teardown and the "no membership row added or removed" read |
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
| BK-2178 | Test with finished Runs; baselines of 3 reads | Generate | Feasible | Report scoped by a generated module (`module_id`); workspace index read per project, stops paging at the Test creation time, compared on the Test rows only, `workspace_run_count` as a floor (PR4 deviations) |
| BK-2179 | Test in open plan (in milestone) and closed plan; baselines | Generate through the real path | Feasible | Figures readable only on pages (OQ1, decided: UI ATC); closing a plan needs a verdict; a milestone accepts open plans only |

### 4.3 DB reads replaced by product API reads

The framework has no DB client (`package.json` holds none; the `dbhub` MCP is for the planning agent only) and the progress and readiness functions are not callable by a user token (execute is granted to the service and read-only inspector roles only). Test code therefore reads through the product.

| TC body DB read | Replacement |
|-----------------|-------------|
| `tests.archived_at`, `archived_by`, `version`, `tags`, title | `GET /tests/{id}` (`archived_at`, `archived_by`, `version`, `tags`, `title`); `char_length` = `[...title].length` |
| `activity_log` rows by action | `GET /activity?workspace_id=` newest first, filtered by action and entity (`ActivityApi.snapshotTestEvents`, `ActivityApi.listNewTestEvents`), baseline-then-delta |
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
Preconditions: Member session; arena; `seedInState({ state: 'live', chainLength: 2, tags: [tag, tagB] })` (the returned read is the baseline: version, chain with step ids, tags).
ATCs called: `kata.ui.testDetail.renameFromHeader({ title })`.
Test-level assertions: `getTest` shows title, version = baseline + 1, same chain order, same step ids, same tags; `TestDetailPage.expectTitleInExplorer`, `TestsListPage.expectRowTitle` (after the unique-tag filter), workspace search through `SearchApi.searchPalette` on a scoped member session (new title found, old title gone) and `TestsApi.searchTests`; `ActivityApi.listNewTestActivity` returns one `test.renamed` carrying old and new title.
Teardown: Test archived in `afterAll` (no rename back).

### File: tests/e2e/test-lifecycle/archiveRestoreTest.test.ts

Fixture: `{ test: kata }`, Member storage state.

#### Scenario 1: BK-2144 archive after confirmation
Test: "BK-2144: should archive after a confirmation naming the Test, its reversibility and its Run count, then show the restore hint"
Preconditions: `seedWithHistory({ chainLength: 2, tags: [], finishedRuns: 2, plans: 0 })`; baseline `test.archived` events.
ATCs called: `kata.ui.testDetail.archiveFromTestPage({ title, runCount: 2 })`.
Test-level assertions: `getTest` has `archived_at` and `archived_by` equal to the Member id (`GET /me`); exactly one new `test.archived` event with the Test title; run history still lists the 2 Runs.
Teardown: `restoreTest` is unnecessary (archived Test is the end state); nothing else.

#### Scenario 2: BK-2152 restore returns the Test to every offer surface
Test: "BK-2152: should return a restored Test to every offer surface and allow Run start, rename, reorder and tags again"
Preconditions: seeded Test with a unique tag, in one plan, archived through `archiveTest`; `OfferSurfaceSteps.readOffers` baseline shows absent.
ATCs called: `kata.ui.testDetail.restoreFromBanner()`.
Test-level assertions: `OfferSurfaceSteps.readOffers` shows the Test on workspace search, tag filter, `GET /tests/search` (plan picker), chat picker and ATC "used in"; UI surfaces Tests list and explorer; `expectOffersWriteControls`; `renameTest` to a new title answers 200 `changed` true, and back.

#### Scenario 3: BK-2158 archived Test offers no Start Run and refuses POST /runs
Test: "BK-2158: should offer no Start Run and refuse POST /runs with 409 test_archived given an archived Test"
Preconditions: live never-run Test (`seedInState`), environment from `TestSeedSteps.ensureEnvironment`; the Test is archived mid-test after the live Start Run control.
ATCs called: `api.runs.refuseRunFromArchivedTest({ testId, environmentId })`.
Test-level assertions: `expectStartRunOffered` on the live Test, `expectNoStartRun` after the archive; workspace runs index has no row for the Test since its creation.

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
ATCs called: `member.api.tests.refuseStaleVersionRename({ testId, staleVersion, currentVersion })`.
Test-level assertions: title unchanged, no `test.renamed` event; the Test is archived by the shared teardown.

### File: tests/integration/test-lifecycle/guardTestWrites.test.ts

Fixture: `{ test: kata }` with Member storage state (UI halves).

#### Scenario 1: BK-2161 frozen when archived (outline, 3 rows)
Test: "BK-2161: should refuse rename, reorder and tag changes with a 409 archived error and keep the version, title, chain and tags given an archived Test"
Preconditions: Test with 2 chained ATCs and tags, archived by the Member; baseline version, title, chain, tags.
ATCs called: `member.api.tests.refuseWriteOnArchivedTest({ testId, row, stepIds })`.
Test-level assertions: version, title, chain order, tags unchanged; no new events; UI `expectFrozen` (no rename control, tag editor, reorder handle; banner present), run once in its own test.

#### Scenario 2: BK-2163 viewer refused (outline, 3 rows)
Test: "BK-2163: should offer a workspace viewer no rename, archive or restore control and refuse each call with 403 given a live or archived Test"
Preconditions: QA workspace arena; Test generated by the Member; for the restore row archived by the Member first; Viewer API session and Viewer browser context.
ATCs called: `viewer.api.tests.refuseWriteByViewer({ testId, row })`.
Test-level assertions: Test row unchanged (`getTest` by the Member), no new events, Viewer UI `expectNoWriteControls`.
Teardown: none; the Test ends archived.

#### Scenario 3: BK-2164 non-member (outline, 2 rows)
Test: "BK-2164: should answer 404 and hide an archived Test from search for a workspace non-member, the same as for a live Test"
Preconditions: Test in the Member-owned workspace, live or archived; Viewer session (not a member of that workspace).
ATCs called: `viewer.api.tests.hideTestFromNonMember({ testId, title, projectId, row })`.
Test-level assertions: the ATC asserts the 404 parity and the empty project search; the test asserts the owner-side controls and that the viewer palette (`GET /v1/search`) answers an empty list.
Teardown: none; the Test ends archived.

### File: tests/integration/test-lifecycle/repeatArchiveRestore.test.ts

Fixture: `{ api }` is not used; Steps sessions (no browser)

#### Scenario 1: BK-2171 second archive
Test: "BK-2171: should answer 204 to a second archive and keep the first archive time and actor with no second event given an already archived Test"
Preconditions: arena Test archived by the Member through `seedInState({ state: 'archived' })`; its read is the first archive; the Admin session; the `test.archived` event ids of the Test (exactly one).
ATCs called: `admin.tests.archiveAgainKeepsFirstArchive({ testId, firstArchive })`.
Test-level assertions: `archived_by` of the seed equals the Member's `GET /me` id and the Admin's id differs; the `test.archived` event ids equal the ids read before.

#### Scenario 2: BK-2172 restore live
Test: "BK-2172: should answer 200 with changed false and write no event when restoring a live Test"
Preconditions: live Test from `seedInState({ state: 'live' })`; `test.restored` event ids.
ATCs called: `member.tests.restoreLiveTestChangesNothing({ testId, versionBefore })`.
Test-level assertions: no new `test.restored` event.

#### Scenario 3: BK-2153 nothing destroyed
Test: "BK-2153: should keep the Test row and every Run, step and plan membership unchanged across archive and restore"
Preconditions: `seedWithHistory({ chainLength: 2, tags, finishedRuns: 2, plans: 3 })`.
ATCs called: `member.tests.keepRecordsAcrossArchiveAndRestore({ testId })`.
Test-level assertions: seeded counts (2 steps, `run_count` 2, 3 plans, the tag) as preconditions; the restored Test keeps title, `run_count` and plan ids. The per-plan memberships (`id`, `added_at`, `added_by`) are compared inside the ATC; the 3 plans are closed in teardown.

### File: tests/integration/test-lifecycle/hideArchivedTestFromOffers.test.ts

Fixture: `{ test: kata }` with Member storage state (Tests list tag filter UI half).

#### Scenario 1: BK-2146 tag filter (outline, 2 rows)
Test: "BK-2146: should drop the archived Test from the tag filter and keep the others in the same order given <row.label>"
Preconditions: 3 siblings carrying a generated shared tag; one live Test without the tag; Test A carrying the shared tag and its own generated tag; baseline `listByTag` (ordered ids, all pages) for the row's tag; the baseline is asserted to be exactly Test A plus the siblings that carry the tag.
ATCs called: `member.tests.listTagFilterWithoutArchived({ row, tag, testId, baseline })` after `archiveTest`.
Test-level assertions: the project Tests list with the tag filter shows exactly the baseline rows, in the list's sort (equal to the API order), before the archive and exactly the remaining rows after it, with a live untagged Test seeded as negative control and absent in both; an empty expectation asserts `tests-list-no-match`; `tests-list-error` is never visible (`TestsListPage`). The UI half proves the filter ran, not that an archived id is dropped by the tag API (the list source excludes archived Tests).
Teardown: all Tests archived in `afterAll`; Test A is already archived.

### File: tests/integration/test-lifecycle/keepPastNumbersAfterArchive.test.ts

Fixture: BK-2178 uses no fixture (API through `member.api` of the Member session opened in `beforeAll`); BK-2179 uses `{ test: kata }` (hybrid fixture; only `kata.ui` used, API setup through the Steps session `member.api`) with Member storage state.

#### Scenario 1: BK-2178 run reads unchanged
Test: "BK-2178: should keep the runs report, the workspace runs index and the run comparison identical after archiving a Test given a Test with finished Runs"
Preconditions: arena workspace and project; a module of its own (`seedIsolatedModule`); Test with 2 finished Runs in it; `RunsApi.captureRunReads` baseline (every page, limit 50 plus cursor) with the report scoped by `module_id`; the baseline is asserted to list exactly the 2 Runs of the Test, `compared` state, `totals.passed` 2 and `report.scope.has_runs` true (the scope is project-wide, so it is a precondition only and is not in the after-archive equality).
ATCs called: `member.api.runs.holdRunReadsAfterArchive({ baseline, scope })` after `member.api.tests.archiveTest`.
ATC assertions: the module report, the workspace index rows of the Test and the comparison equal their baselines; the workspace run count has not dropped below its baseline (inside `holdRunReadsAfterArchive`, `RunsApi.ts`). The per-Test row equality (report plus workspace runs index) carries the run-integrity claim; `workspace_run_count >= baseline` is only a floor on shared workspace state (other sessions add Runs).
Test-level assertions: preconditions only (the baseline lists exactly the 2 Runs of the Test, `totals.passed` 2, `has_runs` true, `compared` state) and the archive stimulus.
Teardown: the shared teardown archives the Test and the module (no `restoreTest`).

#### Scenario 2: BK-2179 plan figures unchanged
Test: "BK-2179: should keep open plan progress, milestone readiness and a closed plan snapshot identical after archiving a Test given a Test held by open and closed plans"
Preconditions: a Test and a never-run Test (no tags); open plan holding both, attached to a milestone; the closed plan holding both is closed BEFORE the passed Run finishes (frozen 0 percent, 0 of 2), then the Test gets one finished passed Run (open plan live 50 percent, 1 of 2, chips Passed 1 and Not run 1); `PlanFiguresPage.readFigures` baseline; the frozen figures are asserted to differ from the live ones so a live recompute could not pass.
ATCs called: `kata.ui.planFigures.expectFiguresUnchangedAfterArchive({ baseline, scope })` after `archiveTest`.
Test-level assertions: `PlansApi.listPlanMemberships` of both plans lists the same memberships (`id`, `added_at`, `added_by`) before and after (no membership row added or removed).
Teardown: the shared teardown closes the open plan, archives the milestone and the Tests (no `restoreTest`).

### PR1 deviations (BK-2156 and BK-2167)

- One ATC per TC id (the `kata:manifest:check` rule): `refuseBlankTitle(target, title)` owns BK-2156 and `applyTitleLengthBoundaries(target, row, title)` owns BK-2167. `target` is a rename-or-create discriminated input; the BK-2167 expectations come from the literal TC28 row table `TITLE_LENGTH_ROWS` in `tests/data/constants.ts`, never from a caller-chosen status.
- Only a test that needs a rename target or the UI page seeds its own Test (per-test seeding on demand); the create rows seed nothing. So there is no end-of-run title restore; created Tests are archived in teardown, including any Test a create produced even when the ATC threw: the create target's `onCreated` callback records the id from the 2xx response before any assertion runs.
- "No Test created" on a refused create is proven by the 422 plus no new `test.created` activity event in the arena, comparing the set of event ids before and after the call with no title filter. A title filter on the attempted raw title could never fail, because the server trims the title, so a wrongly created Test would carry the trimmed title and never match; the unfiltered comparison is safe because writes are serial and the arena is dedicated. `listTestEvents` has no title filter; it filters by action and optional Test id only. An accepted create is also read back by id and its stored title length is asserted against the row count. This replaces `searchTests`, because a blank title is not searchable.
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

### PR2 deviations (BK-2161, BK-2163, BK-2164, BK-2165)

- One ATC per TC id, parameterized by a literal row table in `tests/data/constants.ts` (`FROZEN_WRITE_ROWS`, `VIEWER_WRITE_ROWS`, `NON_MEMBER_ROWS`); each ATC asserts `row.expected*` and the row's discriminant only chooses the request. The error code of the archived guard and of the version conflict is `conflict` (the envelope code), with the `test_archived` and `version_conflict` reasons.
- The BK-2161 chain of 2 is one scaffold ATC chained twice (a chain may repeat an ATC), so `seedTest` gained an optional `chainLength`. The reorder row sends the reversed `step_ids`; the tag row sends a literal tag.
- The activity feed lists only the MVP event set: `test.renamed`, `test.archived` and `test.restored`. The reorder and tags endpoints emit only `test.reordered` and `test.tags_changed`, which the feed drops, so "no activity row" is not observable for those rows. The rename runs as its own test (`FROZEN_RENAME_ROW`, the only row with `watchedActions`) and keeps the event delta; the reorder and tags rows (`FROZEN_WRITE_ROWS`) carry no event check and prove "unchanged" with `version`, `updated_at`, title, chain and tags.
- BK-2164 search for the foreign project answers 200 with an empty `items` list (the plan's `toContain([200, 403, 404])` is tightened to 200). A positive control runs on the owner side: the member search finds the live Test and does not find the archived one, so an empty viewer list cannot come from a title that never matches.
- BK-2164 arena: `TestLifecycleSteps.openForeignArena` finds, never creates, the member-owned workspace and its project (`fixture broken` when absent), checks the viewer is not a member of it, and finds or completes the scaffold ATC as the member. Workspace name lives in `TEST_LIFECYCLE_FOREIGN_FIXTURE`.
- BK-2164 palette: the command palette calls `GET /api/v1/search?q=` (cross-entity, a different endpoint from `GET /v1/tests/search`). The product resolves the active workspace from the `bk_active_ws` cookie only when the caller can see that workspace and otherwise falls back to the caller's oldest workspace, so a forged cookie is ignored. The palette is scoped server-side to the caller's own workspaces, so a non-member cannot reach the foreign Test; it is not a membership check, and the 404 parity is the membership proof for both rows. The test asserts the viewer palette answers an empty list and the owner-side palette finds the live Test and not the archived one. Each `NON_MEMBER_ROWS` row declares `ownerFinds` (true for live, false for archived, where archived Tests are hidden from every search). The empty viewer search and palette assertions catch a search that ignores workspace scope or archive filtering; they do not prove membership. The owner session is scoped with the active-workspace cookie built by `activeWorkspaceCookie` (secure and domain derived from the request host). The palette UI rendering is not asserted (no stable test id). Open follow-up: assert the rendered palette with `/playwright-cli` discovery.
- BK-2161 UI half: its own test, run once (not per row): a member page on a live Test shows the edit controls, then `TestDetailPage.expectFrozen` asserts the banner, no rename control, no tag editor open button and no drag handle, anchored on the product test id prefix `test-reorder-handle-`. BK-2163 UI half runs in one viewer browser context per file, opened with the project `use` options by `TestLifecycleSteps.openRoleTestDetail` and closed in `release`; `expectNoWriteControls(state)` asserts only the controls the state could offer.
- Event deltas: `ActivityApi.snapshotTestEvents` and `listNewTestEvents` replace the inline snapshots of `guardTestWrites.test.ts` and `refuseInvalidTestTitle.test.ts` (`listTestEvents` is removed), so one implementation serves both specs.
- Positive controls (LT-1): a member page on a live Test must show the rename control, the tag editor and the drag handle before the archived Test is asserted frozen (BK-2161), and the rename and archive controls (live row) or the restore control (archived row) before the viewer page is asserted free of them (BK-2163). `TestDetailPage.goto` and `open` share one private navigation; they differ only in the ready condition.
- BK-2163 and BK-2164 carry `@critical` to match their TC tags.
- Tests are archived by the shared teardown, so the "restore at the end" step of BK-2161, BK-2163 and BK-2164 is dropped: each test seeds its own Test and the end state is archived. `TestSeedSteps.seedInState({ state, chainLength, tags })` prepares live or archived Tests so specs carry no setup branch; `seedTest` and `seedInState` return the full Test they read, which specs use as `before`. The BK-2165 tag reset is dropped because the teardown archives the Test.
- Role sessions are cached per role inside `TestLifecycleSteps`, so one storage-state context serves every caller of a role; a workspace-scoped session reads the role storage state from disk in memory. The viewer browser page applies the project `actionTimeout` and `navigationTimeout`. `activeWorkspaceCookie` takes the cookie name from its caller.
- BK-2163 asserts status 403 and code `forbidden` only; `details.reason` is not asserted because `not_a_member` for a real viewer is open defect BK-2091.
- `searchPalette` lives in the `SearchApi` component (`api.search`), not in `TestsApi`.
- BK-2163 viewer page: it comes from a hand-made browser context, so the Playwright trace, video and screenshot settings do not apply to it and a viewer failure leaves no viewer-side artifacts.

### PR3 deviations (BK-2171, BK-2172, BK-2153, BK-2146)

- Signatures: BK-2146 takes `{ row, tag, testId, baseline }` (row from the literal `TAG_FILTER_ROWS`, `baseline` the ordered id list) and no longer archives inside the ATC; the archive is the test's stimulus, like BK-2178 and BK-2179. The list endpoint has no `total`, so the total is the id count over all pages (`listByTag`, limit 50 plus `next_cursor`), and "drops by one" is `after = baseline minus the Test`, which also pins the order.
- BK-2171 and BK-2172 keep the plan's signatures. `FirstArchive` is exported from `TestsApi.ts`. Activity events for archive and restore are in the feed allowlist (`test.archived`, `test.restored`), so "no second event" and "no `test.restored` event" are asserted as observable deltas, unlike the reorder and tags events of PR2. The TC's closing restore of BK-2171 is dropped: the Test is generated and the shared teardown archives it again (idempotent).
- BK-2153: the ATC owns the baseline and both reads. The plan-membership read is a private `TestsApi` method (`GET /test-plans/{id}/tests`) and the ATC compares each plan's memberships as `{ id, added_at, added_by }` (the member `id` is the Test id, so the timestamp and actor are what catch a deleted and re-inserted membership), so `PlansApi.listPlanTests` was not built. Tags are sorted before the comparison; step ids stay in chain order. The Run read is the finished-Run history (all pages); the seeded Test has no running Run. Version is not captured and not compared (the TC Given and Variables name version, but no validation step compares it).
- New supporting code used by BK-2153: `PlansApi` (`createPlan`, `addTests`, `closePlan`, registered as `api.plans`), `RunsApi.startRun`, `markStep`, `finishRun`, `StructureApi.listEnvironments`, `createEnvironment` (arena environment `kata-bk596-env`, found or created by `TestSeedSteps`), `TestSeedSteps.seedWithHistory`, `TestsApi.restoreTest`, `listByTag`, `listRunHistory`. Member can create environments and plans (member+). Environments have no archive route and stay in the arena project. Plans have no archive route or delete route either, but `TestSeedSteps.teardown` closes every plan it created (`PlansApi.closePlan({ planId, verdict, summary })`, `POST /test-plans/{id}/close`, 200, with the `PLAN_TEARDOWN` verdict and a summary that marks the closure as fixture teardown), so a BK-2153 run leaves 3 closed plans in staging history and no open one; `ActivityApi.snapshotTestEvents` with a `testId` now follows `next_cursor` (cap 20 pages) until events are older than the Test's `created_at`.
- BK-2146 UI half: a new `TestsListPage` (`testsList`) on the project Tests list, which hosts the same `test-tag-filter` as the workbench. `filterByTag` retries fill plus the product's lookup response (`GET /api/v1/tests?tag=`, debounced 250 ms) in a bounded `toPass`, because the input is server-rendered and a fill before hydration is lost. `expectFilteredRows({ ids })` asserts `tests-list-error` is not visible, then for ids waits for `tests-list-table` and polls until the visible `tests-list-row-{id}` set equals the API ids in order, and for an empty list asserts `tests-list-no-match`. While the lookup is pending the list shows a skeleton, not the unfiltered list. The UI half proves the filter ran (the untagged live Test, seeded as negative control, is absent on the shared row; `tests-list-no-match` on the empty row) and that rendered rows follow the list's sort, which matches the API order; it cannot observe an archived id leaking out of the tag API because the list source excludes archived Tests, so the API half is the proof that archived Tests are dropped. The UI order equality relies on the list default sort (`created desc`) matching the API order, so a sort change there would surface as a UI failure. The explorer Tests group has no stable locator and is not asserted. The `smoke` row is replaced by the generated solo tag (OQ4), so the second row ends with an empty list.
- New files `hideArchivedTestFromOffers.test.ts` and `repeatArchiveRestore.test.ts` carry `@critical` (BK-2146, BK-2153), `@high` (BK-2171) and `@medium` (BK-2172) to match their TC priorities.

### PR4 deviations (BK-2178, BK-2179)

- Signatures: both ATCs take `{ baseline, scope }` (`RunReadsScope`, `PlanFiguresScope` in `tests/data/types.ts`) instead of loose ids; the ids of one scenario travel together and stay within the two-positional-parameter rule. `restoreTest` in teardown is dropped for both (the shared teardown archives the Tests; a restore would be undone at once), like PR2 and PR3.
- BK-2178 isolation (lesson: shared reads): the project runs report totals are shared with every file of the arena, so the report is scoped with `module_id` to a module, story, criterion and ATC generated for the test (`TestSeedSteps.seedIsolatedModule`, archived by the teardown through the new `StructureApi.archiveModule`). A unique `branch` would have scoped it without a module, but a cookie session cannot send CI context (`ci_context_not_allowed`), so the Member cookie Runs cannot carry one. The workspace runs index has no Test or module filter: it is read per `project_id`, every page, and only the rows of the Test are compared; `workspace_run_count` is workspace-wide, so it is asserted inside the ATC as a floor (after is not below the baseline), not compared for equality; the per-Test row equality carries the run-integrity claim and the floor only guards shared workspace state. Paging stops once a page's oldest `started_at` is earlier than the Test `created_at` (the index is keyset-ordered `started_at desc`, product `app/api/v1/workspaces/[id]/runs/route.ts`), mirroring `ActivityApi.snapshotTestEvents`; the 40-page cap stays as a backstop with its named error. The isolated module, story, criterion and ATC are named `Kata isolated <id>` (`DataFactory.createIsolatedName`) so they never share the `Kata scaffold` stem the arena scaffold search matches. `report.scope` (`has_runs`, `has_automated`) is project-wide, so it is a precondition (`has_runs` true) and not part of the after-archive equality. The seed helpers `seedWithHistory` and `finishPassedRun` are unchanged; the isolated arena is passed as the `arena` argument (`{ ...arena, atcId }`).
- BK-2178 preconditions in the test make each equality able to fail: the module report lists exactly the Test Run ids, the workspace rows of the Test are exactly those ids, `totals.passed` is 2 and the comparison state is `compared`.
- BK-2179 data: a second Test, never run, joins the passed Test in both plans, so the open plan reads 50 percent, 1 of 2 (chips Passed 1, Not run 1), and an archive that dropped the member would move percent and count. The closed plan is closed before the passed Run finishes (`TestSeedSteps.seedPlanFigures`), so its frozen snapshot reads 0 percent, 0 of 2 while the live recompute would read 50 percent, 1 of 2; the test asserts both literals, so the after-archive equality proves the page keeps the frozen snapshot (product `0095_plan_close.sql` stores `bunkai_plan_progress` at close time; the plan page renders `progress_snapshot` for a closed plan). The Tests are seeded without tags (the tag write was unused). The plan page, the milestone page and the closed plan page are read through two routes with different rendering: the plan page streams behind a Suspense skeleton (`test-plan-detail-skeleton`), the milestone page renders server-side without Suspense. Navigation waits on `commit` and the visibility wait (30 s) on the content testid (`test-plan-progress`, `milestone-readiness`, never the skeleton) gates every read and rejects the empty and unavailable states; the test is marked slow (`test.slow()`) because it performs 6 navigations. Figures are read as `textContent` (the passed label is upper-cased by CSS).
- BK-2179 milestone: the product accepts open plans only, so the closed plan is outside the milestone; the milestone pools the open plan. `PlansApi` gained `createMilestone`, `attachPlans`, `archiveMilestone` and `listPlanMemberships` (sorted `{ id, added_at, added_by }`, used by the spec instead of a spec-local reader; `TestsApi` keeps its private reader of the same endpoint because the KATA layer rule `kata/layer-imports` forbids a domain component importing another, and moving it into `ApiBase` would put plan knowledge in the base). Milestone and plan teardown: the open plan is closed (`PLAN_TEARDOWN`), the milestone archived; the closed plan is removed from the teardown list once its close succeeds (a second close would be refused). `PLAN_FIGURES_CLOSE` holds the verdict and summary of the closed plan.
- Gap kept visible: the closed plan `progress_snapshot` "byte-identical" check has no DB or API path; the frozen figures rendered by the closed plan page stand in for it (spec.md OQ1).
- Residue per run in staging: BK-2178 leaves 1 archived module with its story, criterion and ATC and 2 finished Runs of an archived Test; BK-2179 leaves 2 closed plans, 1 archived milestone and 2 archived Tests (one with a finished Run).
- Both tests carry `@critical` and `@regression` to match the TC priority.

### PR5a deviations (BK-2140, BK-2144, BK-2158)

- Owner decisions applied: one `GET /v1/search` assertion covers workspace search and the command palette (the product has one endpoint behind both); the PR is split, so BK-2152 (`restoreFromBanner`, `OfferSurfaceSteps`, `SearchApi.searchChatEntities`, `AtcsApi.readAtcUsage`) lands in PR5b and is not in this slice.
- `TestDetailPage` already existed (PR2), so it is extended, not created. `navigate` now goes to `waitUntil: 'commit'` and the merged BK-2156 `expectBlankRenameBlocked` now opens the rename form through `openByClick` (two small merged-code changes); `goto` and `open` keep their content waits (`test-detail-rename`, `test-tabs`) with a 30 s timeout because commit returns before the page renders.
- Explorer and Tests list are UI checks (`explorer-test-<id>`, `tests-list-open-<id>`), not `OfferSurfaceSteps.expectTitleOnSurfaces`: `TestDetailPage.expectTitleInExplorer` and `TestsListPage.expectRowTitle`. Workspace search is an API check (`SearchApi.searchPalette`); lost: the rendered palette dropdown.
- Palette reads use a workspace-scoped session: `GET /v1/search` resolves the workspace from the `bk_active_ws` cookie, so `TestLifecycleSteps.openScopedSession({ role, workspaceId })` wraps the existing private `openRole`.
- Chain order in BK-2140 is proved by `step_id` and `position` (the seed repeats one scaffold ATC, so `atc_id` order cannot tell steps apart); `atc_id`s are compared as well.
- `ActivityApi.listNewTestActivity` returns the new items (not only ids) so the spec can check the `test.renamed` and `test.archived` payloads; `snapshotTestEvents` and `listNewTestEvents` are thin wrappers over a private collector (same 20-page cap, no behaviour change).
- The Test page is server-rendered, so a first click made before hydration is lost. `TestDetailPage.openByClick` retries the click (2 s click timeout, 2 s visibility probe on the opened element, 30 s `toPass` cap) and clicks only while the opened element is not visible. It opens the rename form and the archive dialog in `renameFromHeader`, `archiveFromTestPage` and the merged BK-2156 `expectBlankRenameBlocked`.
- The TC's final "restore so the fixture is live again" step (BK-2158) is dropped because each test seeds its own Test; the Test ends archived and is left as residue.
- `renameFromHeader` asserts the PATCH method (the intercept helper matches the URL only) and reads the header through `test-detail-title`. `archiveFromTestPage` asserts `/reversible/i` and the Run count as a whole number with the kept-and-readable meaning, the DELETE method, the sonner toast through `[data-sonner-toast]` (passed on one staging run (2026-11-28); if it flakes, drop only that assertion), and the archived badge. `TestsApi.renameTest` was not added: nothing in PR5a needs it (BK-2152 does).
- BK-2158 stays in the E2E file and adds a live-Test positive control (`expectStartRunOffered`) before the archive, so the absence check cannot pass on a page that never offers the button. `TestSeedSteps.ensureEnvironment` is public. `since` for the runs read is the Test creation time. `test.slow()` on BK-2140 and BK-2158 (several navigations) and on BK-2144 (2 seeded Runs plus page waits).
- Residue per run in staging: 3 archived Tests (BK-2144 with 2 finished Runs); environment `kata-bk596-env` reused.
