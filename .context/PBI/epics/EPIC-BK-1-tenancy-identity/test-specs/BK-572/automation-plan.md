# Test Automation Plan: BK-572

> Ticket: BK-572 — TMS-Workspace | Remove a teammate from a workspace
> Type: integration (4 ATCs) + e2e (1 ATC)
> Sprint: n/a (regression automation of a QA-approved Story)
> Created: 2026-11-14
> Status: draft, awaiting approval (Phase 1 gate)

## 1. Ticket Summary

- What to test: the regression flows of BK-572 as signed Candidates BK-1656, BK-1657, BK-1664, BK-1665, BK-1678 (spec.md).
- Acceptance criteria covered: AC-02, AC-03, AC-06, AC-07, AC-08, AC-09 (author intact), AC-16 (end of access, second workspace), AC-17 (ladder row admin to owner), AC-18/AC-19/E7 (data layer).
- Endpoint under test: `DELETE /api/v1/workspaces/{id}/members/{userId}` (200 `WorkspaceMemberRemoveResponse` with `removed_user_id`, `removed_role`, `revoked_token_count`, `unassigned_bug_count`, `revoked_invite_count`; 403 `not_a_member` / `cannot_remove_owner`; 409 `cannot_remove_self`). Types already in `api/openapi-types.ts` (no `api:sync` needed; re-check at Code).
- Dependencies: none on other tickets. Live facts measured 2026-11-07 (staging): direct data-API DELETE/UPDATE/INSERT on `workspace_members` default-denied (403 / 42501, only a SELECT policy exists); errcodes 45220/45221 appear only via the direct RPC, the HTTP envelope carries `error.details.reason`.

## 2. Architecture Decisions

> ADR promotion check: decisions D1 and D2 below are architectural and hard to reverse (reused by every later multi-role ticket, e.g. BK-1686 follow-ups). They are flagged as ADR candidates in §10; no ADR is written by this plan.

### Component Strategy

| Decision | Value | Rationale |
|----------|-------|-----------|
| D1 Role sessions | One new Playwright setup project `role-sessions-setup` (`tests/setup/role-sessions.setup.ts`) signs in the 4 role accounts once per run and writes a cookie `storageState` per role (`.auth/role-<role>.json`, gitignored) plus the Supabase access token per role (TC28 only). Specs open each caller with `playwright.request.newContext({ storageState })`, wrap it in `new ApiFixture({ request })` (a fresh fixture carries no Bearer, so the cookie session is the credential used). | The endpoint needs `workspace:admin`. `api:login` PATs never carry it (403 `missing_capability`), and a `workspace:admin` PAT can only be minted through a cookie session by an Admin/Owner. A cookie session holds all four scopes and is the only credential a Member or Viewer can have for the refusal rows. Bearer always wins over cookie (`auth-model`); a fresh `ApiFixture` carries no Bearer, so cookie sessions are used. Signing in 4 times per run (vs ~10 per-file sign-ins) stays far from the brute-force throttle (10/60 s per source, 10/15 min per account). |
| D2 Consumable fixture | Destructive specs consume the fixture Member and own their restoration: the fixture is guarded by a roster oracle (4 role emails with their roles) that self-heals a missing Member or fails "fixture broken: ..." (no skip), checked at discovery and at the start of each destructive test; teardown re-admits (Owner issues invite, Member accepts), re-checks the oracle and revokes the PATs the test minted. Role specs live in opt-in `*-roles` projects (`e2e-roles`, `integration-roles`, `smoke-roles-ui`, `smoke-roles-api`) active only on staging. | Role accounts are shared, Execution already proved remove then re-invite works (TC23 path). `workers: 1`, no parallel contention. |
| D3 Components | Extend `WorkspaceApi`, `AuthApi`, `ApiFixture`, `UiFixture`. New: `InviteApi`, `BugApi`, `ActivityApi`, `MembersDataApi`, `MembersPage`, `MemberRemovalSteps`. No existing component duplicated (anti-duplication pre-flight, §3). | One component per resource (KATA layer 3). Tokens extend `AuthApi` (identity tokens group). |
| D4 Setup mutations | Provisioning calls (issue invite, accept invite, mint/revoke PAT, create/assign Bug) are `@step` helpers named `provision*`/`revoke*`, NOT `@atc`. | They are preconditions, no signed TC owns them (TC23 re-admit is Deferred). Rule 7 says state-changing = ATC; this is a deliberate, flagged exception (Open question O2). |
| D5 Verification surface | Database assertions in the TCs ("membership no longer in the database", "no notification row") are verified through API proxies (roster, `/me`, `GET /workspaces/{id}`, bug read, activity feed, notifications inbox). | The test stack has no DB client; `dbhub` is a read-only MCP for the AI, not for test code (Open question O3). |
| Fixture | TC6 `{ test }` (UI for the Owner, API for setup/verification); TC7, TC14, TC15, TC28 `{ api }` (no browser) plus role contexts created from the `playwright` fixture | Fixture selection rule |
| Test files | `tests/e2e/workspace/members/removeMemberViaUi.test.ts`, `tests/integration/workspace/members/removeMemberAtomically.test.ts`, `tests/integration/workspace/members/refuseMemberRemoval.test.ts` (TC14 + TC15, one flow), `tests/integration/workspace/members/guardMembersTableWrites.test.ts` (deferred with TC28) | `{verbFeature}.test.ts`; flow grouping = spec file (RTP) |
| Preconditions | Steps module `MemberRemovalSteps` (`tests/components/steps/`), instantiated in the tests, not registered in a fixture | Used by TC6 and both TC7 rows (3 call sites), each needing the same 3 setup blocks |

