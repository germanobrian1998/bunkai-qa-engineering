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
async applyTitleLengthRule(args: TitleLengthArgs): Promise<[APIResponse, TestBody | ErrorEnvelope]> {
  const title = DataFactory.createTitleOfLength({ character: args.character, count: args.count });
  const [response, body] = args.operation === 'rename'
    ? await this.apiPATCH<TestBody | ErrorEnvelope, { title: string }>(`/v1/tests/${args.testId}`, { title })
    : await this.apiPOST<TestBody | ErrorEnvelope, CreateTestPayload>(
        '/v1/tests',
        { title, atc_ids: [args.atcId], workspace_id: args.workspaceId },
        { headers: { 'Idempotency-Key': randomUUID() } },
      );
  expect(response.status()).toBe(args.expectedStatus);
  if (args.expectedStatus === 422) {
    expect(this.readReason(body as ErrorEnvelope)).toBe(TEST_LIFECYCLE.titleTooLongReason);
  }
  else {
    expect([...(body as TestBody).test.title].length).toBe(args.count);
  }
  return [response, body];
}
```
`TitleLengthArgs` is the discriminated union over `operation` ('rename' with `testId`, 'create' with `atcId` and `workspaceId`) plus `character`, `count`, `expectedStatus` (200, 201 or 422). One object param.

## 3A. API Details
`PATCH /api/v1/tests/{id}` (200) and `POST /api/v1/tests` (201); the shared rule counts code points after trim; 422 `title_too_long`.

## 4. Assertions Split
### Fixed (inside ATC)
Status per row; 422 reason `title_too_long`; accepted title has the requested code-point count.
### Test-level (in test file)
Refused rename: title unchanged, no `test.renamed` event; accepted create rows archive the created Test in `afterAll`; the original title is restored after the rename rows.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-01 1.2 | BVA (199, 200, 201) x EP on length unit | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| applyTitleLengthRule | none (rows are the TC's own) | 8: rename `a` 199, 200, 201; rename `é` 200; rename emoji 200, 201; create emoji 200, 201 |

Mixed accept and refuse outcomes sit in one ATC because the TC is one key and the repo precedent (`RunsApi.readReportIsolatedToProject`) uses a discriminated `expected`. The 1-character edge and spaces-around-201 are not signed TCs (OQ6).

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })`, one live ATC
- Components: TestsApi NEW, DataFactory addition `createTitleOfLength`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test, live ATC | Generate | API | test file `beforeAll` (one Test serves all rows, restored between rows) | original title restored, created Tests archived |

## 9. Checklist
- [ ] applyTitleLengthRule naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
