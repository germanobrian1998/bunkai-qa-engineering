# ATC Spec: BK-2164 - A non-member never learns a Test exists

> Ticket: BK-2164 (TC25)
> Component: TestsApi (tests/components/api/TestsApi.ts), NEW
> Type: API - Negative
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should answer 404 and hide an archived Test from search for a workspace non-member, the same as for a live Test | No existence leak, live or archived | Test in a workspace owned by the member, live or archived; the viewer account is not a member of that workspace | AC-08 8.2 |

## 2. ATC Contract
```typescript
@atc('BK-2164')
async hideTestFromNonMember(args: { testId: string, title: string, projectId: string }): Promise<[APIResponse, ErrorEnvelope]> {
  const [response, body] = await this.apiGET<ErrorEnvelope>(`/v1/tests/${args.testId}`);
  expect(response.status()).toBe(404);
  const [missing, missingBody] = await this.apiGET<ErrorEnvelope>(`/v1/tests/${randomUUID()}`);
  expect(missing.status()).toBe(404);
  expect(this.stripRequestId(body)).toEqual(this.stripRequestId(missingBody));
  const [searchResponse, search] = await this.apiGET<TestSearchResult>(
    `/v1/tests/search?query=${encodeURIComponent(args.title)}&project_id=${args.projectId}`,
  );
  expect(search.items).toEqual([]);
  expect([200, 403, 404]).toContain(searchResponse.status());
  return [response, body];
}
```
The status of the search for a foreign project is not stated in the TC (empty `items` list is); the plan asserts the empty list and records the observed status at Code time, tightening the `toContain` to the real value.

## 3A. API Details
`GET /api/v1/tests/{id}` (non-disclosing 404), `GET /api/v1/tests/search?query=&project_id=` (project-scoped, so aimed at the foreign project). Out of scope per the TC refinement: PATCH, DELETE and restore on a foreign Test answer 403 while a random id answers 404 (routed to a platform security review).

## 4. Assertions Split
### Fixed (inside ATC)
404 equal to a missing Test (ignoring `request_id`); search returns an empty list.
### Test-level (in test file)
Owner-side positive controls (the member finds the live Test through the Test search and the palette search, and not the archived one); live and archived rows behave the same; the Member restores the Test archived for the row.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-08 8.2 | EP on Test state | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| hideTestFromNonMember | none | 2: live, archived (the state is prepared by the test) |

## 7. Dependencies
- Member session (owns the arena workspace), Viewer session, generated project in the Member-owned workspace
- Components: TestsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Foreign workspace, project, Test | Discover workspace and project, Generate Test | Member `GET /me`, `GET /workspaces/{id}/projects`, `POST /tests` | `beforeAll` and test | restore when archived, archive in `afterAll` |

## 9. Checklist
- [ ] hideTestFromNonMember naming
- [ ] One object param
- [ ] Tuple return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC

## 10. As built

- Signature `hideTestFromNonMember({ testId, title, projectId, row })`, `row` from `NON_MEMBER_ROWS` (state, expectedStatus 404, expectedCode `not_found`). The search answers 200 with an empty list; the owner-side search is the positive control.
- Arena: `TestLifecycleSteps.openForeignArena` (find-only workspace and project, viewer non-membership verified). The palette data source is asserted in the ATC (see below); the palette UI rendering is not (no stable test id).
- The command palette calls `GET /api/v1/search?q=`, scoped by the active-workspace cookie. The ATC also asserts that the non-member session scoped to the foreign workspace gets no row for the Test there (`searchPalette`). `TestLifecycleSteps.openRoleSession({ role, workspaceId })` builds the scoped session.

### Open follow-up

Assert the rendered palette in the viewer's browser (type the title, expect no row); needs a `/playwright-cli` discovery of the palette locators.
