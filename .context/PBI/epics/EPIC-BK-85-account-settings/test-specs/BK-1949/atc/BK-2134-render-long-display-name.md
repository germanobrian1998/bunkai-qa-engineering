# ATC Spec: BK-2134 — Render an 80-character name without overflow

> Ticket: BK-2134 (TC35), Story BK-1949
> Component: AccountPage, new
> Type: UI — Boundary / Layout
> Parent Story: BK-1949 (edge 13), regression guard of BK-2244

## 1. Test Case Summary
| Name | Objective | Precondition | Acceptance Criteria |
|------|-----------|--------------|---------------------|
| should render an 80-character name readable without overflow in the identity card and the banner given the longest accepted name | The longest accepted name wraps inside its containers on desktop and mobile | Owner signed in; 80-character name saved | Edge 13, BK-2244 |

## 2. ATC Contract
```typescript
@atc('BK-2134')
async renderLongDisplayName(args: {
  name: string,
  viewport: { width: number, height: number },
}): Promise<void>
```
Fixed assertions (after `setViewportSize`; each page is measured settled: `document.fonts.ready` resolved and, on Home, every `home-*-skeleton` gone, so late `<Suspense>` sections cannot shift the geometry):
- `/settings/account`: `identity-display-name` contains `args.name`; its own `scrollWidth` is not above its `clientWidth` and its own `scrollHeight` is not above its `clientHeight` (both polled); its bounding box is inside `identity-card`'s; the page scroll container has no horizontal overflow and the name sits inside it
- `/home`: `home-welcome-greeting` contains `args.name`; its own `scrollWidth` is not above its `clientWidth` and its own `scrollHeight` is not above its `clientHeight` (both polled); the page scroll container has no horizontal overflow (`scrollWidth` not above `clientWidth`, polled)

Why these oracles:
- The app shell is `h-dvh overflow-hidden`, so `document.documentElement.scrollWidth` can never exceed `clientWidth` and proves nothing. The real scrolling happens in an inner container (Home `overflow-auto`, Settings `overflow-y-auto`, which computes `overflow-x: auto`). The page check finds it from the target element as the nearest ancestor whose computed `overflow-x` is `auto` or `scroll`, and asserts `scrollWidth <= clientWidth` on it (polled).
- The banner box is not asserted against the scroll container: it is a stretched child of a `w-full` column, so its box can never escape the container and the check is dead. The scroll container's own `scrollWidth` is the oracle that nothing pushes the page wider.
- The greeting is a stretched flex-col child of the banner, so its box always equals the banner's and a box check would prove nothing. Its own `scrollWidth <= clientWidth` is the oracle that the name wraps instead of overflowing, and `scrollHeight <= clientHeight` catches vertical clipping (neither element has a fixed height in the product markup, so a clipped name is a regression).

## 3B. UI Details
Containment uses `locator.boundingBox()` of the element and its container (no positional CSS). Both name elements carry `break-words`. Viewports 1280 x 800 and 375 x 812 are the TC's proposal (`DISPLAY_NAME_VIEWPORTS`).

## 4. Assertions Split
### Fixed: section 2.
### Test-level
- none

## 5. Parameter table (literal, from the TC)
| # | name | viewport |
|---|------|----------|
| 1 | `'W'.repeat(80)` | desktop |
| 2 | `'W'.repeat(80)` | mobile |
| 3 | `'Elena '.repeat(14).slice(0, 80)` | desktop |
| 4 | `'Elena '.repeat(14).slice(0, 80)` | mobile |

`'Elena '.repeat(14).slice(0, 80)` ends on `El` (13 repeats of 6 characters plus 2), so trimming cannot shorten it below 80.

## 6. Technique-derivation check
| AC | Technique fired | ATCs produced |
|----|-----------------|---------------|
| Edge 13 | BVA upper edge (80) x EP (no break opportunity vs spaces) x viewport | 1 parameterized ATC, 4 rows |

## 7. Data Context
| Precondition | Pattern | Source | Placement | Cleanup |
|--------------|---------|--------|-----------|---------|
| 80-character name saved | Modify | `saveName` | per row | restore in `afterAll`; viewport reset by the per-test page |

## 8. Checklist
- [ ] Oracle is geometry from the TC (no overflow, no scroll), not a recomputed expectation from the response
- [ ] No positional selectors or svg counts
- [ ] Not duplicating an existing ATC (BK-2134 free)
- [ ] No comments in code
