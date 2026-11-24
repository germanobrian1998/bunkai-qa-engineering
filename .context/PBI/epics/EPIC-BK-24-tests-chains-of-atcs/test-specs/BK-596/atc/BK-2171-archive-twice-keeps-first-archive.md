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
async archiveAgainKeepsFirstArchive(args: { testId: string, firstArchive: FirstArchive }): Promise<[APIResponse, GetTestResponse]> {
  const [response] = await this.apiDELETE(`/v1/tests/${args.testId}`);
  expect(response.status()).toBe(204);
  const [readResponse, read] = await this.getTest(args.testId);
  expect(read.test.archived_at).toBe(args.firstArchive.archivedAt);
  expect(read.test.archived_by).toBe(args.firstArchive.archivedBy);
  return [readResponse, read];
}
```
`FirstArchive` is `{ archivedAt: string, archivedBy: string }`, exported from `TestsApi.ts`. Called on the Admin's `ApiFixture`; the first archive was made by the Member through `TestSeedSteps.seedInState({ state: 'archived' })`, whose returned Test is the baseline.

## 3A. API Details
`DELETE /api/v1/tests/{id}` documented idempotent (first actor and timestamp kept, no new event).

## 4. Assertions Split
### Fixed (inside ATC)
204; `archived_at` and `archived_by` equal the first archive (still the member).
### Test-level (in test file)
Preconditions that keep the test able to fail: `archived_by` of the seed equals the Member's `GET /me` id and the Admin's id differs, and the first archive wrote exactly one `test.archived` event. After the ATC the `test.archived` event ids for the Test (`ActivityApi.snapshotTestEvents`) equal the ids read before: a second event would add an id. Archive and restore events are in the activity feed allowlist (`test.renamed`, `test.archived`, `test.restored`), so "no second event" is observable.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-10 10.1 | State Transition (archived to archived, different actor) | 1 |

Reduction: none.

## 7. Dependencies
- QA-workspace arena (`TestLifecycleSteps.openMemberArena`), Admin session (`openRoleSession({ role: 'admin' })`), `TestSeedSteps.seedInState({ state: 'archived' })` as the first archive by the Member
- Components: TestsApi, ActivityApi

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Test archived by the Member | Generate | API | test | none: the Test ends archived; the shared teardown archives it again (idempotent). The TC's closing restore is dropped because the Test is generated, never a shared fixture |

## 9. Checklist
- [ ] archiveAgainKeepsFirstArchive naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature `archiveAgainKeepsFirstArchive({ testId, firstArchive })`, returns the read after the second archive. The ATC asserts 204, `archived_at` and `archived_by` equal to the first archive. It cannot tell the Member from the Admin by itself, so the test asserts the seed's `archived_by` is the Member's `GET /me` id and differs from the Admin's before the call.
- The activity feed lists `test.archived`; the event check compares the full id list for the Test before and after (precondition: exactly one), so both a second event and a missing first event fail.
- `getTest` asserts 200, so the ATC also proves the Test still resolves.