### [E2E ONLY] UI Elements (TC6, `MembersPage`)

Route: `/workspaces/{workspaceId}/members` (Owner sees every row). Locators inline in the ATC, to be confirmed with `/playwright-cli` snapshot at Code time (O6).

| Element | Locator Strategy | Locator Value |
|---------|------------------|---------------|
| Member row | role/text | row containing the Member's email (rows show email primary; `(you)` on the caller's own row) |
| Remove control | role + accessible name | `getByRole('button', { name: 'Remove <email>' })` (D56: accessible name `Remove <email>`, ghost small, absent when the ladder forbids) |
| Confirmation | role | `getByRole('alertdialog')` (modelled on RevokeTokenModal: focus on Cancel, `aria-busy`, stays open on 5xx); must name the email |
| Confirm button | role | inside the alertdialog; label to be read from the live app (O6) |

### [INTEGRATION ONLY] API Details

| Aspect | Value |
|--------|-------|
| Endpoint(s) | `DELETE /api/v1/workspaces/{id}/members/{userId}` (under test); helpers: `GET /v1/workspaces/{id}/chat/roster` (members list, cookie or PAT, no scope), `GET /v1/me`, `GET /v1/workspaces`, `GET /v1/workspaces/{id}`, `POST /v1/workspaces/{id}/invites`, `POST /v1/invites/accept`, `POST/DELETE /v1/tokens`, `GET /v1/projects/{id}/bugs` or `GET /v1/bugs`, `POST /v1/bugs`, `POST /v1/bugs/{id}/assign`, `GET /v1/bugs/{id}`, `GET /v1/activity`, `GET /v1/workspaces/{id}/notifications`; data API (TC28): `DELETE/PATCH/POST <supabase>/rest/v1/workspace_members` |
| OpenAPI Type(s) | `WorkspaceMemberRemoveResponse`, `ChatMember`, `CreateTokenBody`, `WorkspaceInviteCreateBody`, `InviteAcceptBody`, `BugAssignBody`, `BugDetail`, `ActivityPage` (`ActivityItemMemberRemoved`, `ActivityItemBugUnassigned`), `ErrorEnvelope`; facade additions in `api/schemas/workspace.types.ts` |
| Auth Required | Yes. Cookie session per role (D1). TC7 PAT row: Owner `workspace:admin` PAT bound to the fixture workspace, minted with the Owner cookie |
| Return Pattern | DELETE/GET `[APIResponse, TBody]`, POST `[APIResponse, TBody, TPayload]` |

## 3. ATC Registry

