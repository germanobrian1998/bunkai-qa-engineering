# ATC Spec: BK-2156 - Refuse a blank Test name

> Ticket: BK-2156 (TC17, regression of BK-2243)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Negative
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse a blank name with a required-name error (422) and keep the old name given an empty, space, tab or non-breaking-space-only title at rename and create | One required-name rule at rename and create | Live never-run Test at a known version; a live ATC; a member session | AC-01 1.2 |

## 2. ATC Contract
```typescript
@atc('BK-2156')
async refuseBlankTitle(args: BlankTitleArgs): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = args.operation === 'rename'
    ? await this.apiPATCH<ErrorEnvelope, { title: string }>(`/v1/tests/${args.testId}`, { title: args.title })
    : await this.apiPOST<ErrorEnvelope, CreateTestPayload>(
        '/v1/tests',
        { title: args.title, atc_ids: [args.atcId], workspace_id: args.workspaceId },
        { headers: { 'Idempotency-Key': randomUUID() } },
      );
  expect(response.status()).toBe(422);
  expect(body.error.code).toBe('validation_failed');
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.titleRequiredReason);
  return [response, body];
}
```
`BlankTitleArgs` is the discriminated union `{ operation: 'rename', testId, title } | { operation: 'create', atcId, workspaceId, title }`.

## 3A. API Details
`PATCH /api/v1/tests/{id}` and `POST /api/v1/tests` (Idempotency-Key required; `workspace_id` in the body for token callers, cookie default is the active workspace). 422 `validation_failed` with `details.reason` `title_required`.

## 4. Assertions Split
### Fixed (inside ATC)
Status 422, code `validation_failed`, reason `title_required`.
### Test-level (in test file)
Rename rows: title and version unchanged (`getTest`), no new `test.renamed` event; UI half for one rename row: `TestDetailPage.expectRenameError` (`test-rename-error` shows the required-name message). Create rows: no Test with that title exists (`searchTests`).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-01 1.2 | EP (every blank class) x call | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| refuseBlankTitle | none (classes are the TC's own) | 6: rename with empty, 3 spaces, 2 tabs, 2 NBSP; create with empty, 2 NBSP |

BVA: lower boundary 0 is the empty row; the 1-character accept edge has no signed TC (OQ6).

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })`, one live ATC from `AtcsApi`
- Components: TestsApi NEW, ActivityApi `listTestEvents`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test at a known version, live ATC | Generate | API | test | archive in `afterAll` |

## 9. Checklist
- [ ] refuseBlankTitle naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
