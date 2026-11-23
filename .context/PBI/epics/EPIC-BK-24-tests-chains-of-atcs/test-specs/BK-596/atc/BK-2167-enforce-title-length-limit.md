# ATC Spec: BK-2167 - Test title length rule at rename and create

> Ticket: BK-2167 (TC28, absorbs TC29 BK-2168; regression of BK-2243)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Validation (BVA)
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should accept 199 and 200 characters, also 200 multi-byte characters, and refuse 201 with a too-long error (422) at rename and create | One limit of 200 characters (code points) at both writers | Live Test with a known title; a live ATC; a member session | AC-01 1.2 |

## 2. ATC Contract
```typescript
@atc('BK-2167')
async applyTitleLengthBoundaries(
  args: { target: RenameTarget | CreateTarget, row: TitleLengthRow, title: string },
): Promise<[APIResponse, TitleWriteBody]> {
  const { target, row, title } = args;
  const [response, body] = target.kind === 'rename'
    ? await this.patchTitle<TitleWriteBody>({ testId: target.testId, title })
    : await this.postTitle<TitleWriteBody>({ target, title });
  expect(response.status()).toBe(row.expectedStatus);
  expect(this.readCode(body)).toBe(row.expectedCode);
  expect(this.readReason(body)).toBe(row.expectedReason);
  expect(this.readTitleLength(body)).toBe(row.expectedStatus === 422 ? null : row.count);
  if (target.kind === 'rename') {
    const [, read] = await this.getTest(target.testId);
    expect(this.readChanged(body)).toBe(row.expectedStatus === 422 ? null : true);
    expect(read.test.title).toBe(row.expectedStatus === 422 ? target.seedTitle : title);
    expect(read.test.version).toBe(row.expectedStatus === 422 ? target.seedVersion : target.seedVersion + 1);
  }
  return [response, body];
}
```
`TitleLengthRow` is one entry of the literal TC28 table `TITLE_LENGTH_ROWS` in `tests/data/constants.ts` (`label`, `endpoint`, `character`, `count`, `expectedStatus`, `expectedCode`, `expectedReason`). The test builds `title` once with `DataFactory.createTitleOfLength` and passes it in.

## 3A. API Details
`PATCH /api/v1/tests/{id}` (200) and `POST /api/v1/tests` (201); the shared rule counts code points after trim; 422 `title_too_long`.

## 4. Assertions Split
### Fixed (inside ATC)
Status and reason per row from the table; accepted title has the requested code-point count; the stored title of a renamed Test equals the new title when accepted and the seeded title when refused; a rename reports `changed: true` and bumps the version by one when accepted, and leaves the version untouched when refused.
### Test-level (in test file)
One test per table row: new `test.renamed` events (rename) or title-filtered `test.created` events (create) number 1 for an accepted row and 0 for a refused one; any Test an attempted create produced is archived in teardown.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-01 1.2 | BVA (199, 200, 201) x EP on length unit | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| applyTitleLengthBoundaries | none (rows are the TC's own) | 8: rename `a` 199, 200, 201; rename `é` 200; rename emoji 200, 201; create emoji 200, 201 |

Mixed accept and refuse outcomes sit in one ATC because the TC is one key and the repo precedent (`RunsApi.readReportIsolatedToProject`) uses a discriminated `expected`. The 1-character edge and spaces-around-201 are not signed TCs (OQ6).

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })` per test, one live ATC
- Components: TestsApi NEW, DataFactory addition `createTitleOfLength`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test, live ATC | Generate | API | `beforeEach` (one Test per row, so no title restore) | every Test created is archived in teardown |

## 9. Checklist
- [ ] applyTitleLengthBoundaries naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