Anti-duplication pre-flight (kata-manifest.json, generated 2026-11-14): existing ATC ids are BK-311, BK-312 (AuthApi), BK-313, BK-314 (LoginPage). None of BK-1656, BK-1657, BK-1664, BK-1665, BK-1678 is taken. Existing components: AuthApi, WorkspaceApi (0 ATCs), LoginPage. No proposed component name collides (`InviteApi`, `BugApi`, `ActivityApi`, `MembersDataApi`, `MembersPage` are new; `MemberRemovalSteps` is the first Steps class, the manifest lists none).

### Existing ATCs (Reuse)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| BK-311 | AuthApi | `authenticateSuccessfully` | Not reused as an ATC call: the setup project signs in with the same endpoint through a role-aware helper so each role gets its own cookie jar (avoids a Bearer being set). Listed to show the overlap was checked. |

### New ATCs (Create)

| ATC ID | Component | Method | Description |
|--------|-----------|--------|-------------|
| BK-1656 | MembersPage (ui) | `removeMemberViaConfirmation({ memberEmail })` | Owner selects Remove on the Member row, the dialog names the Member, confirms, the row disappears (fixed assertions). |
| BK-1657 | WorkspaceApi (api) | `removeMemberSuccessfully({ workspaceId, memberUserId })` | DELETE, fixed: 200, body counts defined, `removed_user_id` equals target, roster no longer lists the target. |
| BK-1664 | WorkspaceApi (api) | `removeOwnerAsAdminRefused({ workspaceId, ownerUserId })` | DELETE as Admin, fixed: 403, `error.details.reason === 'cannot_remove_owner'`, roster still lists the Owner. |
| BK-1665 | WorkspaceApi (api) | `removeMemberRefusedBelowAdmin({ workspaceId, targetUserId })` | DELETE as Member/Viewer, fixed: 403, `details.reason === 'not_a_member'` (never `missing_capability`), roster size unchanged. |
| BK-1678 | MembersDataApi (api) | `writeMembersRowDenied({ operation, workspaceId, userId })` | Direct data-API DELETE/PATCH/POST on `workspace_members`, fixed: 403 and body `code === '42501'`. |

### New Helpers (No @atc)

| Component | Method | Returns | Description |
|-----------|--------|---------|-------------|
| WorkspaceApi | `listMembers(workspaceId)` | `[APIResponse, { members: ChatMember[] }]` | Roster read (members list). |
| WorkspaceApi | `getWorkspace` (exists) | | 404 probe for the removed Member. |
| WorkspaceApi | `listWorkspaces` (exists) | | Member still sees second workspace. |
| AuthApi | `getCurrentUser` (exists) | | Workspaces of the caller. |
| AuthApi | `provisionToken({ scopes, workspaceId?, expiresInDays })` | `[APIResponse, CreateTokenResponse, CreateTokenBody]` | `POST /v1/tokens` (cookie only). `@step`, D4. |
| AuthApi | `revokeToken(tokenId)` | `[APIResponse, body]` | `DELETE /v1/tokens/{id}` teardown. `@step`. |
| InviteApi | `provisionInvite({ workspaceId, email, role })` | `[APIResponse, invite+token, payload]` | Owner/Admin invite. `@step`. |
| InviteApi | `provisionAcceptance(token)` | `[APIResponse, body, payload]` | Invitee accepts. `@step`. |
| BugApi | `listUnassignedBugs(projectId)`, `getBug(id)`, `provisionBug(...)`, `provisionAssignment({ bugId, assigneeUserId })` | tuples | Discover/Modify/Generate of held Bugs. `@step`. |
| ActivityApi | `listActivity(workspaceId)`, `listNotifications(workspaceId)` | tuples | Feed and inbox reads for delta assertions. |
| ApiFixture | `invite`, `bug`, `activity` registered (`membersData` deferred with TC28: code extracted to `.session/test-automation/BK-572/tc28-data-guard.patch`; TC28/BK-1678 stays deferred until `STAGING_SUPABASE_ANON_KEY` is available); `setAuthToken`/`clearAuthToken` propagate to all | | Fixture registration. |
| MemberRemovalSteps | `openRoleSession(playwright, role)`, `discoverFixture(...)`, `provisionRemovableMember(...)`, `readmitMember(...)` | typed objects | See §4. |

