# BK-572-T01: Workspace member removal (regression automation)

| Field | Value |
|-------|-------|
| **Priority** | P0 (TC6, TC7, TC14, TC28) / P1 (TC15) |
| **Phase** | Standalone (ticket-driven, Medium) |
| **Items** | 5 TCs (3 of them parameterized: TC7 x2 rows, TC15 x7 rows, TC28 x5 rows) |
| **Dependencies** | None between tickets. Follow-ups BK-1684..BK-1687 (Improvements) may change the contract of TC28 rows only if BK-1685 is decided toward "Admin may delete a lower-rank row" (none of the 5 rows targets a lower-rank row, so they hold either way) |
| **Requires** | Staging fixture workspace with the 4 role accounts active (owner / admin / member / viewer), the Member owning/belonging to a second workspace, Supabase data-API URL + anon key for TC28 (see automation-plan §9 BLOCKER B1) |
| **Source** | Story: BK-572 (TMS-Workspace, Remove a teammate from a workspace), Epic BK-1 |

## Summary

Automates the five signed Candidate Tests of the regression flows of BK-572: the UI removal journey, the atomic effects of the DELETE endpoint (shared oracle, N~2), the two role-ladder refusals, and the direct data-API write guard. The first two flows are destructive: they consume the fixture Member and re-admit them in teardown. The other two flows are read-only refusals.

## Test Cases

> Bodies live in Jira. Synced copies sit under the Story's `test-cases/`
> (`.context/PBI/epics/EPIC-BK-1-tenancy-identity/stories/STORY-BK-572-*/test-cases/`).
> The Xray Gherkin (incl. the Examples tables that drive the parameterized rows) is NOT in the sync:
> read it with `bun xray test get <KEY>` (read-only).

| TMS ID | Title (short) | Type | Priority | Flow (RTP-BK-831) | Jira tags |
|--------|---------------|------|----------|-------------------|-----------|
| BK-1656 (TC6) | should end the Member's access at once and keep their other workspace when the Owner confirms the removal in the UI | Positive, UI | P0 | Workspace member removal: UI | @critical @smoke @regression |
| BK-1657 (TC7) | should answer 200 with counts and revoke only the workspace-scoped PATs ... (absorbs TC20 caller channel + TC8 held Bugs) | Positive, API | P0 | Workspace member removal: atomic effects | @critical @regression |
| BK-1664 (TC14) | should refuse with 403 cannot_remove_owner and change nothing when an Admin removes the Owner | Negative, API | P0 | Role-ladder refusals | @critical @smoke @regression |
| BK-1665 (TC15) | should refuse with 403 not_a_member for any target, including themselves, when a Member or a Viewer calls | Negative, API | P1 | Role-ladder refusals | @high @regression |
| BK-1678 (TC28) | should leave the Owner row intact and gain nothing when an Admin or the Owner writes the workspace members directly through the data API | Negative, data API | P0 | Direct data-API write guard | @critical @regression |

## Automation Plan

**Order** (file order inside `tests/`, Playwright runs files alphabetically with `workers: 1`):
1. Read-only refusals first (`refuseMemberRemoval`, `guardMembersTableWrites`): they prove the fixture is healthy and change nothing.
2. Destructive flows last (`removeMemberAtomically`, then `removeMemberViaUi` in the `e2e` project): each re-admits the Member in teardown and verifies the roster is back to 4 before the next test.

**Shared fixtures**:
- Role sessions (owner, admin, member, viewer) created once per run by a new setup project; every spec opens its callers from them (automation-plan §2, §9).
- `MemberRemovalSteps` (new Steps class): discover the fixture workspace, provision a removable Member (PATs, held Bugs), re-admit the Member. Used by TC6 and both TC7 rows.
- TC7 is the oracle for the side effects TC6 deliberately does not re-assert (RTP "Shared component" note).

**Blocked by**:
- B1: TC28 needs the Supabase data-API base URL and anon (public) key for staging in the env schema. Nothing else blocks.
- Spike S1 (cookie session from headless signin on an `APIRequestContext`) gates every role-based spec; fallback is a UI-login storageState per role (automation-plan §9, O1).

**Preconditions for the whole scope**: see automation-plan §4 (Discover / Modify / Generate per TC). Never hardcode ids or workspace names; everything is discovered at runtime from the role accounts' own emails.

## Merged TCs

| Removed ID | Merged Into | Reason |
|------------|-------------|--------|
| BK-1670 (TC20) | BK-1657 | Caller channel (Owner session vs bound workspace:admin PAT) is the Scenario Outline of TC7. Stays Deferred as a standalone Test. |
| BK-1658 (TC8) | BK-1657 | Held-Bug assertions are written by the same transaction. Stays Deferred as a standalone Test. |

## Updated TCs

None.

## Out of scope (listed, not a stop)

Deferred or Manual TCs of the same Story are not planned here: TC1-TC5, TC8-TC13, TC16-TC27, TC29 (BK-1651..1655, 1658..1663, 1666..1677, 1679) other than the two absorbed above. No Test is created or scored by this skill.

## TC source gate (evidence and limits)

- Status `Candidate` on all five: confirmed from the synced `test-cases/TEST-BK-{1656,1657,1664,1665,1678}-*.md` and `bun xray test get`.
- The `Verdict signed:` ROI comment and its `created`/`updated` timestamps against this run's start were asserted by the requester and NOT re-read in this planning pass. The Code phase re-runs the gate from Jira before opening any TC lifecycle transition.

## Acceptance Criteria

- [ ] 5 TCs automated: 4 API/data-API ATCs and 1 UI ATC, each `@atc('<TC key>')`, no ATC calling another ATC
- [ ] Parameterized rows cover every Gherkin Examples row (TC7: 2, TC15: 7, TC28: 5)
- [ ] Destructive specs leave the fixture workspace with its starting 4 active members (verified by roster)
- [ ] Tests pass on staging (the only environment with the fixture); local env is not provisioned for this fixture
- [ ] `bun run test`, `bun run types:check`, `bun run lint:check`, `bun run kata:manifest:check` clean
