# ATC Spec: BK-2152 - Restore a Test from the archived banner

> Ticket: BK-2152 (TC13)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), NEW
> Type: UI - Mutation
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should return a restored Test to every offer surface and allow Run start, rename, reorder and tags again | Restore reverses archive completely | Test archived by the member | AC-07 7.1 |

## 2. ATC Contract
```typescript
@atc('BK-2152')
async restoreFromBanner(): Promise<void> {
  const restore = await this.interceptResponse<unknown, RestoreTestBody>({
    urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+\/restore$/,
    action: async () => this.page.getByTestId('test-detail-restore').click(),
  });
  expect(restore.status).toBe(200);
  expect(restore.responseBody?.test.changed).toBe(true);
  expect(restore.responseBody?.test.archived_at).toBeNull();
  await expect(this.page.getByTestId('test-archived-banner')).toBeHidden();
  await expect(this.page.getByTestId('start-run-button')).toBeVisible();
  await expect(this.page.getByTestId('test-detail-rename')).toBeVisible();
  await expect(this.page.getByTestId('test-tag-editor-open')).toBeVisible();
}
```
The restore answer carries `changed` inside `test` (rename carries it beside `test`).

## 3B. UI Details
Ids `test-detail-restore`, `test-archived-banner`, `start-run-button`, `test-detail-rename`, `test-tag-editor-open`. Reorder control (`test-reorder-bar`) asserted when it exists for a 2-ATC chain.

## 4. Assertions Split
### Fixed (inside ATC)
Restore answers 200, `test.changed` true, `archived_at` null; banner gone; Start Run, rename, tag editor offered.
### Test-level (in test file)
`OfferSurfaceSteps.readOffers` shows the Test back on workspace search, tag filter, `GET /tests/search` (plan picker), chat picker and ATC "used in"; Tests list and explorer through UI locators; a rename to a new title answers 200 `changed` true, then back (`TestsApi.renameTest`).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-07 7.1 | State Transition (archived to live) | 1 |

Reduction: none. Restoring a live Test is BK-2172.

## 7. Dependencies
- `TestSeedSteps.seedTest` (unique tag, one plan), `TestsApi.archiveTest`, `OfferSurfaceSteps`
- Components: TestDetailPage NEW, SearchApi NEW, AtcsApi `readAtcUsage`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Archived Test with tag and plan | Generate then archive | API | test | rename back, archive in `afterAll` |

## 9. Checklist
- [ ] restoreFromBanner naming
- [ ] No params
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
