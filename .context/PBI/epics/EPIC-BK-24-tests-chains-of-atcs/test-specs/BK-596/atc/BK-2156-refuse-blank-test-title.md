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
async refuseBlankTitle(args: { target: RenameTarget | CreateTarget, title: string }): Promise<[APIResponse, ErrorEnvelope]> {
  const { target, title } = args;
  const [response, body] = target.kind === 'rename'
    ? await this.patchTitle<ErrorEnvelope>({ testId: target.testId, title })
    : await this.postTitle<ErrorEnvelope>({ target, title });
  expect(response.status()).toBe(422);
  expect(body.error.code).toBe('validation_failed');
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.titleRequiredReason);
  if (target.kind === 'rename') {
    await this.expectSeedUntouched(target);
  }
  return [response, body];
}
```
`RenameTarget` is `{ kind: 'rename', testId, seedTitle, seedVersion }` and `CreateTarget` is `{ kind: 'create', atcId, workspaceId, onCreated }`; `onCreated` receives the id of any Test the create produced, straight from the 2xx response and before any assertion, so the Steps layer can archive it. One ATC covers both endpoints because every row has the same outcome.

## 3A. API Details
`PATCH /api/v1/tests/{id}` and `POST /api/v1/tests` (Idempotency-Key required; `workspace_id` in the body for token callers, cookie default is the active workspace). 422 `validation_failed` with `details.reason` `title_required`.

## 4. Assertions Split
### Fixed (inside ATC)
Status 422, code `validation_failed`, reason `title_required`.
### Test-level (in test file)
Rename rows: no new `test.renamed` event (title and version unchanged are asserted inside the ATC); UI half as its own test in the same file: `TestDetailPage.expectRenameError` (`test-rename-error` shows the required-name message), then an API re-read asserts title and version unchanged. Create rows: no new `test.created` event carrying the attempted title, because a blank title is not searchable.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-01 1.2 | EP (every blank class) x call | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| refuseBlankTitle | none (classes are the TC's own) | 6 API rows plus 1 UI test: rename with empty, 3 spaces, 2 tabs, 2 NBSP; create with empty, 2 NBSP |

BVA: lower boundary 0 is the empty row; the 1-character accept edge has no signed TC (OQ6).

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })` per test, one live ATC from `AtcsApi`
- Components: TestsApi NEW, ActivityApi `listTestEvents`

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test at a known version, live ATC | Generate | API | `beforeEach` (one Test per test) | archive in `afterAll` |

## 9. Checklist
- [ ] refuseBlankTitle naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
