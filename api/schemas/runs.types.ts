import type { components, paths } from '@openapi';

export type RunReportPage = components['schemas']['RunReportPage'];
export type RunReportItem = components['schemas']['RunReportItem'];
export type RunReportTotals = components['schemas']['RunReportTotals'];
export type RunComparison = components['schemas']['RunComparison'];
export type WorkspaceRuns = components['schemas']['WorkspaceRuns'];
export type WorkspaceRun = components['schemas']['WorkspaceRun'];
export type RunResponse = paths['/api/v1/runs/{id}']['get']['responses']['200']['content']['application/json'];
