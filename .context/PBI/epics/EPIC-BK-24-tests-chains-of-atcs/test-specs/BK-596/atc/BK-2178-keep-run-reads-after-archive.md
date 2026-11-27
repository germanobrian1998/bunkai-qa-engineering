# ATC Spec: BK-2178 - Run reports do not move after an archive

> Ticket: BK-2178 (TC39)
> Component: RunsApi (tests/components/api/RunsApi.ts), EXISTING manifest entry, extended
> Type: API - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should keep the runs report, the workspace runs index and the run comparison identical after archiving a Test given a Test with finished Runs | No number describing the past moves because of an archive | Live Test with finished Runs; baselines of the three reads, every page | AC-04 4.3 |

## 2. ATC Contract
```typescript
@atc('BK-2178')
async holdRunReadsAfterArchive(args: { baseline: RunReadsBaseline, scope: RunReadsScope }): Promise<[APIResponse, RunReadsBaseline]> {
  const { baseline, scope } = args;
  const after = await this.captureRunReads(scope);
  expect(after.report.totals).toEqual(baseline.report.totals);
  expect(after.report.items).toEqual(baseline.report.items);
  expect(after.workspaceRuns).toEqual(baseline.workspaceRuns);
  expect(after.compare).toEqual(baseline.compare);
  expect(after.workspaceRunCount).toBeGreaterThanOrEqual(baseline.workspaceRunCount);
  const [response] = await this.apiGET<RunResponse>(`/v1/runs/${scope.runId}`);
  expect(response.status()).toBe(200);
  return [response, after];
}
```
`RunReadsScope` is `{ workspaceId, projectId, moduleId, testId, testCreatedAt, runId }`. `captureRunReads(scope)` is the public `@step` helper that reads every page (`limit` 50 plus `next_cursor`, 40-page cap with a named error) of `GET /v1/projects/{id}/runs/report?module_id=` (`readModuleReport`) and `GET /v1/workspaces/{id}/runs?project_id=` (`readWorkspaceRuns`, rows of the Test only, stopping once a page's oldest `started_at` is earlier than `testCreatedAt`, with the cap as a backstop), plus `GET /v1/runs/{id}/compare` (`readCompare`); it is also how the baseline is taken before the archive. `RunReadsBaseline` is `{ report: { totals, scope, items }, workspaceRuns, workspaceRunCount, compare }`.

## 3A. API Details
`GET /projects/{id}/runs/report`, `GET /workspaces/{id}/runs`, `GET /runs/{id}/compare`, `GET /runs/{id}`; totals are recomputed over the whole filtered set, so every page is read. The archive stimulus is `TestsApi.archiveTest` called by the test between baseline and ATC (the ATC owns the observable outcome, the archive is the shared stimulus of eight TCs).

## 4. Assertions Split
### Fixed (inside ATC)
The module-scoped report (totals and every row; not the project-wide scope flags), the workspace index rows of the Test and the comparison of the latest Run equal their baselines; the workspace run count has not dropped below its baseline; the Run still resolves with 200.
### Test-level (in test file)
Preconditions that keep the equality from being empty: the report lists exactly the 2 Run ids of the Test history (so the module scope isolates the data), `totals.passed` is 2, the workspace index rows of the Test are exactly those 2 Run ids, `report.scope.has_runs` is true (the scope is project-wide, so it is asserted only here), and the comparison state is `compared` (the latest Run has a previous Run). The archive (204) is the stimulus.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-04 4.3 | EP (single partition: Test with finished Runs) | 1 |

Reduction: none. Isolation: the report is scoped by `module_id` to a module generated for this test, so its totals and rows can only move because of this test (the project and the workspace are shared with other files and sessions). The workspace runs index has no module or Test filter, so it is read with `project_id` and every page, and only the rows of the Test are compared; paging stops at the Test creation time (the index is keyset-ordered `started_at desc`); `workspace_run_count` is workspace-wide shared state, so it is asserted as a floor (runs never decrease), not compared for equality.

## 7. Dependencies
- `TestSeedSteps.seedIsolatedModule` (module, story, criterion and ATC generated for the test, named `Kata isolated <id>`), `TestSeedSteps.seedWithHistory({ chainLength: 1, tags, finishedRuns: 2, plans: 0 })`, `TestsApi.listRunHistory`, `TestsApi.archiveTest`
- Components: RunsApi (extended: `getReport` is reused for the report pages), TestsApi, StructureApi (`archiveModule`), AtcsApi

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Module, story, criterion and ATC of its own (`Kata isolated <id>` names, apart from the `Kata scaffold` arena stem) | Generate | `POST /projects/{id}/modules`, `/modules/{id}/user-stories`, `/user-stories/{id}/acceptance-criteria`, `POST /atcs` | test | the module is archived by the shared teardown (`DELETE /modules/{id}`, cascade to its ATC), after the Test; residue: the archived module, story and criterion remain in the arena project |
| Test with 2 finished Runs in that module | Generate | `POST /runs`, mark, finish | test | Test archived by the stimulus and again (idempotent) by the shared teardown; the Runs remain as history |

## 9. Checklist
- [ ] holdRunReadsAfterArchive naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature: `{ baseline, scope }` instead of the planned flat args, because the module, Test and Run ids travel together (`RunReadsScope` in `tests/data/types.ts`). `restoreTest` in teardown is dropped: the shared teardown archives the Test (idempotent), so a restore would be undone at once.
- Isolation, decided at Code time: a cookie session cannot send CI context (`branch`) when starting a Run (`ci_context_not_allowed`), so a unique branch could not scope the report. The report is scoped with `module_id` instead, which needs a module generated per test (`TestSeedSteps.seedIsolatedModule`). Without it the project report totals would be shared with every other file of the arena and could move for reasons that have nothing to do with the archive.
- Workspace index: no Test or module filter exists, so it is read with `project_id`, paging until a page's oldest `started_at` is earlier than the Test `created_at` (mirrors `ActivityApi.snapshotTestEvents`; the page cap is only a backstop), and only the rows whose `test_id` is the Test are kept and compared. A change to other Tests rows is not asserted; `workspace_run_count` has a floor assertion (after is not below baseline) because other sessions add Runs; a change to the rows of this Test (a row dropped, a count or status moved) fails.
- `report.scope` is project-wide (`has_runs`, `has_automated`), so it leaves the after-archive equality and is asserted only as a precondition (`has_runs` true).
- Preconditions asserted in the test (report ids equal the history ids, `scope.has_runs`, workspace rows equal the history ids, `totals.passed` 2, compare state `compared`) so none of the three equalities can hold only because a read came back empty.
- The TC line "Run-count integrity is also asserted against the runs table" has no DB client: the equality of the Test rows of the workspace index and of the report rows is its API proxy.
- Teardown: the Test is archived (the stimulus) and the module is archived by `TestSeedSteps.teardown`; no error from teardown replaces the test error.
