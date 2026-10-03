# Project Configuration

> Project: Bunkai (Jira key `BK`)
> Generated: 2026-10-02 by `project-discovery` Phase 1 (Project Connection)
> Discovered from: `upex-bunkai-tms` at `main` commit `e88512e` (read-only snapshot)

The target repo is built on the same agentic boilerplate as this QA repo (`cli/`, `scripts/`, `.agents/`, `.claude/`, `docs/`, `CONTEXT.md`, `README.md`, `INSTALLER.md` are inherited tooling and describe the boilerplate, not the product). The PRODUCT lives in `app/`, `components/`, `lib/`, `middleware.ts`, `supabase/migrations/`, `public/openapi.json`, `DESIGN.md` and the product docs under `.context/` (`business/`, `PRD/`, `SRS/`) of the target repo.

## Repositories

| Repository | Local path | Remote | Branch | Commit | Purpose |
|------------|-----------|--------|--------|--------|---------|
| upex-bunkai-tms | `../upex-bunkai-tms` | `https://github.com/upex-galaxy/upex-bunkai-tms.git` | main | e88512e | Single Next.js app: web UI + REST API (`app/api/v1`) + Supabase schema. Not a monorepo. |
| bunkai-qa-engineering | `.` (this repo) | - | main | - | QA automation framework (KATA + Playwright) and QA context for Bunkai |

Frontend and backend are the same repo (`.agents/project.yaml` → `backend.backend_repo` and `frontend.frontend_repo` both point at `../upex-bunkai-tms`).

## Tech Stack

### Frontend
- Framework: Next.js `^15` (App Router, route groups `app/(app)`, `app/(auth)`), React `^19`
- Language: TypeScript `^5.9`
- Styling: Tailwind CSS `^3.4` with design tokens (`tailwind.config.ts`, `app/globals.css`, `DESIGN.md`); shadcn-style primitives (`components.json`, `components/ui/`) over Radix UI
- UI libraries: TanStack Table (`components/atcs/AtcTable.tsx`), Monaco editor (`components/atcs/StepEditor.tsx`), cmdk command palette, sonner toasts, lucide icons
- State: React Context for auth (`components/providers/auth-context.tsx`); server components fetch directly from Supabase; Server Actions for ATC save (`app/(app)/projects/[projectSlug]/atcs/[atcId]/actions.ts`)

### Backend
- Framework: Next.js Route Handlers under `app/api/v1/**` wrapped by `lib/api/handler.ts` (error envelope, request id, logging); Supabase RPC functions for multi-row writes
- Language: TypeScript; validation with `zod` `^4`
- ORM: none. Direct `@supabase/supabase-js` / `@supabase/ssr` queries; hand-maintained types in `lib/types.ts` plus generated `lib/types/supabase.ts`
- Auth: Supabase Auth (magic link in the UI; email + password and Personal Access Tokens `bk_pat_*` for API callers, `lib/api/middleware/bearer.ts`, `lib/api/pat.ts`)

### Database
- Type: PostgreSQL
- Provider: Supabase (Row Level Security on every table; helper functions in `supabase/migrations/0005_rls_helpers.sql`)
- Schema source of truth: `supabase/migrations/` (ordered SQL migrations)
- Access from this repo: DBHub MCP per environment (`.agents/project.yaml` → `environments.<env>.db_mcp`), credentials from `.env` `DBHUB_*` keys

### Infrastructure
- Cloud: Vercel (staging URL in `.agents/project.yaml`; target `.context/PRD/executive-summary.md` names Vercel + GitHub Actions)
- CI/CD: none found in the target repo (no `.github/` directory at `e88512e`); local git hooks only (`.husky/pre-commit`, `.husky/pre-push`)
- Monitoring: none found in code (Sentry / PostHog appear only as planned costs in target `.context/business/business-model.md`)
- Runtime tooling: Bun (scripts in target `package.json`)

## API Contract

- Served spec: `GET /api/openapi` returns `public/openapi.json` (`app/api/openapi/route.ts`)
- Generated from: per-route `route.openapi.ts` files via `@asteasolutions/zod-to-openapi` (`lib/openapi/registry.ts`, target script `openapi:gen`)
- Human docs UI: `/api/docs` (Scalar, `app/api/docs/page.tsx`)
- Design-time contract (intent, may differ from code): target `.context/SRS/api-contracts.yaml`
- Sync into this repo: `bun run api:sync` (read `package.json` first); env keys `API_BASE_URL`, `OPENAPI_SPEC_PATH`

