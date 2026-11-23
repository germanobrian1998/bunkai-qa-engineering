# ATC Spec: BK-2147 - Read a past Run of an archived Test in full

> Ticket: BK-2147 (TC8)
> Component: RunDetailPage (tests/components/ui/RunDetailPage.ts), NEW
> Type: UI - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should render every step of a past Run and list all Runs in the Run history given an archived Test | Archive never blanks Run evidence | Archived Test with 2 finished Runs, the second with a failed step | AC-04 #1, #2 |

## 2. ATC Contract
```typescript
@atc('BK-2147')
async readPastRunInFull(args: { runId: string, atcs: ExpectedRunAtc[] }): Promise<void> {
  await this.goto({ runId: args.runId });
  for (const atc of args.atcs) {
    await expect(this.page.getByText(atc.title)).toBeVisible();
    for (const step of atc.steps) {
      const row = this.page.getByRole('listitem').filter({ hasText: step.content });
      await expect(row).toBeVisible();
      await expect(row).toContainText(step.status, { ignoreCase: true });
    }
  }
}
```
`ExpectedRunAtc` is `{ title: string, steps: { content: string, status: 'passed' | 'failed' }[] }` in `tests/data/types.ts`.

## 3B. UI Details
Run detail route and step-row structure are not in the TC (no step `data-testid`): locate by role and text, record the route at Code time with `/playwright-cli`. No intercept.

## 4. Assertions Split
### Fixed (inside ATC)
Every chained ATC, every step content and its recorded status render for the Run.
### Test-level (in test file)
Called once per Run (second Run expects the failed step); `TestsApi.listRunHistory` lists both Runs; `TestDetailPage.readRunHistoryRows` (tab `test-tab-runs`) lists both; archive state confirmed by `getTest`.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-04 #1, #2 | EP (single partition) | 1 |

Reduction: none. The loop over two Runs is a test-level repetition, not an EP split.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 2, finishedRuns: 2, failedStepInRun: 2 })`, `TestsApi.archiveTest`
- Components: RunDetailPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| 2 finished Runs, one failed step | Generate | `POST /runs`, mark one step `failed`, finish `failed` | test | Test ends archived |

## 9. Checklist
- [ ] readPastRunInFull naming
- [ ] One object param
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (RunsReportPage BK-1963, BK-1967, BK-1992 cover the report, not Run detail)
