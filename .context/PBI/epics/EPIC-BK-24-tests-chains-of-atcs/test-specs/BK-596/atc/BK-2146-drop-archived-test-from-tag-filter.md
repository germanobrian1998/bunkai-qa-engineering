# ATC Spec: BK-2146 - Tag filter drops an archived Test

> Ticket: BK-2146 (TC7)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should drop the archived Test from the tag filter and keep its three siblings in the same order | An archived Test is no longer offered by tag filtering and the rest of the list is undisturbed | Test A and Siblings S1 to S3 share a tag; baseline list and total read before the archive | AC-03 3.1, 3.2 |

## 2. ATC Contract
```typescript
@atc('BK-2146')
async listTagFilterWithoutArchived(args: { row: TagFilterRow, tag: string, testId: string, baseline: string[] }): Promise<[APIResponse, FilteredTest[]]> {
  expect(args.baseline).toContain(args.testId);
  const [response, items] = await this.listByTag(args.tag);
  const ids = items.map(item => item.id);
  expect(ids).not.toContain(args.testId);
  expect(ids).toEqual(args.baseline.filter(id => id !== args.testId));
  expect(ids).toHaveLength(args.row.expectedRemaining);
  return [response, items];
}
```
The archive is a test-level stimulus (`TestsApi.archiveTest`), made before the ATC reads the filter. `baseline` is the ordered id list of `listByTag` before the archive; the list has no `total` field, so the total is the count of ids across all pages (`listByTag` follows `next_cursor` with limit 50). `row` comes from the literal `TAG_FILTER_ROWS` table.

## 3A. API Details
`GET /api/v1/tests?tag=` (page `limit` 1..50, `next_cursor`, newest first), `DELETE /api/v1/tests/{id}`. Types `FilteredTest`, `FilterTestsResponse` in `tests.types.ts`.

## 4. Assertions Split
### Fixed (inside ATC)
Baseline lists the Test; list 200 on every page; archived id absent; remaining ids and order equal the baseline minus the Test (so the total drops by exactly one); remaining count equals `row.expectedRemaining` (3 siblings, or 0).
### Test-level (in test file)
Precondition: the baseline holds exactly the Test and the siblings that carry the tag. UI half (`TestsListPage`, the project Tests list that hosts `test-tag-filter`): before the archive the filtered list shows every baseline row (positive control); after the archive, filtered again, it shows the remaining rows and none for the archived Test (the empty row asserts `tests-list-no-match`).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-03 3.1, 3.2 | EP on tag | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| listTagFilterWithoutArchived | none | 2: shared generated tag (3 siblings remain), generated tag carried by the Test alone (empty list remains); replaces the TC's `smoke` row (OQ4) |

## 7. Dependencies
- `TestSeedSteps.seedInState({ state: 'live', tags })` for 3 siblings carrying the generated shared tag and a Test A carrying the shared tag and its own generated tag
- Components: TestsApi, TestsListPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| 4 Tests sharing generated tags | Generate | `POST /tests`, `PUT /tests/{id}/tags` | test | Test A ends archived (the stimulus); all Tests archived in `afterAll` (shared teardown) |

## 9. Checklist
- [ ] listTagFilterWithoutArchived naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature `listTagFilterWithoutArchived({ row, tag, testId, baseline })` with `baseline` a plain ordered id list. The archive moved out of the ATC to the test, and `row` was added, so the expectation of the remaining count is a literal table value.
- Rows: the shared generated tag keeps 3 siblings; the generated tag carried only by the archived Test leaves an empty list. The TC's `smoke` row is replaced by the second, as the plan decided (OQ4); the workspace has other smoke Tests, so a fixed `smoke` list would be nondeterministic.
- UI half is the project Tests list (`/projects/{slug}/tests`) with the shared tag filter, anchored on `tests-list-row-{id}` and `tests-list-no-match`; the explorer Tests group has no stable locator and is not asserted.
