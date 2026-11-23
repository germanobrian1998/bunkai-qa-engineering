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
async holdRunReadsAfterArchive(args: { baseline: RunReadsBaseline, projectId: string, workspaceId: string, runId: string }): Promise<[APIResponse, RunReadsBaseline]> {
  const after = await this.captureRunReads(args);
  expect(after.report).toEqual(args.baseline.report);
  expect(after.workspaceIndex).toEqual(args.baseline.workspaceIndex);
  expect(after.compare).toEqual(args.baseline.compare);
  const [response] = await this.apiGET(`/v1/runs/${args.runId}`);
  expect(response.status()).toBe(200);
  return [response, after];
}
```
`captureRunReads` is the public `@step` helper that reads every page (`limit` 50 plus `next_cursor`) of `GET /v1/projects/{id}/runs/report` and `GET /v1/workspaces/{id}/runs`, and `GET /v1/runs/{id}/compare`; it is also how the baseline is taken before the archive.

## 3A. API Details
`GET /projects/{id}/runs/report`, `GET /workspaces/{id}/runs`, `GET /runs/{id}/compare`; totals are recomputed over the whole filtered set, so every page is read. The archive stimulus is `TestsApi.archiveTest` called by the test between baseline and ATC (the ATC owns the observable outcome, the archive is the shared stimulus of eight TCs; flagged for review).

## 4. Assertions Split
### Fixed (inside ATC)
Report, workspace index and comparison equal their baselines (totals, counts, rates, rows); the Run still resolves.
### Test-level (in test file)
Archive 204 and `restoreTest` in teardown; the API proxy of "no row added to or removed from runs" is the equality of the workspace index rows.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-04 4.3 | EP (single partition: Test with finished Runs) | 1 |

Reduction: none. Isolation: the arena project lives in the Member-owned workspace so concurrent files cannot move the workspace index (OQ3).

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1, finishedRuns: 2 })`, `TestsApi.archiveTest`
- Components: RunsApi (reuse and extend: `getReport` is reused for report pages)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Finished Runs | Generate | `POST /runs`, mark, finish | test | `restoreTest`, archive in `afterAll` |

## 9. Checklist
- [ ] holdRunReadsAfterArchive naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
