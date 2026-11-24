# ATC Spec: BK-2144 - Archive a Test after a confirmation

> Ticket: BK-2144 (TC5)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), NEW
> Type: UI - Mutation
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should archive after a confirmation naming the Test, its reversibility and its Run count, then show the restore hint | Archive is guarded by an informative dialog and leaves a restore path | Live Test with 2 finished Runs; the member can change it | AC-02 2.1 |

## 2. ATC Contract
```typescript
@atc('BK-2144')
async archiveFromTestPage(args: { title: string, runCount: number }): Promise<void> {
  await this.page.getByTestId('test-detail-archive').click();
  const dialog = this.page.getByTestId('archive-test-dialog');
  await expect(dialog).toContainText(args.title);
  await expect(dialog).toContainText(/reversible|restore/i);
  await expect(this.page.getByTestId('archive-test-runs')).toContainText(String(args.runCount));
  const archive = await this.interceptResponse({
    urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+$/,
    action: async () => this.page.getByTestId('archive-test-confirm').click(),
  });
  expect(archive.status).toBe(204);
  await expect(this.page.getByTestId('test-archived-banner')).toBeVisible();
  await expect(this.page.getByTestId('test-detail-restore')).toBeVisible();
}
```

## 3B. UI Details
Dialog ids `archive-test-dialog`, `archive-test-runs`, `archive-test-confirm`; banner `test-archived-banner`, restore `test-detail-restore`. The copy is asserted by meaning (title, reversibility, count, kept and readable), not by the literal sentence (TC refinement note). Toast text read by role `status`/`alert` once its wording is confirmed at Code time.

## 4. Assertions Split
### Fixed (inside ATC)
Dialog names the Test, states reversibility and the finished-Run count; DELETE answers 204; banner offers Restore.
### Test-level (in test file)
`getTest`: `archived_at` set and `archived_by` equals the Member id from `GET /me`; exactly one new `test.archived` event; toast explains restore.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-02 2.1 | EP (single partition: live Test with finished Runs) | 1 |

BVA: N/A (the zero-Run state is TC31, Deferred). Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 2, finishedRuns: 2 })`
- Components: TestDetailPage NEW, ActivityApi `listNewTestEvents` NEW helper

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Test with 2 finished Runs | Generate (real path: start, mark, finish) | `POST /runs`, `/steps/{id}/mark`, `/finish` | test | none needed, the Test ends archived |

## 9. Checklist
- [ ] archiveFromTestPage naming
- [ ] One object param
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
