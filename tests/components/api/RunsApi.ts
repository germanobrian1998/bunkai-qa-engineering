import type { RunReadsBaseline, RunReadsScope } from '@data/types';
import type { APIResponse } from '@playwright/test';
import type { RunComparison, RunReportItem, RunReportPage, RunResponse, WorkspaceRun, WorkspaceRuns } from '@schemas/runs.types';
import type { FinishRunBody, FinishRunResponse, MarkStepBody, MarkStepResponse, StartRunBody, StartRunResponse } from '@schemas/tests.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { randomUUID } from 'node:crypto';

import { ApiBase } from '@api/ApiBase';
import { TEST_LIFECYCLE } from '@data/constants';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

const READ_PAGE_CAP = 40;

const DATABASE_ERROR_TEXT = /invalid input (syntax|value)|out of range|date\/time field|violates|SQLSTATE|relation "|column "/i;

export class RunsApi extends ApiBase {
  constructor(options: TestContextOptions) {
    super(options);
  }

  private expectTotalsAndScope(page: RunReportPage): void {
    for (const key of ['passed', 'failed', 'manual', 'automated']) {
      expect(page.totals).toHaveProperty(key);
    }
    expect(page.totals).not.toHaveProperty('aborted');
    expect(page.totals).not.toHaveProperty('running');
    expect(page.scope).toHaveProperty('has_runs');
    expect(page.scope).toHaveProperty('has_automated');
  }

  private reportPath(projectId: string): string {
    return `/v1/projects/${projectId}/runs/report`;
  }

  private toQueryString(query: Record<string, string[]>): string {
    const params = new URLSearchParams();
    for (const [key, values] of Object.entries(query)) {
      for (const value of values) {
        params.append(key, value);
      }
    }
    const text = params.toString();
    return text === '' ? '' : `?${text}`;
  }

  private readReason(body: ErrorEnvelope): unknown {
    const details = body.error.details;
    return typeof details === 'object' && details !== null ? (details as { reason?: unknown }).reason : undefined;
  }

