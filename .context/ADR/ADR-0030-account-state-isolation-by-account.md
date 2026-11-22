# ADR-0030 — Account-level profile state is isolated by account, with capture and restore

- **Status:** Proposed
- **Date:** 2026-11-22
- **Deciders:** Project owner, to approve (drafted during `/test-automation BK-1949` Code, 2026-11-22)
- **Tags:** test-data, isolation, fixtures, account-settings, auth-in-tests
- **Supersedes:** ADR-0010 (§Decision, account-level fields only)
- **Superseded by:** —

---

## Context

ADR-0010 isolates tests by data: each test creates uniquely named rows inside the shared QA workspace, so two tests never touch the same row. That rule cannot hold for a field that belongs to the account itself. The display name of BK-1949 is one value per account: `PUT` and `DELETE /api/v1/me/display-name` write it, `GET /api/v1/me` reads it, and there is no second row to pick a unique name for.

The suite has four fixed role accounts (Owner, Admin, Member, Viewer). Any test that writes the display name changes shared state that every later test of the same account sees. `playwright.config.ts` runs one worker today, but a future higher worker count, or two pipelines running at once, would race on the same field.

The write route is cookie-only (a personal access token is refused with 403), so the writers need cookie sessions. ADR-0018 gives those sessions: the shared setups sign each role in once, and no spec signs in on its own.

## Decision

Account-level profile state will be isolated by account, not by data.

1. Each test surface owns fixed accounts. The e2e surface writes only the Owner. The integration surface writes only Admin and Member. Within one run (`workers: 1`), the two surfaces never write the same account.
2. Every file that writes account state captures the original value of each account it writes in `beforeAll` and restores it in `afterAll` (`PUT` when the original is a string, `DELETE` when it is null). Exception: an original that matches the factory shape (`Kata ` prefix) is treated as no name and restored with `DELETE`. Every test that leaves a non-factory value on a shared account (BK-2101 rows 2-5, BK-2106, BK-2134) ends on a factory value: an `afterEach` saves `DataFactory.createDisplayName()` with no assertions, so the `Kata ` shape marks every leak the next run can self-heal. The same `afterAll` revokes every PAT it minted. Every restore and the revoke are attempted independently, and any error is thrown as one `AggregateError` after all were attempted, whether or not a test failed. Playwright reports an `afterAll` error separately from the test failure, so it does not mask it.
3. Every test arranges its own starting state, so a value leaked by an earlier failure cannot change the next test.
4. Integration files that share an account rely on `workers: 1` and `fullyParallel: false` for in-file order. They do not declare serial mode, so one failure does not hide the other TCs. Raising `workers` above 1 needs one account per concurrent file first.
5. The cookie sessions come from the shared role setups (ADR-0018). The integration files that need them are routed to the `integration-roles` project and excluded from the plain `integration` project.

## Consequences

- **Positive:** the display name tests are deterministic and leave the accounts as they found them. No new accounts or permanent rows are needed. Within one run (`workers: 1`), the e2e and integration surfaces never write the same account.
- **Negative / trade-offs:** a crash between a write and the restore leaves a name on a shared account. Because every test that writes a literal ends on a factory value (`afterEach`), the next run self-heals a leaked `Kata ` name: `DisplayNameSteps.capture()` treats it as no name, so its restore deletes it instead of writing it back. Residual: a crash between a literal write and that closing save leaves, at worst, one literal value on the account, which the next run captures as the original and writes back. Files on the same surface cannot run in parallel. Accepted risk: two concurrent pipelines on the same surface against staging (for example smoke-ui with a regression e2e, both writing the Owner, or two refs' regression runs on Admin and Member) can race on one display name; the mitigation is one suite per account at a time. The integration display-name specs sit in `ROLE_SPECS`, hence in `BASE_IGNORE`, so `smoke-api` (grep `@critical`) never sees them, and `smoke-roles-api` (grep `@smoke`) matches none of them; BK-2117, BK-2118 and BK-2119 (`@critical`) therefore run only in `integration-roles` (regression). The e2e files run under `e2e` and `smoke-ui`, where the `@critical` grep picks BK-2100 and all five BK-2101 rows. Role routing adds config surface (`ROLE_SPECS` and the `*-roles` matchers). This relaxes the per-test data isolation of ADR-0010 for account-level fields.
- **Neutral / follow-ups:** the same pattern applies to any later account-level setting (avatar, locale, notification preferences). Revisit when a delete or reset path for account state exists, or when more concurrent workers are wanted.

## Alternatives considered

- **Unique data per test (ADR-0010 as written)** — rejected: the display name has one value per account, so there is nothing unique to create.
- **Sign in once per file inside the spec** — rejected: breaks ADR-0018 (no spec signs in on its own) and costs two sign-ins per file under the 10-per-60-s throttle.
- **A dedicated throwaway account per file** — rejected: every new account is a permanent row (ADR-0010 has no delete path) and needs a verified email.
- **Skip the restore** — rejected: later tests and the people who share these accounts would see test names.

## References

- ADR-0010 (test isolation: user and workspace under RLS), ADR-0018 (test login budget under the sign-in throttle)
- `.context/PBI/epics/EPIC-BK-85-account-settings/test-specs/BK-1949/automation-plan.md` §2 D2 and §8
