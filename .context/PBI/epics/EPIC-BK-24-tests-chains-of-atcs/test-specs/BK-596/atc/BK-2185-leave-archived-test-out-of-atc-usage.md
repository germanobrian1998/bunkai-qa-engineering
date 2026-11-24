# ATC Spec: BK-2185 - ATC "used in" leaves out archived Tests

> Ticket: BK-2185 (TC46, regression of BK-2240)
> Component: AtcDetailPage (tests/components/ui/AtcDetailPage.ts), NEW
> Type: UI - Verification
> Parent Story: BK-596

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should leave an archived Test out of an ATC detail "used in" list and its count given the ATC is chained by it | Archived Tests are not offered as usage; list and count agree with the library | ATC C chained by live Siblings S1, S2 and archived S3; ATC C live or archived | Divergence 1 (BK-2240) |

## 2. ATC Contract
```typescript
@atc('BK-2185')
async expectUsageOfLiveTestsOnly(args: { atcId: string, liveTitles: string[], archivedTitle: string }): Promise<void> {
  await this.goto({ atcId: args.atcId });
  const usage = this.page.getByTestId('atc-usage');
  for (const title of args.liveTitles) {
    await expect(usage).toContainText(title);
  }
  await expect(usage).not.toContainText(args.archivedTitle);
  await expect(this.page.getByTestId('atc-usage-count')).toContainText(String(args.liveTitles.length));
}
```

## 3B. UI Details
Ids `atc-usage`, `atc-usage-count`. The archived ATC is reached through its own address (`ArchivedAtcDetail`); the same ids are asserted there. Route to the ATC detail page found at Code time.

## 4. Assertions Split
### Fixed (inside ATC)
Live chaining Tests listed, archived sibling omitted, count equals the live Tests.
### Test-level (in test file)
Count consistent with the ATC library count (`AtcsApi.readAtcUsage`); sibling 3 archived with `TestsApi.archiveTest` and restored in teardown; for the archived row the ATC is archived with `AtcsApi.archiveAtc`.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| Divergence 1 | EP on ATC state | 1 parameterized |

| Parameterized ATC | Reduction applied | Rows after reduction |
|-------------------|-------------------|----------------------|
| expectUsageOfLiveTestsOnly | none | 2 (ATC live, ATC archived) |

## 7. Dependencies
- `TestSeedSteps.seedSiblings({ count: 3, sharedAtc: true })`
- Components: AtcDetailPage NEW, AtcsApi NEW

## 8. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| ATC chained by 3 Tests, one archived | Generate | API | test (per row) | restore sibling 3; the archived-ATC row ends with the ATC archived |

## 9. Checklist
- [ ] expectUsageOfLiveTestsOnly naming
- [ ] One object param
- [ ] void return
- [ ] Fixed vs test-level split
- [ ] Not duplicating an existing ATC
