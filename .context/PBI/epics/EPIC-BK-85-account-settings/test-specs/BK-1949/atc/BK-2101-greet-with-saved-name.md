# ATC Spec: BK-2101 — Greet with the saved name as plain text

> Ticket: BK-2101 (TC2, absorbs TC11 BK-2110), Story BK-1949
> Component: AccountPage (tests/components/ui/AccountPage.ts), new
> Type: UI — Positive / Edge
> Parent Story: BK-1949 (AC 1.2, AC 2.7, PO1, D5, edge 16)

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should greet on Home with the full saved name as literal plain text given a saved display name | The banner shows the whole saved name; markup, email and URL stay text | Owner signed in; name saved through the API arrange | AC 1.2, AC 2.7 |

## 2. ATC Contract
```typescript
@atc('BK-2101')
async greetWithSavedName(args: {
  savedName: string,
  greeting: string,
}): Promise<void>
```
Fixed assertions:
- on `/home`: `home-welcome-greeting` has exactly the text `args.greeting` (literal row value)
- inside the greeting: `locator('b, img, a')` count 0
- on `/settings/account`: `identity-display-name` has exactly the text `args.savedName`, and `locator('b, img, a')` inside it is count 0

## 3B. UI Details
Pages `/home`, `/settings/account`. Test ids `home-welcome-greeting`, `identity-display-name`. React renders the name as a text node. `welcomeGreeting` appends the final period unless the name ends in `.`, `!` or `?`: no row ends so, and the generated name never does. Preconditions call `goto` helpers before the ATC; the ATC navigates by `page.goto` for its two pages.

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- none; `readStoredName()` is not needed (the page is the oracle)

## 5. Parameter table (literal, from the TC)
| # | savedName | greeting |
|---|-----------|----------|
| 1 | generated | `'Welcome back, ' + savedName + '.'` built from the generated input in the test |
| 2 | `<b>Elena</b>` | `Welcome back, <b>Elena</b>.` |
| 3 | `<img src=x>` | `Welcome back, <img src=x>.` |
| 4 | `elena@example.com` | `Welcome back, elena@example.com.` |
| 5 | `https://example.com` | `Welcome back, https://example.com.` |

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| 1.2, 2.7 | EP (name kinds) + Decision Table rule 1 | 1 parameterized ATC, 5 rows (one outcome: literal greeting) |

## 7. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| Saved name | Modify | `saveName` through `DisplayNameSteps.forBrowser` | per row | restore in `afterAll` |

## 8. Checklist
- [ ] Locators by test id and tag only, no `nth-child`
- [ ] Greeting literals typed in the table (row 1 built from the generated input, not read from the page)
- [ ] Not duplicating an existing ATC (BK-2101 free); BK-2110 has no ATC of its own
- [ ] No comments in code
