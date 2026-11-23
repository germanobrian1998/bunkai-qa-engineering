# ATC Spec: BK-2172 - Restoring a live Test changes nothing

> Ticket: BK-2172 (TC33)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - State change (idempotent)
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should answer 200 with changed false and write no event when restoring a live Test | Restore is idempotent | Live Test | AC-10 10.2 |

## 2. ATC Contract
```typescript
@atc('BK-2172')
async restoreLiveTestChangesNothing(args: { testId: string, versionBefore: number }): Promise<[APIResponse, RestoreTestBody]> {
  const [response, body] = await this.apiPOST<RestoreTestBody>(`/v1/tests/${args.testId}/restore`, {});
  expect(response.status()).toBe(200);
  expect(body.test.changed).toBe(false);
  expect(body.test.archived_at).toBeNull();
  const [, after] = await this.getTest(args.testId);
  expect(after.test.version).toBe(args.versionBefore);
  return [response, body];
}
```
The `changed` flag sits inside `test` for restore (beside `test` for rename).

## 3A. API Details
`POST /api/v1/tests/{id}/restore`; response `{ test: { id, title, archived_at, archived_by, changed } }`.

## 4. Assertions Split
### Fixed (inside ATC)
200, `test.changed` false, `archived_at` null, version unchanged.
### Test-level (in test file)
No new `test.restored` event (`ActivityApi.listTestEvents` delta).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-10 10.2 | State Transition (live to live) | 1 |

Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })`
- Components: TestsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test | Generate | API | test | archive in `afterAll` |

## 9. Checklist
- [ ] restoreLiveTestChangesNothing naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