## 4. Test Data Strategy

Priority: Discover, then Modify, then Generate. No ids, names or emails hardcoded; role emails come from the env schema by variable name (`STAGING_USER_*` = owner, `STAGING_ADMIN_*`, `STAGING_MEMBER_*`, `STAGING_VIEWER_*`, to be exposed through `config/variables.ts`).

| Data | Pattern | Source | Lifecycle |
|------|---------|--------|-----------|
| Fixture workspace | Discover | Owner `GET /v1/workspaces`, keep the one whose roster holds the 4 role emails (distinct from any other workspace). Discovery runs once per describe | `beforeAll`, none |
| Role user ids | Discover | roster by email | `beforeAll`, none |
| Member's second workspace | Discover | Member context `GET /v1/me`: a workspace other than the fixture; none found: `test.skip` with reason | `beforeAll`, none |
| Held Bugs (TC7, 3) | Discover then Modify | unassigned Bugs in a project of the fixture workspace (the leftover `bk-572-fixture-project` qualifies, found by listing, never by id); assign 3 to the Member as Owner. Removal unassigns them again, so the state is self-restoring. Fewer than 3 unassigned: Generate the missing ones (`POST /v1/bugs` standalone, needs a module found via `GET /projects/{id}/modules`) | inline in the test, none needed (removal restores) |
| Member-authored Bug (TC7) | Discover then Generate | Bug whose `created_by` is the Member; if none exists, the Member files one once (no delete endpoint exists, a one-time residue) | `beforeAll` |
| Member scoped PAT + global PAT (TC7) | Generate | Member cookie `POST /v1/tokens` (`atc:read`, `workspace_id` set / absent, `expires_in_days: 1`) | inline in the test; scoped one is revoked by the removal; global one revoked in the `finally` teardown |
| Owner `workspace:admin` PAT (TC7 PAT row) | Generate | Owner cookie `POST /v1/tokens` with `scopes: ['workspace:admin']` and `workspace_id` | inline in the test (that row only); revoked in the `finally` teardown |
| Removable Member (TC6, TC7) | Discover + restore | the Member from the roster; after the test: Owner `POST /v1/workspaces/{id}/invites` role `member`, Member `POST /v1/invites/accept` (same path as TC23), roster must show 4 active again. `invite_already_pending` / `email_already_member` (409) on a rerun means a previous teardown failed: handled by `ensureFixtureHealthy`, first step of each destructive test (self-heals a missing Member, else fails "fixture broken", never skips) | `steps.teardown` in a `finally`, with independent steps so it runs on failure |
| Baseline snapshot for "unchanged" (TC14, TC15, TC7 bugs/activity) | Discover | roster, activity feed page and Owner/Member notification inbox read before the call, compared after | inline |
| Data-API access (TC28) | Generate (per-run read) | Supabase access token of the caller written by the setup project; base URL + anon key from env (B1) | `beforeAll` |
| Rows for parameterized tests | Fixed in the spec | TC7 channel rows, TC15 role/target rows, TC28 operation rows (taken verbatim from the Jira Gherkin) | n/a |

Residue after a full run: new `workspace_invites` history rows and a new `joined_at` for the Member (expected, same as Execution); no leftover PATs, Bugs or members.

### Decision table reduction (TC15, TC28)

TC15 (caller role x target), taken from the Jira Examples, no further reduction applied: Member -> Viewer / Admin / Member; Viewer -> Member / Viewer; Member -> self; Viewer -> self (7 rows). TC28: Admin DELETE Owner row; Admin DELETE own row; Owner DELETE own row; Admin UPDATE Owner role to member; Admin INSERT owner row (5 rows). No pairwise: fewer than 3 combinable factors.

## 5. Test Scenarios

### File: tests/integration/workspace/members/refuseMemberRemoval.test.ts
Fixture: `{ api }` + role contexts. Read-only.

