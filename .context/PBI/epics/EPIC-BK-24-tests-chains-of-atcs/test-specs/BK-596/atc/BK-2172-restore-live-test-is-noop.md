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
async restoreLiveTestChangesNothing(args: { testId: string, versionBefore: number }): Promise<[APIResponse, RestoreTestResponse]> {
  const [response, body] = await this.restoreTest(args.testId);
  expect(body.test.changed).toBe(false);
  expect(body.test.archived_at).toBeNull();
  const [, read] = await this.getTest(args.testId);
  expect(read.test.archived_at).toBeNull();
  expect(read.test.version).toBe(args.versionBefore);
  return [response, body];
}
```
`restoreTest` is the helper that sends `POST /v1/tests/{id}/restore` and asserts 200. The `changed` flag sits inside `test` for restore (beside `test` for rename).

## 3A. API Details
`POST /api/v1/tests/{id}/restore`; response `{ test: { id, title, archived_at, archived_by, changed } }`.

## 4. Assertions Split
### Fixed (inside ATC)
200, `test.changed` false, `archived_at` null, version unchanged.
### Test-level (in test file)
Precondition: the seeded Test is live (`archived_at` null). No new `test.restored` event (`ActivityApi.listNewTestEvents` delta against a snapshot taken before the call); `test.restored` is in the feed allowlist, so the check can fail.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-10 10.2 | State Transition (live to live) | 1 |

Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedInState({ state: 'live' })`; its returned Test supplies `version` as `versionBefore`
- Components: TestsApi, ActivityApi

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test | Generate | API | test | archive in `afterAll` (shared teardown) |

## 9. Checklist
- [ ] restoreLiveTestChangesNothing naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature as in §2. The version is re-read after the call because the restore response carries no version; the Test row `archived_at` is asserted null on both the response and the read.
- A restore that wrongly acted on a live Test would fail one of: `changed` true, a version bump, or a new `test.restored` event.