## Environments

| Environment | Web URL | API base | Purpose | Access |
|-------------|---------|----------|---------|--------|
| local | `{{environments.local.web_url}}` (`http://localhost:3000`) | `{{environments.local.api_url}}` | Developer machine (`next dev`) | Direct; Supabase project per `.env` of the target |
| staging | `{{environments.staging.web_url}}` (`https://staging-upexbunkai.vercel.app`) | `{{environments.staging.api_url}}` | Default QA environment (`testing.default_env`) | Magic-link login or headless PAT (`/api/v1/auth/signup` / `signin`) |
| production | `upexbunkai.vercel.app` (`project.webapp_domain`) | - | Live | Not declared under `environments:`; read-only by policy, unverified |

## Environment variable keys (names only)

This QA repo (`.env.example`):

- Test users: `LOCAL_USER_EMAIL`, `LOCAL_USER_PASSWORD`, `STAGING_USER_EMAIL`, `STAGING_USER_PASSWORD`
- Environment selector: `TEST_ENV`
- API: `API_BASE_URL`, `OPENAPI_SPEC_PATH`
- Database (DBHub MCP): `DBHUB_TYPE`, `DBHUB_HOST`, `DBHUB_PORT`, `DBHUB_DATABASE`, `DBHUB_USER`, `DBHUB_PASSWORD`
- Atlassian / Xray: `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `XRAY_CLIENT_ID`, `XRAY_CLIENT_SECRET`, `XRAY_PROJECT_KEY`, `STP_EXECUTION_KEY`, `RTP_KEY`, `AUTO_SYNC`
- Other: `SLACK_MCP_XOXP_TOKEN`, `SLACK_MCP_REACTION_TOOL`

Target app runtime (`lib/env.ts`, validated at boot): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (optional), `NEXT_PUBLIC_APP_URL`. The target `.env.example` declares a different Supabase key set (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWT_SECRET`, `POSTGRES_*`), see Discovery Gaps.

## Tools and Access

- Issue tracker: Jira (`.agents/project.yaml` → `issue_tracker`), resolved via `[ISSUE_TRACKER_TOOL]` (`/acli`); host from `issue_tracker.atlassian_url`
- Project key: `{{PROJECT_KEY}}` (`BK`)
- TMS: Xray (`testing.tms_cli` = `bun xray`)
- Database: resolved via `[DB_TOOL]` (DBHub MCP `local-dbhub` / `staging-dbhub`)
- API: resolved via `[API_TOOL]` (OpenAPI MCP `local-openapi` / `staging-openapi` for schema; `curl` for execution)
- Docs: product intent docs live in the target repo `.context/PRD/`, `.context/SRS/`, `.context/business/`; QA-facing guide at the target route `/qa` (`app/qa/`)

## Access Checklist

- [x] Repository read access (local snapshot of `main` @ `e88512e`)
- [ ] Database access (MCP or direct): not verified in Phase 1
- [ ] Issue tracker access: verified in Phase 4 (`bun run jira:check`)
- [ ] Staging environment reachable: not verified in Phase 1
- [ ] CI/CD visibility: no CI found in the target repo

## Discovery Gaps

The following items could not be verified from code and require human confirmation:

- [ ] Production environment: `project.webapp_domain` names `upexbunkai.vercel.app`, but no `production` entry exists under `environments:` and nothing in the target code confirms it is live. Source of truth: the Vercel project owner.
- [ ] Supabase env key drift: `lib/env.ts` requires `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`, while the target `.env.example` declares `SUPABASE_PUBLISHABLE_KEY` + `SUPABASE_SECRET_KEY`. Which names the Vercel deployments actually set is unknown. Source: target maintainers / Vercel env settings.
- [ ] CI/CD: no workflow files in the target repo; whether Vercel's git integration is the only pipeline is unverified. Source: Vercel project settings.
- [ ] Monitoring / error tracking: none in code. Source: target maintainers.
- [ ] Database roles `qa_inspector_ro` / `qa_inspector_rw` are referenced by `supabase/migrations/0011_split_token_secrets.sql` but created outside the migrations; their grants per environment are unverified. Source: Supabase project / DBA.
- [ ] Database and staging reachability from this repo: not exercised in Phase 1 (`.env` `DBHUB_*`, `STAGING_USER_*`).
- [ ] Team contacts: not collected.