#### Scenario 1 (TC14)
Test: `BK-1664: should refuse with 403 cannot_remove_owner and change nothing when an Admin removes the Owner given a workspace with four active members` (tag `@critical @smoke @regression`)
Preconditions: fixture discovered, Admin cookie context, baseline roster + activity page.
ATCs called: `removeOwnerAsAdminRefused`.
Test-level assertions: roster identical, no `member.removed` item newer than the baseline, Owner still has role `owner`.
Teardown: none.

#### Scenario 2 (TC15, 7 parameterized tests, one per Examples row)
Test: `BK-1665: should refuse with 403 not_a_member when a <role> removes <target>` (tag `@high @regression`)
ATCs called: `removeMemberRefusedBelowAdmin`.
Test-level assertions: roster identical, no `member.removed` item newer than baseline, Member/Viewer notification and token state untouched where cheap to read (roster + activity are the contract).
Teardown: none.

### File: tests/integration/workspace/members/guardMembersTableWrites.test.ts
Fixture: `{ api }` + role contexts. Read-only unless the guard fails.

#### Scenario 3 (TC28, 5 parameterized tests)
Test: `BK-1678: should deny <operation> as <caller> and leave the Owner row intact` (tag `@critical @regression`)
Preconditions: Owner row read first through the roster (role + presence recorded); caller context + Supabase token.
ATCs called: `writeMembersRowDenied`.
Test-level assertions: roster still lists the Owner as `owner`; the caller's own row unchanged; no escalation (caller role unchanged).
Teardown: none expected. If a write unexpectedly succeeds, the test FAILS and the failing message states the Owner row must be restored manually before any further run (no automated repair: the caller has no restore route and none may be invented).

### File: tests/integration/workspace/members/removeMemberAtomically.test.ts
Fixture: `{ api }` + role contexts. Destructive.

#### Scenario 4 (TC7, Scenario Outline over caller: 2 tests)
Test: `BK-1657: should answer 200 with counts and revoke only the workspace-scoped PATs when <caller> removes a Member given the Member holds one scoped PAT and one global PAT` (tag `@critical @regression`)
Rows: Owner session (cookie context); Owner `workspace:admin` PAT bound to the workspace (Bearer on the same context).
Preconditions (Steps): Member removable and healthy, scoped + global PAT, 3 Bugs assigned, member-authored Bug known, baselines of activity and both notification inboxes.
ATCs called: `removeMemberSuccessfully`.
Test-level assertions: `revoked_token_count` 1, `unassigned_bug_count` 3 (`revoked_invite_count` 0); scoped PAT -> 401 "Invalid token"; global PAT -> 200 on `GET /v1/workspaces`, second workspace listed, fixture workspace absent; 3 held Bugs `assignee_user_id` null; exactly 3 new `bug.unassigned` items (one per Bug) and exactly 1 new `member.removed` item whose actor is the caller; Owner and Member inboxes unchanged in size; the authored Bug still returned with `created_by` = Member.
Teardown: re-admit Member, revoke the global PAT (and the Owner `workspace:admin` PAT), roster = 4.

### File: tests/e2e/workspace/members/removeMemberViaUi.test.ts
Fixture: `{ test }` (Owner storage state from `ui-setup`; Member and second workspace through API contexts). Destructive.

#### Scenario 5 (TC6)
Test: `BK-1656: should end the Member's access at once and keep their other workspace when the Owner confirms the removal in the UI` (tag `@critical @smoke @regression`)
Preconditions (Steps): Member removable and healthy; Owner has the fixture workspace active (navigate to its Members screen).
ATCs called: `ui.members.removeMemberViaConfirmation`.
Test-level assertions (API proxies of the DB/next-load checks, D5): roster no longer lists the Member; Member context `GET /v1/workspaces/{id}` is 404 and `GET /v1/me` omits the fixture workspace; the second workspace is still listed. Token and Bug side effects are NOT asserted here (TC7 is the oracle, per the TC).
Teardown: re-admit Member, roster = 4.

## 6. Implementation Order

One commit per box (work-unit commits, sdet strategy: ticket branch `test/BK-572-*` off the suite trunk, done by `/git-flow-master`):

