# ATC Spec: BK-2165 - Refuse a rename with a stale version

> Ticket: BK-2165 (TC26)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Negative
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should refuse a rename carrying a stale version with a 409 version conflict and the current version given a Test changed after it was read | Optimistic concurrency on rename | Live Test at version V; its tags changed so the version is V+1 | E2 |

## 2. ATC Contract
```typescript
@atc('BK-2165')
async refuseStaleVersionRename(args: { testId: string, staleVersion: number }): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.apiPATCH<ErrorEnvelope, { title: string }>(
    `/v1/tests/${args.testId}`,
    { title: DataFactory.createTestTitle() },
    { headers: { 'X-If-Match': String(args.staleVersion) } },
  );
  expect(response.status()).toBe(409);
  expect(this.readReason(body)).toBe(TEST_LIFECYCLE.versionConflictReason);
  expect(this.readDetail(body, 'current_version')).toBe(args.staleVersion + 1);
  return [response, body];
}
```
`X-If-Match` is the header (`If-Match` is only a fallback off Vercel).

## 3A. API Details
`PATCH /api/v1/tests/{id}` with `X-If-Match`; 409 `version_conflict` with `details.current_version`. DataFactory is imported by alias `@DataFactory`.

## 4. Assertions Split
### Fixed (inside ATC)
409, reason `version_conflict`, `current_version` equals the stale version plus 1.
### Test-level (in test file)
Title unchanged, no `test.renamed` event; tags reset to `[]` at the end (`setTags`).

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| E2 | State Transition (V to V+1, stale V) | 1 |

Reduction: none. BVA: N/A.

## 7. Dependencies
- `TestSeedSteps.seedTest({ atcs: 1 })`; `TestsApi.setTags` raises the version
- Components: TestsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Live Test at V then V+1 | Generate | `POST /tests`, `PUT /tests/{id}/tags` | test | tags reset, archive in `afterAll` |

## 9. Checklist
- [ ] refuseStaleVersionRename naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
