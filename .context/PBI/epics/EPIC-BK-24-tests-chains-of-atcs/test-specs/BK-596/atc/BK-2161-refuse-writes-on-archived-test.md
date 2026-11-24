# ATC Spec: BK-2161 - An archived Test is frozen

> Ticket: BK-2161 (TC22)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Negative
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse rename, reorder and tag changes with a 409 archived error and keep the version, title, chain and tags given an archived Test | Rename, chain reorder and tags are frozen until restore | Archived Test with a chain of at least 2 steps and tags | AC-06 6.1 |

## 2. ATC Contract
```typescript
@atc('BK-2161')
async refuseWriteOnArchivedTest(args: { testId: string, writer: FrozenWriter }): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.sendFrozenWrite(args);
  expect(response.status()).toBe(409);
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.archiveReason);
  return [response, body];
}
```
`FrozenWriter` is `{ kind: 'rename', title } | { kind: 'reorder', stepIds } | { kind: 'tags', tags }`; the private `sendFrozenWrite` maps them to `PATCH /v1/tests/{id}`, `PATCH /v1/tests/{id}/reorder` (`step_ids`, step ids not ATC ids) and `PUT /v1/tests/{id}/tags`.

## 3A. API Details
Three writers, all mapping the guard to 409 with `details.reason` `test_archived`. No add or remove ATC route exists.

## 4. Assertions Split
### Fixed (inside ATC)
409 and reason `test_archived`.
### Test-level (in test file)
Version, `updated_at`, title, chain order and tags equal the baseline (`getTest`); no new event of the row's `watchedActions` (`test.renamed` for the rename row; none observable for reorder and tags); UI half in its own test, run once: `TestDetailPage.expectFrozen` (no `test-detail-rename`, no `test-tag-editor-open`, no `test-reorder-handle-*`, banner `test-archived-banner` shown). The restore in teardown is not needed; the Test ends archived.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-06 6.1 | Decision Table (writer x archived) | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| refuseWriteOnArchivedTest | none | 3: rename, reorder, tags |

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 2, tags })` archived with `archiveTest`
- Components: TestsApi NEW, TestDetailPage NEW (UI half)

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Archived Test, chain of 2, tags | Generate | API | test | none |

## 9. Checklist
- [ ] refuseWriteOnArchivedTest naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature `refuseWriteOnArchivedTest({ testId, row, stepIds })`, `row` from the literal `FROZEN_WRITE_ROWS` (kind, expectedStatus 409, expectedCode `conflict`, expectedReason `test_archived`). The chain of 2 is the scaffold ATC chained twice. The reorder and tags endpoints emit only `test.reordered` and `test.tags_changed`, which the activity feed drops, so "no activity row" is not observable for those rows. Each row declares `watchedActions` and the delta is read only through it; version, `updated_at`, title, chain and tags carry the proof. The precondition asserts the seeded tags (`TEST_LIFECYCLE.seedTags`) next to the chain of 2.
- UI half: `TestDetailPage.open` then `expectFrozen` (banner, no rename, no tag editor, no drag handle), anchored on the test id prefix `test-reorder-handle-`.
- A member page on a live Test of the same kind must show the rename control, the tag editor and the drag handle (`expectEditControlsOffered`) before the archived Test is asserted frozen, so the absence checks cannot pass on renamed ids. Archived Tests come from `TestSeedSteps.seedInState`.