- [ ] Env + config: `config/variables.ts` role credential map (project-owned) and non-sensitive data-API entries (after B1), `.env.schema` entries by NAME only
- [ ] Setup: `tests/setup/role-sessions.setup.ts` + project `role-sessions-setup` in `playwright.config.ts`, added as a dependency of the opt-in `integration-roles`, `e2e-roles`, `smoke-roles-api`, `smoke-roles-ui` projects, active only on staging (owner authorization needed, O4)
- [ ] Types/facades in `api/schemas/workspace.types.ts` (re-export the new response/request types)
- [ ] `AuthApi` helpers, `InviteApi`, `BugApi`, `ActivityApi` (+ `ApiFixture` registration and token propagation)
- [ ] `WorkspaceApi` ATCs BK-1657, BK-1664, BK-1665 + `listMembers`
- [ ] `MemberRemovalSteps`
- [ ] Spike S1 first (before the above is built on it): headless signin on an `APIRequestContext` yields a cookie session that the removal route accepts with no Bearer; if not, switch D1 to UI-login storageState per role (O1)
- [ ] Spec `refuseMemberRemoval.test.ts` (TC14, TC15), run on staging
- [ ] `MembersDataApi` + spec `guardMembersTableWrites.test.ts` (TC28), run on staging
- [ ] Spec `removeMemberAtomically.test.ts` (TC7), run on staging, verify the roster returns to 4
- [ ] `MembersPage` + `UiFixture` registration + spec `removeMemberViaUi.test.ts` (TC6)
- [ ] `bun run kata:manifest`, stage `kata-manifest.json`, `bun run kata:manifest:check`
- [ ] Review gate: `bun run test <path>`, `bun run types:check`, `bun run lint:check`, then `/pr-review-lead` or `/judgment-day` in clean context; TC lifecycle transitions through `/test-documentation` per SKILL.md

## 7. Success Criteria

- [ ] All 5 TCs covered, every Gherkin Examples row present. The ACs are the floor: beyond-AC risk of this ticket (second Owner/Admin, failpoint rollback, concurrent removal, E1-E8) sits in Deferred TCs that this skill may not promote (TC source gate); noted, not added.
- [ ] BVA: N/A (no ranges, limits or date windows in these TCs).
- [ ] Refusal assertions pin `details.reason`, never only the status (a PAT without `workspace:admin` also yields 403, `missing_capability`).
- [ ] KATA compliance, correct fixtures, no hardcoded waits, aliases only, no relative imports
- [ ] Destructive specs verified to restore the roster to 4 active members, also when the test fails
- [ ] Tests pass locally against staging; TC moves to Pull Request on PR open, Automated only after the merge to the production branch

## 8. Test-Design Checklist (agentic-qa-core/references/test-design-doctrine.md Part 3)

