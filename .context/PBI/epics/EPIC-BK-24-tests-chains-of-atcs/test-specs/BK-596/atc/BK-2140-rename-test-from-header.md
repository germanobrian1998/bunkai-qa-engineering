# ATC Spec: BK-2140 - Rename a Test from the Test page

> Ticket: BK-2140 (TC1, absorbs TC2 BK-2141)
> Component: TestDetailPage (tests/components/ui/TestDetailPage.ts), EXISTING (PR2), extended
> Type: UI - Mutation
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should show the new name on the Test header, Tests list, explorer and search and raise the version by one keeping chain, step ids and tags after a rename by a member | A rename is visible on every Test-level surface and changes nothing else | Live Test with chain ATC A then ATC B, tags, known version V; the member can change it | AC-01 1.1 |

## 2. ATC Contract
```typescript
@atc('BK-2140')
async renameFromHeader(args: { title: string }): Promise<void> {
  await this.page.getByTestId('test-detail-rename').click();
  await this.page.getByTestId('test-rename-input').fill(args.title);
  const { method, status, responseBody } = await this.interceptResponse<{ title: string }, RenameTestResponse>({
    urlPattern: /\/api\/v1\/tests\/[0-9a-f-]+$/,
    action: async () => this.page.getByTestId('test-rename-save').click(),
  });
  expect(method).toBe('PATCH');
  expect(status).toBe(200);
  expect(responseBody?.changed).toBe(true);
  expect(responseBody?.test.title).toBe(args.title);
  await expect(this.page.getByTestId('test-detail-title')).toHaveText(args.title);
}
```

## 3B. UI Details
Page: Test detail (`/projects/{slug}/tests/{testId}`), workspace set through the active-workspace cookie as `RunsReportPage` does. Entry `test-detail-rename`, form `test-rename-form`, input `test-rename-input`, save `test-rename-save`. Locators inline (one use). Response intercepted with `UiBase.interceptResponse` (it matches the URL only, so the ATC asserts the method). The header is read through `test-detail-title`, the testid of the header `<h1>`. `navigate` now goes to `waitUntil: 'commit'`; `goto` waits on `test-detail-rename` (30 s).

## 4. Assertions Split
### Fixed (inside ATC)
PATCH method, 200, `changed` true, `test.title` equals the new title, header (`test-detail-title`) has the new title.
### Test-level (in test file)
Version equals the baseline plus 1 (`TestsApi.getTest`); `step_id`s, positions (chain order, since the seed repeats one scaffold ATC), ATC ids and tags equal the baseline; explorer (`TestDetailPage.expectTitleInExplorer`) and Tests list (`TestsListPage.expectRowTitle` after the unique-tag filter) show the new title; workspace search (`SearchApi.searchPalette` through a workspace-scoped member session) finds the Test by the new title and no longer by the old one, and `TestsApi.searchTests` finds it; exactly one new `test.renamed` event with old and new title (`ActivityApi.listNewTestActivity`). No rename back (the shared teardown archives the Test).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-01 1.1 | EP, State Transition | 1 |

EP: one valid new title different from the current one. BVA: N/A here (limits are BK-2167). Parameterized ATC reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedInState({ state: 'live', chainLength: 2, tags })`, `TestLifecycleSteps` (`openMemberArena`, `openScopedSession`)
- Components: TestDetailPage (extended), TestsListPage `expectRowTitle`, ActivityApi `listNewTestActivity`, SearchApi `searchPalette`, TestsApi `getTest`, `searchTests`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test, chain of 2, 2 tags | Generate | `POST /atcs` x2, `POST /tests`, `PUT /tests/{id}/tags` | test | archive in `afterAll` (shared teardown) |

## 9. Checklist
- [ ] renameFromHeader naming
- [ ] One object param
- [ ] void return (UI)
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC (manifest checked, no match)
