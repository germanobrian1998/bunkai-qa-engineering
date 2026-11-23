# ATC Spec: BK-2150 - Traceability keeps an archived Test as evidence

> Ticket: BK-2150 (TC11)
> Component: TraceabilityPage (tests/components/ui/TraceabilityPage.ts), NEW
> Type: UI - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should keep an archived Test with Runs as evidence in Story traceability, marked Archived | An archived but bound Test is evidence, never an authoring gap | Test chains the two ATCs of a story and has finished Runs; archived | AC-05 5.1 |

## 2. ATC Contract
```typescript
@atc('BK-2150')
async expectArchivedTestAsEvidence(args: { projectSlug: string, storyId: string, testTitle: string, atcTitles: string[] }): Promise<void> {
  await this.goto({ projectSlug: args.projectSlug, storyId: args.storyId });
  const chain = this.page.getByTestId('traceability-chain-view');
  for (const atcTitle of args.atcTitles) {
    const row = chain.getByRole('row').filter({ hasText: atcTitle });
    await expect(row).toContainText(args.testTitle);
    await expect(row.getByTestId('traceability-test-archived')).toBeVisible();
    await expect(row).not.toContainText('No test written yet');
  }
}
```

## 3B. UI Details
Ids `traceability-chain-view`, `traceability-test-archived`. Row structure (table or list) confirmed at Code time; the locator above is a placeholder shape. Route takes the story id (`?story=` on the API).

## 4. Assertions Split
### Fixed (inside ATC)
Both ATC rows keep the Test with the archived marker and never read "No test written yet".
### Test-level (in test file)
`GET /projects/{id}/traceability?story={id}` still lists the Test and its latest Run under both ATCs (typed with `StoryTraceabilityPayload`); the archive is done with `TestsApi.archiveTest`.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| AC-05 5.1 | EP (single partition: archived Test with Runs) | 1 |

The never-run variant (5.2) is BK-2182, Deferred. Reduction: none.

## 7. Dependencies
- `TestSeedSteps.seedTest` with ATCs bound to the generated story's criteria and finished Runs
- Components: TraceabilityPage NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Story, 2 ATCs bound to its criteria, Test with Runs | Generate | `StructureApi`, `AtcsApi`, `TestsApi`, `RunsApi` | test | Test ends archived |

## 9. Checklist
- [ ] expectArchivedTestAsEvidence naming
- [ ] One object param
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