| Item | Result |
|------|--------|
| P1/P2 beyond the AC floor | PASS with note: scope is five signed TCs. Risk-beyond-AC cases exist as Deferred TCs (TC10, TC12, TC13, TC26, TC27 unexecutable on staging) and cannot be added here. Within the five: refusals assert the reason string (not only the code), TC28 covers UPDATE/INSERT escalation, TC15 covers the self-target divergence |
| P3 concrete exploration | PASS: each ATC has Precondition + Action + Assertions (atc/*.md) |
| P4 1:N per AC | PASS: AC-17 row split into TC14 (admin to owner), TC15 (below admin), BK-1657 (success). AC-18 split by operation inside one parameterized ATC |
| P5 anomalies | PASS: self-target 403-not-409 divergence (TC15), 500-vs-4xx RPC finding not in scope (BK-1684) |
| EP | PASS: partitions = caller role below admin (TC15), admin vs owner (TC14), success channel (TC7), write operation (TC28) |
| BVA / BVA-D | N/A, no ranges or rounding |
| ST | N/A beyond the single member active -> removed transition (covered by TC6/TC7 plus re-admit in teardown) |
| DT | TC15 role x target table kept as in Jira (7 rows) |
| PW | N/A, fewer than 3 combinable factors |
| PARAM | PASS: TC7 2 rows, TC15 7 rows, TC28 5 rows, each ONE parameterized ATC (Xray aggregates per ATC key, FAILED if any row fails) |
| RISK | PASS: P0 destructive flows ordered last |
| OBS | PASS with BLOCKER B1: TC28 precondition (data-API URL + anon key) is not available to the framework yet |
| SEED | N/A: all preconditions come from the product flow (invite, token, assign) |

## 9. Blockers and Open Questions (each with the recommended answer)

| # | Type | Question | Recommended |
|---|------|----------|-------------|
| B1 | BLOCKER (TC28 only) | The data API lives on the Supabase host, not on `config.apiUrl`, and needs the project's anon (publishable) key. Neither exists in the env schema today. | Owner adds non-sensitive `STAGING_SUPABASE_URL` and `STAGING_SUPABASE_ANON_KEY` (the web client already ships both) to `.env.schema`/`.env`; the component overrides `apiEndpoint()` to that base. Without them TC28 stays unbuilt, the other four proceed. |
| O1 | Spike (gates D1) | Does a headless `POST /v1/auth/signin` on a fresh `APIRequestContext` leave a usable `sb-*` cookie that the removal route accepts with no Bearer? The API map says signin "also sets the cookie"; the repo's own `playwright.config.ts` comment documents the same effect. | Run S1 before any spec. Fallback: UI-login `storageState` per role (extend `ui-auth.setup.ts`). |
| O2 | Convention | Setup mutations (`provision*`) as `@step` helpers without `@atc` against Rule 7 (state change = ATC). | Accept as flagged exception: no signed TC owns them; promote to ATCs only when TC23 (re-admit) becomes a Candidate. |
| O3 | Scope | TC wording "in the database" / "no notification row" cannot be read by test code (no DB client, `dbhub` is read-only MCP). | Accept API proxies (D5); keep real DB evidence in the manual Stage 2 record. Do not add a Postgres client to the framework for this ticket. |
| O4 | Authorization | D1 edits `playwright.config.ts` (new setup project + dependencies) and `config/variables.ts` (role credential map). Both are project-owned, outside `tests/`. | Approve both within this ticket; if the owner prefers framework-level change, route the setup project through `/framework-development` first. |
| O5 | Risk | TC6, TC7, TC14 carry `@critical`, so `bun run test:smoke` becomes destructive (member removed and re-admitted). | Keep the Jira tags, rely on teardown + guard, and state it in the PR. Alternative if undesired: drop `@critical` from TC6/TC7 titles and keep `@regression` only. Owner decides.<br>Accepted cost: a plain full `bun run test` on staging (no `--project`) runs TC6 and TC14 twice (e2e-roles + smoke-roles-ui, integration-roles + smoke-roles-api), i.e. two remove/re-admit cycles for TC6. Accepted by the owner 2026-11-14; use the `package.json` scripts for targeted runs. |
| O6 | Discovery | Confirm button label and exact row markup of the Members screen. | Read with `/playwright-cli` snapshot at the start of the Code subagent for TC6; not a blocker. |
| O7 | Data | The only Member-authored Bug today is a leftover; if it is gone a one-time Bug is filed (no delete endpoint). | Accept one-time residue. |
| O8 | Sign-in budget | Per-run sign-ins: 4 (setup) + owner `api-setup` + owner `ui-setup` = 6, under the 10/min and 10/15 min per-account throttles. | Keep sign-ins in the setup project only; specs never sign in. Per-account budget matters too: the Owner signs in up to 3 times per run (ui-setup, api-setup, role-sessions-setup), so back-to-back test:e2e + test:integration + test:smoke can reach the 10/15 min per-account limit. |

## 10. ADR candidates (not written)

- ADR candidate A: Role-scoped API sessions via cookie `storageState` per role from a setup project (D1). Reused by every future multi-role or authorization ticket; hard to reverse once specs depend on it. Draft status `Proposed`, per `agentic-qa-core/references/adr-doctrine.md`.
- ADR candidate B: Consumable-fixture contract for destructive specs (D2): guard, restore-in-teardown, ordering, residue policy. Reused by 2+ tickets (BK-572 now, TC23/TC10/TC26 later).
