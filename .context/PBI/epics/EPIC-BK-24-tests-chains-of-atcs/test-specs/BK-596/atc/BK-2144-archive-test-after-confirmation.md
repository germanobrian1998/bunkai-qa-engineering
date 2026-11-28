# ATC Spec: BK-2144 - Archive a Test after a confirmation

> Ticket: BK-2144 (TC5)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), EXISTING (PR2), extended
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
  const dialog = this.page.getByTestId('archive-test-dialog');
  await this.openByClick({ trigger: this.page.getByTestId('test-detail-archive'), opened: dialog });
  await expect(dialog).toContainText(args.title);
  await expect(dialog).toContainText(/reversible/i);
  await expect(this.page.getByTestId('archive-test-runs')).toHaveText(new RegExp(`^${args.runCount} Runs? ha(s|ve) been recorded\\..*\\bkept\\b.*\\breadable\\b`));
  const { method, status } = await this.interceptResponse({
    urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+$/,
    action: async () => this.page.getByTestId('archive-test-confirm').click(),
  });
  expect(method).toBe('DELETE');
  expect(status).toBe(204);
  await expect(this.page.locator('[data-sonner-toast]').filter({ hasText: args.title })).toContainText(/restore/i);
  await expect(this.page.getByTestId('test-archived-banner')).toBeVisible();
  await expect(this.page.getByTestId('test-archived-badge')).toBeVisible();
  await expect(this.page.getByTestId('test-detail-restore')).toBeVisible();
}
```

## 3B. UI Details
The dialog is opened through `openByClick` (retried click until the dialog is visible; the server-rendered page can lose a click made before hydration). Testids are used inline; some repeat within the component and are not yet extracted (follow-up). Dialog ids `archive-test-dialog`, `archive-test-runs`, `archive-test-confirm`; banner `test-archived-banner`, restore `test-detail-restore`. The copy is asserted by meaning (title, reversibility, count, kept and readable), not by the literal sentence (TC refinement note). The toast (sonner) has no role or testid, so it is read through `[data-sonner-toast]` filtered by the Test title; it passed on one staging run (2026-11-28); if it flakes, drop only that assertion. The reversibility check is `/reversible/i` (`/reversible|restore/i` would also match unrelated copy) and the Run count is matched as a whole number with the kept-and-readable meaning (a bare digit would match `12`).

## 4. Assertions Split
### Fixed (inside ATC)
Dialog names the Test, states reversibility and the finished-Run count with kept-and-readable meaning; DELETE method and 204; toast explains restore; archived banner and badge shown; banner offers Restore.
### Test-level (in test file)
`getTest`: `archived_at` set and `archived_by` equals the Member id from `GET /me`; exactly one new `test.archived` event whose `payload.title` is the Test title; the run history (`TestsApi.listRunHistory`) still lists the 2 Runs. Precondition: `run_count` is 2.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-02 2.1 | EP (single partition: live Test with finished Runs) | 1 |

BVA: N/A (the zero-Run state is TC31, Deferred). Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedWithHistory({ chainLength: 2, tags: [], finishedRuns: 2, plans: 0 })`
- Components: TestDetailPage (extended), ActivityApi `listNewTestActivity` NEW helper, TestsApi `listRunHistory`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Test with 2 finished Runs | Generate (real path: start, mark, finish) | `POST /runs`, `/steps/{id}/mark`, `/finish` | test | none needed, the Test ends archived; the TC's final restore step is dropped because each test seeds its own Test |

## 9. Checklist
- [ ] archiveFromTestPage naming
- [ ] One object param
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