  @step
  async startRun(args: { testId: string, environmentId: string }): Promise<[APIResponse, StartRunResponse]> {
    const [response, body] = await this.apiPOST<StartRunResponse, StartRunBody>(
      '/v1/runs',
      { test_id: args.testId, environment_id: args.environmentId },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(201);
    return [response, body];
  }

  @step
  async markStep(args: { runId: string, stepId: string, status: MarkStepBody['status'] }): Promise<[APIResponse, MarkStepResponse]> {
    const [response, body] = await this.apiPOST<MarkStepResponse, MarkStepBody>(
      `/v1/runs/${args.runId}/steps/${args.stepId}/mark`,
      { status: args.status },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async finishRun(args: { runId: string, verdict: FinishRunBody['verdict'] }): Promise<[APIResponse, FinishRunResponse]> {
    const [response, body] = await this.apiPOST<FinishRunResponse, FinishRunBody>(
      `/v1/runs/${args.runId}/finish`,
      { verdict: args.verdict },
    );
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async getReport(args: { projectId: string, query?: Record<string, string[]> }): Promise<[APIResponse, RunReportPage]> {
    const [response, body] = await this.apiGET<RunReportPage>(
      `${this.reportPath(args.projectId)}${this.toQueryString(args.query ?? {})}`,
    );
    return [response, body];
  }

  @step
  async getReportError(args: { projectId: string, query?: Record<string, string[]> }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiGET<ErrorEnvelope>(
      `${this.reportPath(args.projectId)}${this.toQueryString(args.query ?? {})}`,
    );
    return [response, body];
  }

  @step
  async readModuleReport(args: { projectId: string, moduleId: string }): Promise<[APIResponse, Pick<RunReportPage, 'totals' | 'scope' | 'items'>]> {
    const items: RunReportItem[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < READ_PAGE_CAP; pageNumber++) {
      const query: Record<string, string[]> = cursor === null
        ? { module_id: [args.moduleId], limit: ['50'] }
        : { module_id: [args.moduleId], limit: ['50'], cursor: [cursor] };
      const [response, page] = await this.getReport({ projectId: args.projectId, query });
      expect(response.status()).toBe(200);
      items.push(...page.items);
      cursor = page.next_cursor;
      if (cursor === null) {
        return [response, { totals: page.totals, scope: page.scope, items }];
      }
    }
    throw new Error(`GET ${this.reportPath(args.projectId)}: the runs of module ${args.moduleId} were not covered within ${READ_PAGE_CAP} pages`);
  }

  @step
  async readWorkspaceRuns(args: { workspaceId: string, projectId: string, testId: string, since: string }): Promise<[APIResponse, { rows: WorkspaceRun[], runCount: number }]> {
    const rows: WorkspaceRun[] = [];
    const floor = Date.parse(args.since);
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < READ_PAGE_CAP; pageNumber++) {
      const params: Record<string, string> = cursor === null
        ? { project_id: args.projectId, limit: '50' }
        : { project_id: args.projectId, limit: '50', cursor };
      const [response, page] = await this.apiGET<WorkspaceRuns>(`/v1/workspaces/${args.workspaceId}/runs`, { params });
      expect(response.status()).toBe(200);
      rows.push(...page.items.filter(row => row.test_id === args.testId));
      cursor = page.next_cursor;
      const oldest = page.items.at(-1);
      const coveredFloor = oldest !== undefined && Date.parse(oldest.started_at) < floor;
      if (cursor === null || coveredFloor) {
        return [response, { rows, runCount: page.workspace_run_count }];
      }
    }
    throw new Error(`GET /v1/workspaces/${args.workspaceId}/runs: the runs of Test ${args.testId} were not covered within ${READ_PAGE_CAP} pages`);
  }

  @step
  async readCompare(runId: string): Promise<[APIResponse, RunComparison]> {
    const [response, body] = await this.apiGET<RunComparison>(`/v1/runs/${runId}/compare`);
    expect(response.status()).toBe(200);
    return [response, body];
  }

  @step
  async captureRunReads(scope: RunReadsScope): Promise<RunReadsBaseline> {
    const [, report] = await this.readModuleReport({ projectId: scope.projectId, moduleId: scope.moduleId });
    const [, workspace] = await this.readWorkspaceRuns({
      workspaceId: scope.workspaceId,
      projectId: scope.projectId,
      testId: scope.testId,
      since: scope.testCreatedAt,
    });
    const [, compare] = await this.readCompare(scope.runId);
    return { report, workspaceRuns: workspace.rows, workspaceRunCount: workspace.runCount, compare };
  }

  @atc('BK-1974')
  async readReportIsolatedToProject(args: {
    projectId: string
    expected: { status: 200, automated: number, manual: number, rows: number } | { status: 404 }
  }): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
    const { projectId, expected } = args;
    const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(this.reportPath(projectId));

    expect(response.status()).toBe(expected.status);
    if (expected.status === 200) {
      const page = body as RunReportPage;
      expect(page.totals.automated).toBe(expected.automated);
      expect(page.totals.manual).toBe(expected.manual);
      expect(page.items).toHaveLength(expected.rows);
      expect(page.scope.has_automated).toBe(expected.automated > 0);
    }
    else {
      const error = body as ErrorEnvelope;
      expect(error.error.code).toBe('not_found');
      expect(this.readReason(error)).toBe('not_found');
      expect(body).not.toHaveProperty('items');
      expect(body).not.toHaveProperty('totals');
      expect(body).not.toHaveProperty('scope');
    }
    return [response, body];
  }

  @atc('BK-1975')
  async readReportWithConsistentTotals(args: {
    projectId: string
    query: Record<string, string[]>
  }): Promise<[APIResponse, RunReportPage]> {
    const [response, body] = await this.apiGET<RunReportPage>(
      `${this.reportPath(args.projectId)}${this.toQueryString(args.query)}`,
    );

    expect(response.status()).toBe(200);
    const { totals, scope } = body;
    for (const count of [totals.passed, totals.failed, totals.manual, totals.automated]) {
      expect(typeof count).toBe('number');
    }
    expect(typeof scope.has_runs).toBe('boolean');
    expect(typeof scope.has_automated).toBe('boolean');
    expect(totals.manual + totals.automated).toBe(totals.passed + totals.failed);
    expect(totals).not.toHaveProperty('aborted');
    expect(totals).not.toHaveProperty('running');
    return [response, body];
  }

  @atc('BK-1982')
  async readReportWithScopedToken(args: {
    projectId: string
    hasAtcRead: boolean
  }): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
    const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(
      `${this.reportPath(args.projectId)}?executor=agent`,
    );

    expect(response.status()).toBe(args.hasAtcRead ? 200 : 403);
    if (args.hasAtcRead) {
      const page = body as RunReportPage;
      expect(Array.isArray(page.items)).toBe(true);
      this.expectTotalsAndScope(page);
    }
    else {
      const error = body as ErrorEnvelope;
      expect(error.error.code).toBe('forbidden');
      expect(this.readReason(error)).toBe('missing_capability');
      expect(body).not.toHaveProperty('items');
      expect(body).not.toHaveProperty('totals');
      expect(body).not.toHaveProperty('scope');
    }
    return [response, body];
  }

  @atc('BK-1983')
  async probeReportParameters(args: {
    projectId: string
    query: string
    expected: { status: 200 | 400 | 422, items?: number, nextCursor?: boolean }
  }): Promise<[APIResponse, RunReportPage | ErrorEnvelope]> {
    const { expected } = args;
    const [response, body] = await this.apiGET<RunReportPage | ErrorEnvelope>(
      `${this.reportPath(args.projectId)}?${args.query}`,
    );

    expect(response.status()).toBe(expected.status);
    if (expected.status === 200) {
      const page = body as RunReportPage;
      expect(Array.isArray(page.items)).toBe(true);
      this.expectTotalsAndScope(page);
      if (expected.items !== undefined) {
        expect(page.items).toHaveLength(expected.items);
      }
      if (expected.nextCursor === true) {
        expect(typeof page.next_cursor).toBe('string');
        expect(page.next_cursor?.length).toBeGreaterThan(0);
      }
      else if (expected.nextCursor === false) {
        expect(page.next_cursor).toBeNull();
      }
    }
    else {
      const error = body as ErrorEnvelope;
      expect(error.error.code).toBe(expected.status === 422 ? 'validation_failed' : 'bad_request');
      expect(JSON.stringify(error.error)).not.toMatch(DATABASE_ERROR_TEXT);
    }
    return [response, body];
  }

  @atc('BK-2158')
  async refuseRunFromArchivedTest(args: { testId: string, environmentId: string }): Promise<[APIResponse, ErrorEnvelope]> {
    const [response, body] = await this.apiPOST<ErrorEnvelope, StartRunBody>(
      '/v1/runs',
      { test_id: args.testId, environment_id: args.environmentId },
      { headers: { 'Idempotency-Key': randomUUID() } },
    );
    expect(response.status(), 'starting a Run from an archived Test is a conflict').toBe(409);
    expect(body.error.code).toBe('conflict');
    expect(this.readReason(body), 'the refusal names the archived Test').toBe(TEST_LIFECYCLE.archivedReason);
    return [response, body];
  }

  @atc('BK-2178')
  async holdRunReadsAfterArchive(args: { baseline: RunReadsBaseline, scope: RunReadsScope }): Promise<[APIResponse, RunReadsBaseline]> {
    const { baseline, scope } = args;
    const after = await this.captureRunReads(scope);
    expect(after.report.totals, 'the runs report totals of the Test module equal their baseline').toEqual(baseline.report.totals);
    expect(after.report.items, 'every runs report row of the Test module equals its baseline').toEqual(baseline.report.items);
    expect(after.workspaceRuns, 'the workspace runs index rows of the Test equal their baseline').toEqual(baseline.workspaceRuns);
    expect(after.compare, 'the comparison of the latest Run equals its baseline').toEqual(baseline.compare);
    expect(after.workspaceRunCount, 'the workspace run count has not dropped below its baseline').toBeGreaterThanOrEqual(baseline.workspaceRunCount);
    const [response] = await this.apiGET<RunResponse>(`/v1/runs/${scope.runId}`);
    expect(response.status(), 'the Run of the archived Test still resolves').toBe(200);
    return [response, after];
  }
}
