# Measured Gotchas

> Loaded by: `business-data-context`, when reading this project's data map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | The QA database role (`qa_inspector_ro`, used by the `dbhub` MCP) bypasses RLS | Row counts and lookups span every tenant, so a check "passes" or "fails" on another workspace's data | Scope every SQL check by `workspace_id` (or a key that belongs to one workspace). Secret tables (`workspace_jira_connections`) answer `permission denied` to this role: assert connection state through the API | 2026-11-17 | `dbhub` session as `qa_inspector_ro`; data map `overview`, `discovery-gaps` (product `origin/staging` 4ccd8ede) |
| 2 | One Supabase project backs local, staging and production | Data seen through `dbhub` is not staging-only; test writes land in the shared database | Treat every row as shared: create isolated test workspaces and never assert on global counts. Not confirmed from the database itself | 2026-11-17 | Migration headers `0033`, `0035`, `0058` at product `origin/staging` 4ccd8ede; data map `discovery-gaps` |
| 3 | Notification preferences are applied when the notification is written, not when it is read. In-app off stores the row flagged `in_app_suppressed`; both channels off stores nothing. Mentions ignore preferences | An "empty inbox" assertion passes or fails for the wrong reason: the row was suppressed, not missing | Set preferences before triggering the event; assert on the stored row and its flag. Never assert that a mention is suppressible | 2026-11-17 | Data map `flow-notifications`, `entity-notification` (migration `0107`, product `origin/staging` 4ccd8ede) |
| 4 | Bug sync to Jira has no worker: `bugs.sync_state` can be re-queued to `pending` but nothing sends it | A test waiting for a Jira issue created from a bug never sees one | Do not write ATCs expecting a Jira issue from a bug; test only the tracker settings and the state flags | 2026-11-17 | Data map `flow-jira-connection-and-tracker`, `discovery-gaps` (every bug `not_applicable`, product `origin/staging` 4ccd8ede) |
| 5 | A soft-deleted workspace is restorable only inside a 30-day window; after it the restore is refused. Soft-deleted workspaces look non-existent to every helper | Restore tests on fresh data never reach the boundary; global workspace counts include deleted ones | Boundary tests need workspaces with an aged `deleted_at`; never count deleted workspaces as live | 2026-11-17 | Data map `entity-workspace`, `state-workspace` (migration `0125`, product `origin/staging` 4ccd8ede) |
| 6 | Seat limits are shown on billing but not enforced on invite or accept | A test asserting a seat-cap rejection fails against current behaviour | Do not assert a seat-cap rejection; treat it as a candidate bug or a product gap, not current behaviour | 2026-11-17 | Data map `flow-invite-and-membership`, `entity-workspace` (product `origin/staging` 4ccd8ede) |

## 2 · No longer true

_(empty)_
