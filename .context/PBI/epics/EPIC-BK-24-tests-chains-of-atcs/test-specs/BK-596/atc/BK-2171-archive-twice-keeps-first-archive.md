# ATC Spec: BK-2171 - A second archive changes nothing

> Ticket: BK-2171 (TC32)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - State change (idempotent)
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should answer 204 to a second archive and keep the first archive time and actor with no second event given an already archived Test | Archive is idempotent and keeps the first actor and time | Test archived by the member at a known time; an admin session | AC-10 10.1 |

## 2. ATC Contract
```typescript
@atc('BK-2171')
async archiveAgainKeepsFirstArchive(args: { testId: string, firstArchive: { archivedAt: string, archivedBy: string } }): Promise<[APIResponse, TestBody]> {
  const [response] = await this.apiDELETE(`/v1/tests/${args.testId}`);
  expect(response.status()).toBe(204);
  const [readResponse, body] = await this.getTest(args.testId);
  expect(readResponse.status()).toBe(200);
  expect(body.test.archived_at).toBe(args.firstArchive.archivedAt);
  expect(body.test.archived_by).toBe(args.firstArchive.archivedBy);
  return [readResponse, body];
}
```
Called on the Admin's `ApiFixture`; the first archive was made by the Member (helper `archiveTest`).

## 3A. API Details
`DELETE /api/v1/tests/{id}` documented idempotent (first actor and timestamp kept, no new event).

## 4. Assertions Split
### Fixed (inside ATC)
204; `archived_at` and `archived_by` equal the first archive (still the member).
### Test-level (in test file)
Exactly one `test.archived` event for the Test (`ActivityApi.listNewTestEvents`); fixture restore in teardown.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-10 10.1 | State Transition (archived to archived, different actor) | 1 |

Reduction: none.

## 7. Dependencies
- QA-workspace arena with the Admin and Member sessions; `TestsApi.archiveTest` as the first archive
- Components: TestsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Test archived by the Member | Generate | API | test | `restoreTest`, archive in `afterAll` |

## 9. Checklist
- [ ] archiveAgainKeepsFirstArchive naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
