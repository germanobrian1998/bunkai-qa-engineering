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
async listTagFilterWithoutArchived(args: { tag: string, testId: string, baseline: TagListBaseline }): Promise<[APIResponse, TestListPage]> {
  const archived = await this.archiveTest(args.testId);
  expect(archived[0].status()).toBe(204);
  const [response, body] = await this.apiGET<TestListPage>(`/v1/tests?tag=${encodeURIComponent(args.tag)}`);
  expect(response.status()).toBe(200);
  const ids = body.items.map(item => item.id);
  expect(ids).not.toContain(args.testId);
  expect(body.total).toBe(args.baseline.total - 1);
  expect(ids).toEqual(args.baseline.ids.filter(id => id !== args.testId));
  return [response, body];
}
```
The archive call is the component's own helper (same resource), so no ATC calls another ATC. If the list response carries no `total`, derive it from `items.length` with all pages read (confirm against `TestListPage` at Code time).

## 3A. API Details
`GET /api/v1/tests?tag=` (one page, `limit` default 20, max 50, `next_cursor`), `DELETE /api/v1/tests/{id}`. Types `TestListPage`, `TagListBaseline` in `tests.types.ts` / `types.ts`.

## 4. Assertions Split
### Fixed (inside ATC)
Archive 204; list 200; archived id absent; total one lower; remaining ids and order equal the baseline.
### Test-level (in test file)
Workbench tag filter `test-tag-filter` for the tag shows the same remaining rows (UI half, OQ2).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-03 3.1, 3.2 | EP on tag | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| listTagFilterWithoutArchived | none | 2: shared generated tag (3 siblings remain), generated tag carried by the Test alone (empty list remains); replaces the TC's `smoke` row (OQ4) |

## 7. Dependencies
- `TestSeedSteps.seedSiblings({ count: 3, sharedTag })`, a Test A carrying the shared tag and its own tag
- Components: TestsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| 4 Tests sharing generated tags | Generate | `POST /tests`, `PUT /tests/{id}/tags` | test | restore Test A, archive all in `afterAll` |

## 9. Checklist
- [ ] listTagFilterWithoutArchived naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
