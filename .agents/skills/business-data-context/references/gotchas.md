# Measured Gotchas

> Loaded by: `business-data-context`, when reading this project's data map could mislead a competent session. Every row was measured on the date given against the source it names. Rows that stop being true move to §"No longer true"; they are never deleted. Proposed and applied per `agentic-qa-core/references/skill-refinement-protocol.md`.

## 1 · Reading the map

| # | Gotcha | Symptom | Fix | Measured | Verified against |
|---|---|---|---|---|---|
| 1 | The QA database role (`qa_inspector_ro`, used by the `dbhub` MCP) bypasses RLS | Row counts and lookups span every tenant, so a check "passes" or "fails" on another workspace's data | Scope every SQL check by `workspace_id` (or a key that belongs to one workspace) | 2026-10-12 | `dbhub` session as `qa_inspector_ro`; data map `overview`, `discovery-gaps` (product `origin/staging` 98ee1b4) |
| 2 | One Supabase project backs local, staging and production | Data seen through `dbhub` is not staging-only; test writes land in the shared database | Treat every row as shared: create isolated test workspaces and never assert on global counts. Not confirmed from the database itself | 2026-10-12 | Migration headers `0033`, `0035`, `0058` at product `origin/staging` 98ee1b4; data map `discovery-gaps` |

## 2 · No longer true

_(empty)_
