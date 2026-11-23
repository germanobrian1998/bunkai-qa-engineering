# ATC Spec: BK-2187 - Archive dialog counts finished Runs only

> Ticket: BK-2187 (TC48, regression of BK-2241)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), NEW
> Type: UI - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should count finished Runs only in the archive dialog, matching the Run history, given a Run still running | The dialog count equals `run_count` and the Run history | Test C with one running Run and no finished Run, or Test A with finished Runs only | Divergence 3 (BK-2241) |

## 2. ATC Contract
```typescript
@atc('BK-2187')
async readRunCountInArchiveDialog(args: { expectedRuns: number }): Promise<void> {
  await this.page.getByTestId('test-detail-archive').click();
  const runs = this.page.getByTestId('archive-test-runs');
  if (args.expectedRuns === 0) {
    await expect(runs).toContainText('No Run has been recorded against this Test');
  }
  else {
    await expect(runs).toContainText(String(args.expectedRuns));
  }
  await this.page.getByTestId('archive-test-cancel').click();
  await expect(this.page.getByTestId('archive-test-dialog')).toBeHidden();
  await expect(this.page.getByTestId('test-archived-banner')).toBeHidden();
}
```

## 3B. UI Details
Ids `test-detail-archive`, `archive-test-dialog`, `archive-test-runs`, `archive-test-cancel`. The zero-Run copy is the product's own sentence (recorded in the TC refinement note).

## 4. Assertions Split
### Fixed (inside ATC)
Dialog count (or the no-Run sentence) matches `expectedRuns`; cancel closes the dialog and leaves no archived banner.
### Test-level (in test file)
`getTest.run_count` and the `listRunHistory` total equal `expectedRuns`; the Test is still live (`archived_at` null).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| Divergence 3 | EP on Run mix | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| readRunCountInArchiveDialog | none | 2 (running only: 0; finished only: 2) |

## 7. Dependencies
- `TestSeedSteps.seedTest({ runningRuns: 1 })` and `seedTest({ finishedRuns: 2 })`
- Components: TestDetailPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Running Run, never finished | Generate | `POST /runs` and stop | test | Test archived in `afterAll` (a running Run may be aborted first through `POST /runs/{id}/abort`) |

## 9. Checklist
- [ ] readRunCountInArchiveDialog naming
- [ ] One object param
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
