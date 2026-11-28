# ATC Spec: BK-2152 - Restore a Test from the archived banner

> Ticket: BK-2152 (TC13)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), EXISTING (PR2), extended
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
  const urlPattern = /\/api\/v1\/tests\/[0-9a-f-]+\/restore$/;
  let requested = false;
  const onRequest = (request: Request): void => {
    if (request.method() === 'POST' && urlPattern.test(request.url())) {
      requested = true;
    }
  };
  this.page.on('request', onRequest);
  try {
    const { method, status, responseBody } = await this.interceptResponse<unknown, RestoreTestResponse>({
      urlPattern,
      timeout: CONTENT_TIMEOUT_MS * 2,
      action: async () => {
        await expect(async () => {
          if (!requested) {
            await this.page.getByTestId('test-detail-restore').click({ timeout: 2_000 });
          }
          expect(requested, 'the Restore click reached the page handler').toBe(true);
        }).toPass({ timeout: CONTENT_TIMEOUT_MS });
      },
    });
    expect(method).toBe('POST');
    expect(status).toBe(200);
    expect(responseBody?.test.changed).toBe(true);
    expect(responseBody?.test.archived_at).toBeNull();
  }
  finally {
    this.page.off('request', onRequest);
  }
  await expect(this.page.getByTestId('test-archived-banner')).toBeHidden({ timeout: CONTENT_TIMEOUT_MS });
  await expect(this.page.getByTestId('start-run-button')).toBeVisible();
  await expect(this.page.getByTestId('test-detail-rename')).toBeVisible();
  await expect(this.page.getByTestId('test-tag-editor-open')).toBeVisible();
  await expect(this.page.getByTestId(REORDER_HANDLE)).not.toHaveCount(0);
}
```
The restore answer carries `changed` inside `test` (rename carries it beside `test`). The restore opens no confirmation, so the click is not wrapped in `openByClick`; the page is server-rendered and a click before hydration is lost, so the click repeats only while no restore request has been seen (the request listener is the stop condition, which keeps a slow response from triggering a second click).

## 3B. UI Details
Ids `test-detail-restore`, `test-archived-banner`, `start-run-button`, `test-detail-rename`, `test-tag-editor-open`, `test-reorder-handle-<position>` (matched by prefix; "reorder offered" means the drag handles, not `test-reorder-bar`, which is the unsaved-order bar shown only after a drag). The explorer row is `explorer-test-<id>` (`TestDetailPage.expectExplorerRowAbsent` before, `expectTitleInExplorer` after) and the Tests list reuses `TestsListPage.filterByTag` plus `expectFilteredRows`. `expectExplorerRowAbsent` first waits for a live Test of the same project to be listed (`explorer-test-<listedId>`), so the absence check cannot pass on an explorer that has not loaded. The Start Run button only renders when the project has an environment, so the spec calls `TestSeedSteps.ensureEnvironment` first.

## 4. Assertions Split
### Fixed (inside ATC)
Restore sends a POST and answers 200, `test.changed` true, `archived_at` null; banner gone; Start Run, rename, tag editor and the reorder handles offered (the positive controls sit beside "banner hidden" so it cannot pass on an error state).
### Test-level (in test file)
Before the restore: `OfferSurfaceSteps.readOffers` reports `{ palette, planPicker, tagFilter, chatPicker }` all false (workspace search and the command palette are one endpoint, `GET /v1/search`, read through a workspace-scoped member session), and the ATC usage of an isolated ATC reads `{ count: 0, archivedCount: 1, listed: false }`; the archived page `expectFrozen` and the explorer row absent. After the restore: `getTest` has `archived_at` null; `readOffers` reports all four surfaces true and the usage reads `{ count: 1, archivedCount: 0, listed: true }`; explorer row and Tests list row (tag filter, exactly this Test) through UI locators; `TestsApi.renameTest` to a new title answers 200 `changed` true, then back, and the final `getTest` title is the original. The chat picker (`GET /v1/workspaces/{id}/chat/entities/search`) has no OpenAPI contract, so `SearchApi.searchChatEntities` types only `{ items: [{ id, type }] }` and throws on any other shape.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-07 7.1 | State Transition (archived to live) | 1 |

Reduction: none. Restoring a live Test is BK-2172.

## 7. Dependencies
- `TestSeedSteps.seedIsolatedModule` (own ATC, so its usage count is exactly 0 then 1), `seedInState({ state: 'archived', chainLength: 2, tags })`, `ensureEnvironment`, `TestLifecycleSteps.openScopedSession`, `OfferSurfaceSteps.readOffers`
- Components: TestDetailPage (extended), SearchApi `searchChatEntities`, AtcsApi `readAtcUsage`, TestsApi `renameTest`, TestsListPage

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Archived Test with a unique tag and a 2-step chain of an isolated ATC, plus one live Test of the shared ATC as the explorer control | Generate then archive | API | test | the Test is renamed back by the test, archived with the isolated module and the control Test in `afterAll` |

## 9. Checklist
- [ ] restoreFromBanner naming
- [ ] No params
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
