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
The archive is a test-level stimulus (`TestsApi.archiveTest`), made before the ATC reads the filter. `baseline` is the ordered id list of `listByTag` before the archive; the list has no `total` field, so the total is the count of ids across all pages (`listByTag` follows `next_cursor` with limit 50). `row` comes from the literal `TAG_FILTER_ROWS` table. The ATC is the API half and the only proof that archived Tests are dropped by the tag API. The UI half (tag filter on the Tests list) is test-level, see §4, and does not prove that: the list source already excludes archived Tests, so an archived id leaking out of the tag API would not show up there.

## 3A. API Details
`GET /api/v1/tests?tag=` (page `limit` 1..50, `next_cursor`, newest first), `DELETE /api/v1/tests/{id}`. Types `FilteredTest`, `FilterTestsResponse` in `tests.types.ts`.

## 4. Assertions Split
### Fixed (inside ATC)
Baseline lists the Test; list 200 on every page; archived id absent; remaining ids and order equal the baseline minus the Test (so the total drops by exactly one); remaining count equals `row.expectedRemaining` (3 siblings, or 0).
### Test-level (in test file)
Precondition: the baseline holds exactly the Test and the siblings that carry the tag, and not a live Test seeded without the tag (the negative control). UI half (`TestsListPage`, the project Tests list that hosts `test-tag-filter`): `filterByTag` retries fill plus the product's own lookup (`GET /api/v1/tests?tag=` answered 200) until the lookup fires, since a fill before hydration is lost. `expectFilteredRows` first asserts `tests-list-error` is not visible. With ids, it waits for `tests-list-table` (the list is out of its pending skeleton and in the applied rows state) and polls until the visible rows are exactly the expected ids in the same order as the API list. With no ids, it asserts `tests-list-no-match`, which only renders for an applied lookup with zero matches (a skeleton, an error or an unrendered page also show zero rows, so an empty row count alone would be vacuous). While the lookup is pending the list shows a skeleton, not the unfiltered list. What the UI half proves: the filter ran (the untagged live Test, present in the unfiltered list, is absent from the shared row; `tests-list-no-match` shows on the empty row) and the rendered rows follow the list's sort. What it cannot prove: that an archived id does not leak out of the tag API, because the list source excludes archived Tests; the API half is that proof. The UI order equality relies on the list default sort (`created desc`) matching the API order, so a sort change there would surface as a UI failure.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-03 3.1, 3.2 | EP on tag | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| listTagFilterWithoutArchived | none | 2: shared generated tag (3 siblings remain), generated tag carried by the Test alone (empty list remains); replaces the TC's `smoke` row (OQ4) |

## 7. Dependencies
- `TestSeedSteps.seedInState({ state: 'live', tags })` for 3 siblings carrying the generated shared tag, a Test A carrying the shared tag and its own generated tag, and one live Test without the tag (negative control: it proves the filter ran, in the UI half)
- Components: TestsApi, TestsListPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| 4 Tests sharing generated tags, plus 1 live untagged Test | Generate | `POST /tests`, `PUT /tests/{id}/tags` | test | Test A ends archived (the stimulus); all Tests archived in `afterAll` (shared teardown); UI rows read from the list, whose source excludes archived Tests |

## 9. Checklist
- [ ] listTagFilterWithoutArchived naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature `listTagFilterWithoutArchived({ row, tag, testId, baseline })` with `baseline` a plain ordered id list. The archive moved out of the ATC to the test, and `row` was added, so the expectation of the remaining count is a literal table value.
- Rows: the shared generated tag keeps 3 siblings; the generated tag carried only by the archived Test leaves an empty list. The TC's `smoke` row is replaced by the second, as the plan decided (OQ4); the workspace has other smoke Tests, so a fixed `smoke` list would be nondeterministic.
- UI half is the project Tests list (`/projects/{slug}/tests`) with the shared tag filter, anchored on `tests-list-row-{id}` (row set and order read from the DOM); the explorer Tests group has no stable locator and is not asserted. `TestsListPage.filterByTag` retries fill plus the lookup response (`lib/tests/tag-filter-lookup.ts`, debounce 250 ms in `test-tag-filter.tsx`) within a bounded `toPass`, because the filter input is server-rendered and no element appears only after hydration, so a fill made before hydration is lost; there is no sleep. `expectFilteredRows({ ids })` asserts `tests-list-error` is not visible, then `tests-list-table` plus the exact ordered row ids, or `tests-list-no-match` for an empty list. While the lookup is pending the list shows a skeleton (`tests-list-loading`), not the unfiltered list.
- The UI half proves the filter ran (the untagged live Test is absent on the shared row, `tests-list-no-match` on the empty row) and that rendered rows follow the list sort. It cannot observe an archived id leaking out of the tag API, because the list source excludes archived Tests; the API half is the proof that archived Tests are dropped. The UI order equals the API order only while the list default sort (`created desc`) matches the API order (newest first), so a sort change there would surface as a UI failure.
