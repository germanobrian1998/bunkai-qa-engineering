import type { APIResponse } from '@playwright/test';
import type { RunReportPage } from '@schemas/runs.types';
import type { ErrorEnvelope } from '@schemas/workspace.types';
import type { TestContextOptions } from '@TestContext';

import { ApiBase } from '@api/ApiBase';
import { expect } from '@playwright/test';
import { atc, step } from '@utils/decorators';

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
}
